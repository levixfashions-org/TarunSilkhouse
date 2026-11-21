import crypto from 'node:crypto';
import { Prisma, prisma } from '../db.ts';
import type { OrderStatus, PaymentMethod } from '../generated/prisma/enums.ts';
import { conflict, notFound } from './errors.ts';
import { log } from './log.ts';
import { sendOrderConfirmation } from './mail.ts';
import type { Quote } from './pricing.ts';

type Tx = Prisma.TransactionClient;

export type ShipTo = {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number;
  lng?: number;
};

function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `TS${ymd}-${crypto.randomInt(1000, 9999)}${crypto.randomInt(0, 9)}`;
}

/**
 * Creates the order and reserves stock in ONE transaction.
 * Stock decrement uses `UPDATE … WHERE stock >= qty`, so two shoppers racing for the last piece
 * cannot both succeed: the second update matches 0 rows and the whole transaction rolls back.
 */
export async function createOrder(args: {
  idempotencyKey: string;
  quote: Quote;
  userId: string | null;
  email: string;
  ship: ShipTo;
  method: PaymentMethod;
  couponCode?: string | null;
  giftMessage?: string | null;
}) {
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: args.idempotencyKey }, include: { payments: true } });
  if (existing) return { order: existing, reused: true };

  const { quote } = args;
  const wanted = new Map<string, number>();
  for (const l of quote.lines) wanted.set(l.colourId, (wanted.get(l.colourId) ?? 0) + l.qty);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await prisma.$transaction(
        async (tx: Tx) => {
          for (const [colourId, qty] of wanted) {
            const r = await tx.productColour.updateMany({ where: { id: colourId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
            if (r.count !== 1) {
              const line = quote.lines.find((l) => l.colourId === colourId);
              throw conflict(`Sorry — ${line?.name ?? 'an item'} (${line?.colourName ?? ''}) just sold out.`, 'sold_out', { colourId });
            }
          }
          const status: OrderStatus = args.method === 'COD' ? 'PLACED' : 'PENDING_PAYMENT';
          const o = await tx.order.create({
            data: {
              number: orderNumber(),
              idempotencyKey: args.idempotencyKey,
              userId: args.userId,
              email: args.email,
              phone: args.ship.phone,
              status,
              paymentMethod: args.method,
              subtotal: quote.subtotal,
              discount: quote.discount,
              shipping: quote.shipping,
              codFee: quote.codFee,
              giftWrap: quote.giftWrap,
              total: quote.total,
              couponCode: quote.coupon?.code ?? null,
              giftMessage: args.giftMessage ?? null,
              shipName: args.ship.name,
              shipLine1: args.ship.line1,
              shipLine2: args.ship.line2 ?? null,
              shipLandmark: args.ship.landmark ?? null,
              shipCity: args.ship.city,
              shipState: args.ship.state,
              shipPincode: args.ship.pincode,
              lat: args.ship.lat ?? null,
              lng: args.ship.lng ?? null,
              items: {
                create: quote.lines.map((l) => ({
                  productId: l.productId,
                  colourId: l.colourId,
                  name: l.name,
                  colourName: l.colourName,
                  image: l.image,
                  unitPrice: l.unitPrice,
                  qty: l.qty,
                  servicesFee: l.servicesFee,
                  options: (l.options ?? undefined) as Prisma.InputJsonValue | undefined,
                })),
              },
              events: { create: { status, note: args.method === 'COD' ? 'Cash on delivery order placed' : 'Awaiting payment' } },
              payments: {
                create: {
                  method: args.method,
                  status: args.method === 'COD' ? 'COD_PENDING' : 'CREATED',
                  amount: quote.total,
                },
              },
            },
            include: { payments: true, items: true },
          });
          if (quote.coupon && args.method === 'COD') {
            await tx.coupon.update({ where: { code: quote.coupon.code }, data: { usedCount: { increment: 1 } } });
          }
          return o;
        },
        { isolationLevel: 'ReadCommitted', timeout: 15_000 },
      );
      return { order, reused: false };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = String(e.meta?.target ?? '');
        if (target.includes('idempotency')) {
          const o = await prisma.order.findUnique({ where: { idempotencyKey: args.idempotencyKey }, include: { payments: true } });
          if (o) return { order: o, reused: true };
        }
        continue; // order number collision — retry with a new number
      }
      throw e;
    }
  }
  throw new Error('Could not allocate an order number');
}

