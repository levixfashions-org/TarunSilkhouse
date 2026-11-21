import express, { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { env } from '../env.ts';
import { ah, badRequest, conflict, notFound, parse } from '../lib/errors.ts';
import { log } from '../lib/log.ts';
import { whatsappOrderText } from '../lib/mail.ts';
import { createOrder, markPaid, notifyPlaced } from '../lib/orders.ts';
import { buildQuote, quoteInputSchema } from '../lib/pricing.ts';
import { razorpay, razorpayEnabled, verifyPaymentSignature, verifyWebhookSignature } from '../lib/razorpay.ts';

export const checkout = Router();

checkout.post(
  '/checkout/quote',
  ah(async (req, res) => {
    const input = parse(quoteInputSchema, req.body);
    const quote = await buildQuote(input, { userId: req.user?.id });
    res.json({ quote, razorpay: razorpayEnabled() });
  }),
);

const phone = z
  .string()
  .transform((s) => s.replace(/[^\d]/g, '').replace(/^91(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));

export const shipSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  lat: z.number().min(6).max(38).optional(), // India bounding box
  lng: z.number().min(68).max(98).optional(),
});

const placeSchema = quoteInputSchema.extend({
  idempotencyKey: z.string().min(16).max(64),
  email: z.string().trim().toLowerCase().email(),
  ship: shipSchema,
  paymentMethod: z.enum(['RAZORPAY', 'COD']),
  giftMessage: z.string().trim().max(300).optional(),
  saveAddress: z.boolean().optional(),
});

checkout.post(
  '/checkout/place',
  ah(async (req, res) => {
    const input = parse(placeSchema, req.body);
    const quote = await buildQuote({ ...input, pincode: input.ship.pincode }, { userId: req.user?.id, strict: true });

    const { order, reused } = await createOrder({
      idempotencyKey: input.idempotencyKey,
      quote,
      userId: req.user?.id ?? null,
      email: input.email,
      ship: input.ship,
      method: input.paymentMethod,
      giftMessage: input.giftMessage,
    });

    if (!reused && req.user && input.saveAddress) {
      const exists = await prisma.address.findFirst({ where: { userId: req.user.id, line1: input.ship.line1, pincode: input.ship.pincode } });
      if (!exists) {
        const count = await prisma.address.count({ where: { userId: req.user.id } });
        await prisma.address.create({ data: { ...input.ship, userId: req.user.id, isDefault: count === 0 } });
      }
    }

    if (order.paymentMethod === 'COD') {
      if (!reused) void notifyPlaced(order.id);
      return res.json({ order: { number: order.number, status: order.status, total: order.total } });
    }

    // Razorpay: reuse the existing gateway order on retries so the customer is never charged twice.
    const pay = order.payments[0];
    let rzpOrderId = pay?.razorpayOrderId ?? null;
    if (!rzpOrderId) {
      const rzp = await razorpay().orders.create({
        amount: order.total,
        currency: 'INR',
        receipt: order.number,
        notes: { orderId: order.id },
      });
      rzpOrderId = rzp.id;
      await prisma.payment.update({ where: { id: pay.id }, data: { razorpayOrderId: rzpOrderId } });
    }
    res.json({
      order: { number: order.number, status: order.status, total: order.total },
      razorpay: { keyId: env.RAZORPAY_KEY_ID, orderId: rzpOrderId, amount: order.total, currency: 'INR' },
    });
  }),
);

checkout.post(
  '/checkout/verify',
  ah(async (req, res) => {
    const b = parse(
      z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }),
      req.body,
    );
    if (!verifyPaymentSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
      throw badRequest('Payment could not be verified. If money was deducted, it will be refunded automatically.', 'bad_signature');
    }
    const order = await markPaid(b.razorpay_order_id, b.razorpay_payment_id, { source: 'checkout' });
    res.json({ order: { number: order.number, status: order.status } });
  }),
);

/** Razorpay webhook — mount BEFORE express.json() so we can verify the raw body. */
export const razorpayWebhook = Router();
razorpayWebhook.post(
  '/razorpay',
  express.raw({ type: 'application/json', limit: '1mb' }),
  ah(async (req, res) => {
    const sig = req.header('x-razorpay-signature') ?? '';
    if (!verifyWebhookSignature(req.body as Buffer, sig)) {
      log.warn('razorpay_webhook_bad_signature');
      return res.status(400).json({ ok: false });
    }
    const event = JSON.parse((req.body as Buffer).toString('utf8')) as {
      event: string;
      payload: { payment?: { entity: { id: string; order_id: string; status: string } }; refund?: { entity: { payment_id: string; amount: number } } };
    };
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const p = event.payload.payment?.entity;
      if (p?.order_id) await markPaid(p.order_id, p.id, { source: 'webhook', event: event.event }).catch((e) => log.warn('webhook_markpaid', { err: String(e) }));
    } else if (event.event === 'payment.failed') {
      const p = event.payload.payment?.entity;
      if (p?.order_id) await prisma.payment.updateMany({ where: { razorpayOrderId: p.order_id, status: 'CREATED' }, data: { status: 'FAILED' } });
    }
    res.json({ ok: true });
  }),
);

/** Public order view for the confirmation page and "track my order" (needs number + phone). */
checkout.get(
  '/orders/track',
  ah(async (req, res) => {
    const q = parse(z.object({ number: z.string().trim().toUpperCase().min(4).max(30), phone }), req.query);
    const o = await prisma.order.findFirst({
      where: { number: q.number, phone: q.phone },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!o) throw notFound('We could not find an order with that number and phone');
    res.json({ order: publicOrder(o) });
  }),
);

export function publicOrder(o: {
  number: string;
  status: string;
  paymentMethod: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  giftWrap: number;
  createdAt: Date;
  shipName: string;
  shipCity: string;
  shipPincode: string;
  courier: string | null;
  awb: string | null;
  trackingUrl: string | null;
  email: string;
  items: { productId: string | null; name: string; colourName: string; qty: number; unitPrice: number; servicesFee: number; image: string | null }[];
  events: { status: string; note: string | null; createdAt: Date }[];
}) {
  return {
    number: o.number,
    status: o.status,
    paymentMethod: o.paymentMethod,
    total: o.total,
    subtotal: o.subtotal,
    discount: o.discount,
    shipping: o.shipping,
    codFee: o.codFee,
    giftWrap: o.giftWrap,
    createdAt: o.createdAt,
    shipName: o.shipName,
    shipCity: o.shipCity,
    shipPincode: o.shipPincode,
    courier: o.courier,
    awb: o.awb,
    trackingUrl: o.trackingUrl,
    items: o.items.map((i) => ({ productId: i.productId, name: i.name, colourName: i.colourName, qty: i.qty, unitPrice: i.unitPrice, servicesFee: i.servicesFee, image: i.image })),
    events: o.events.map((e) => ({ status: e.status, note: e.note, at: e.createdAt })),
    whatsappText: whatsappOrderText(o),
  };
}

/** Lets the confirmation page fetch the order right after payment without asking for the phone again. */
checkout.post(
  '/orders/confirmation',
  ah(async (req, res) => {
    const b = parse(z.object({ number: z.string().max(30), idempotencyKey: z.string().min(16).max(64) }), req.body);
    const o = await prisma.order.findFirst({
      where: { number: b.number, idempotencyKey: b.idempotencyKey },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!o) throw notFound('Order not found');
    res.json({ order: publicOrder(o) });
  }),
);

/** Saves the bag server-side (for signed-in users or guests who typed an email) — used for abandoned-bag reminders. */
checkout.post(
  '/cart/sync',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        cartId: z.string().max(40).optional(),
        email: z.string().email().optional(),
        items: z.array(z.object({ productId: z.string(), colourId: z.string(), qty: z.number().int().min(1).max(10) })).max(30),
      }),
      req.body,
    );
    const valid = await prisma.productColour.findMany({ where: { id: { in: b.items.map((i) => i.colourId) } }, select: { id: true, productId: true } });
    const ok = new Set(valid.map((v) => `${v.productId}:${v.id}`));
    const items = b.items.filter((i) => ok.has(`${i.productId}:${i.colourId}`));
    let cart = b.cartId ? await prisma.cart.findUnique({ where: { id: b.cartId } }) : null;
    if (cart && cart.userId && cart.userId !== req.user?.id) cart = null;
    if (!cart) cart = await prisma.cart.create({ data: { userId: req.user?.id ?? null, email: b.email ?? req.user?.email ?? null } });
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      prisma.cartItem.createMany({ data: items.map((i) => ({ ...i, cartId: cart!.id })) }),
      prisma.cart.update({ where: { id: cart.id }, data: { email: b.email ?? cart.email, userId: req.user?.id ?? cart.userId, remindedAt: null } }),
    ]);
    res.json({ cartId: cart.id });
  }),
);

checkout.post(
  '/orders/:number/cancel-pending',
  ah(async (req, res) => {
    // Customer closed the Razorpay window: keep the hold (they may retry); nothing to do server-side.
    const o = await prisma.order.findUnique({ where: { number: req.params.number } });
    if (!o) throw notFound();
    if (o.status !== 'PENDING_PAYMENT') throw conflict('Order is not awaiting payment');
    res.json({ ok: true });
  }),
);