/** Marks a Razorpay order paid (idempotent — safe for both the browser callback and the webhook). */
export async function markPaid(razorpayOrderId: string, razorpayPaymentId: string, raw: unknown) {
  const result = await prisma.$transaction(async (tx: Tx) => {
    const pay = await tx.payment.findUnique({ where: { razorpayOrderId }, include: { order: true } });
    if (!pay) throw notFound('Payment not found');
    if (pay.status === 'PAID') return { order: pay.order, changed: false };
    await tx.payment.update({
      where: { id: pay.id },
      data: { status: 'PAID', razorpayPaymentId, raw: raw as Prisma.InputJsonValue },
    });
    let order = pay.order;
    if (order.status === 'PENDING_PAYMENT' || order.status === 'CANCELLED') {
      if (order.stockReleased) {
        // Payment arrived after the hold expired: try to re-reserve; if impossible, admin must refund.
        const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
        let ok = true;
        for (const it of items) {
          if (!it.colourId) continue;
          const r = await tx.productColour.updateMany({ where: { id: it.colourId, stock: { gte: it.qty } }, data: { stock: { decrement: it.qty } } });
          if (r.count !== 1) ok = false;
        }
        if (!ok) {
          await tx.order.update({ where: { id: order.id }, data: { notes: 'PAID AFTER HOLD EXPIRED — stock unavailable, please refund or source the saree.' } });
        }
      }
      order = await tx.order.update({
        where: { id: order.id },
        data: { status: 'PLACED', stockReleased: false, events: { create: { status: 'PLACED', note: 'Payment received (Razorpay)' } } },
      });
      if (order.couponCode) await tx.coupon.updateMany({ where: { code: order.couponCode }, data: { usedCount: { increment: 1 } } });
    }
    return { order, changed: true };
  });
  if (result.changed) void notifyPlaced(result.order.id);
  return result.order;
}

export async function notifyPlaced(orderId: string) {
  try {
    const o = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (o) await sendOrderConfirmation(o);
  } catch (e) {
    log.error('notify_failed', { orderId, err: String(e) });
  }
}

/** Puts reserved stock back (cancel, return, or unpaid hold expiry). Runs at most once per order. */
export async function releaseStock(tx: Tx, orderId: string) {
  const o = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o || o.stockReleased) return;
  for (const it of o.items) {
    if (it.colourId) await tx.productColour.updateMany({ where: { id: it.colourId }, data: { stock: { increment: it.qty } } });
  }
  await tx.order.update({ where: { id: orderId }, data: { stockReleased: true } });
}

const FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED', 'PLACED'],
  PLACED: ['PACKED', 'SHIPPED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export async function changeStatus(orderId: string, to: OrderStatus, note?: string) {
  return prisma.$transaction(async (tx: Tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });
    if (!o) throw notFound('Order not found');
    if (o.status === to) return o;
    if (!FLOW[o.status].includes(to)) throw conflict(`Cannot move an order from ${o.status} to ${to}`);
    if (to === 'CANCELLED' || to === 'RETURNED') await releaseStock(tx, orderId);
    if (to === 'DELIVERED' && o.paymentMethod === 'COD') {
      await tx.payment.updateMany({ where: { orderId, method: 'COD' }, data: { status: 'COD_COLLECTED' } });
    }
    return tx.order.update({ where: { id: orderId }, data: { status: to, events: { create: { status: to, note } } } });
  });
}

/** Unpaid Razorpay orders hold stock for 30 minutes, then release it. */
export async function expireUnpaid() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff }, stockReleased: false },
    select: { id: true },
    take: 50,
  });
  for (const s of stale) {
    await prisma.$transaction(async (tx: Tx) => {
      await releaseStock(tx, s.id);
      await tx.order.update({
        where: { id: s.id },
        data: { status: 'CANCELLED', events: { create: { status: 'CANCELLED', note: 'Payment not completed within 30 minutes' } } },
      });
    });
  }
  if (stale.length) log.info('expired_unpaid_orders', { count: stale.length });
}
