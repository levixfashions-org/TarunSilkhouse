import { Router } from 'express';
import { z } from 'zod';
import { Prisma, prisma } from '../../db.ts';
import { ah, badRequest, conflict, notFound, parse } from '../../lib/errors.ts';
import { renderInvoice } from '../../lib/invoice.ts';
import { changeStatus } from '../../lib/orders.ts';
import { razorpay } from '../../lib/razorpay.ts';
import { getSettings } from '../../lib/settings.ts';
import { sendMail, layout } from '../../lib/mail.ts';
import { env } from '../../env.ts';

export const adminOrders = Router();

const STATUSES = ['PENDING_PAYMENT', 'PLACED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] as const;

adminOrders.get(
  '/dashboard',
  ah(async (_req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const d30 = new Date(Date.now() - 30 * 86400_000);
    const live = { status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] as ('CANCELLED' | 'PENDING_PAYMENT')[] } };
    const [today, revenueToday, revenue30, pending, lowStock, top, recent] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: start }, ...live } }),
      prisma.order.aggregate({ where: { createdAt: { gte: start }, ...live }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: d30 }, ...live }, _sum: { total: true }, _count: true }),
      prisma.order.count({ where: { status: { in: ['PLACED', 'PACKED'] } } }),
      prisma.productColour.findMany({
        where: { stock: { lte: 2 }, product: { isActive: true } },
        include: { product: { select: { name: true, id: true } } },
        orderBy: { stock: 'asc' },
        take: 12,
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'name'],
        where: { order: { createdAt: { gte: d30 }, ...live } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 6,
      }),
      prisma.order.findMany({ where: live, orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    res.json({
      today,
      revenueToday: revenueToday._sum.total ?? 0,
      revenue30: revenue30._sum.total ?? 0,
      orders30: revenue30._count,
      pendingShipments: pending,
      lowStock: lowStock.map((c) => ({ productId: c.product.id, name: c.product.name, colour: c.colourName, stock: c.stock })),
      top: top.map((t) => ({ productId: t.productId, name: t.name, qty: t._sum.qty ?? 0 })),
      recent: recent.map((o) => ({ id: o.id, number: o.number, total: o.total, status: o.status, name: o.shipName, city: o.shipCity, createdAt: o.createdAt })),
    });
  }),
);

adminOrders.get(
  '/orders',
  ah(async (req, res) => {
    const q = parse(
      z.object({
        status: z.enum([...STATUSES, 'ALL']).default('ALL'),
        q: z.string().trim().max(60).optional(),
        method: z.enum(['RAZORPAY', 'COD', 'ALL']).default('ALL'),
        page: z.coerce.number().int().min(1).default(1),
      }),
      req.query,
    );
    const where: Prisma.OrderWhereInput = {
      ...(q.status !== 'ALL' ? { status: q.status } : {}),
      ...(q.method !== 'ALL' ? { paymentMethod: q.method } : {}),
      ...(q.q ? { OR: [{ number: { contains: q.q } }, { phone: { contains: q.q } }, { email: { contains: q.q } }, { shipName: { contains: q.q } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * 30, take: 30, include: { _count: { select: { items: true } } } }),
    ]);
    res.json({
      total,
      pages: Math.ceil(total / 30),
      items: rows.map((o) => ({
        id: o.id,
        number: o.number,
        createdAt: o.createdAt,
        name: o.shipName,
        city: o.shipCity,
        phone: o.phone,
        total: o.total,
        status: o.status,
        paymentMethod: o.paymentMethod,
        items: o._count.items,
      })),
    });
  }),
);

adminOrders.get(
  '/orders/:id',
  ah(async (req, res) => {
    const o = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } }, payments: true, user: { select: { name: true, email: true } } },
    });
    if (!o) throw notFound();
    res.json({
      order: {
        ...o,
        mapsUrl: o.lat && o.lng ? `https://www.google.com/maps?q=${o.lat},${o.lng}` : `https://www.google.com/maps/search/${encodeURIComponent(`${o.shipLine1}, ${o.shipCity} ${o.shipPincode}`)}`,
      },
    });
  }),
);

adminOrders.post(
  '/orders/:id/status',
  ah(async (req, res) => {
    const b = parse(z.object({ status: z.enum(STATUSES), note: z.string().max(300).optional() }), req.body);
    const o = await changeStatus(req.params.id, b.status, b.note);
    if (b.status === 'SHIPPED' || b.status === 'DELIVERED') {
      const full = await prisma.order.findUnique({ where: { id: o.id } });
      if (full) {
        const html = await layout(
          b.status === 'SHIPPED' ? 'Your saree is on its way' : 'Delivered — we hope you love it',
          `<p>Order <strong>${full.number}</strong> is now <strong>${b.status.toLowerCase()}</strong>.</p>
           ${full.awb ? `<p>${full.courier ?? 'Courier'} AWB: <strong>${full.awb}</strong>${full.trackingUrl ? ` · <a href="${full.trackingUrl}">Track</a>` : ''}</p>` : ''}
           <p><a href="${env.PUBLIC_URL}/track?order=${full.number}" style="color:#6B1F2A">View order</a></p>`,
        );
        void sendMail(full.email, `Order ${full.number} ${b.status.toLowerCase()}`, html);
      }
    }
    res.json({ order: o });
  }),
);

adminOrders.patch(
  '/orders/:id',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        courier: z.string().max(60).optional().nullable(),
        awb: z.string().max(60).optional().nullable(),
        trackingUrl: z.string().url().max(1000).optional().nullable().or(z.literal('')),
        notes: z.string().max(4000).optional().nullable(),
      }),
      req.body,
    );
    const o = await prisma.order.update({ where: { id: req.params.id }, data: { ...b, trackingUrl: b.trackingUrl || null } });
    res.json({ order: o });
  }),
);

adminOrders.post(
  '/orders/:id/refund',
  ah(async (req, res) => {
    const b = parse(z.object({ amount: z.number().positive().optional(), reason: z.string().max(200).optional() }), req.body); // rupees
    const o = await prisma.order.findUnique({ where: { id: req.params.id }, include: { payments: true } });
    if (!o) throw notFound();
    const pay = o.payments.find((p) => p.method === 'RAZORPAY' && p.razorpayPaymentId && (p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED'));
    if (!pay) throw badRequest('No captured online payment on this order');
    const amount = b.amount ? Math.round(b.amount * 100) : pay.amount - pay.refundedAmount;
    if (amount <= 0 || amount > pay.amount - pay.refundedAmount) throw conflict('Refund amount is more than what is left to refund');
    const r = await razorpay().payments.refund(pay.razorpayPaymentId!, { amount, notes: { reason: b.reason ?? 'Refund', order: o.number } });
    const refunded = pay.refundedAmount + amount;
    await prisma.payment.update({
      where: { id: pay.id },
      data: { refundedAmount: refunded, status: refunded >= pay.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });
    await prisma.orderStatusEvent.create({ data: { orderId: o.id, status: o.status, note: `Refunded ₹${amount / 100} (${r.id})` } });
    res.json({ ok: true, refundId: r.id });
  }),
);

adminOrders.get(
  '/orders/:id/:kind(invoice|packing).pdf',
  ah(async (req, res) => {
    const o = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!o) throw notFound();
    const pdf = await renderInvoice(o, await getSettings(), req.params.kind as 'invoice' | 'packing');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${o.number}-${req.params.kind}.pdf"`);
    res.send(pdf);
  }),
);

adminOrders.get(
  '/customers',
  ah(async (req, res) => {
    const { q } = parse(z.object({ q: z.string().max(60).optional() }), req.query);
    const rows = await prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q } }, { phone: { contains: q } }, { name: { contains: q } }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { orders: { where: { status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } }, select: { total: true } } },
    });
    res.json({
      items: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        createdAt: u.createdAt,
        orders: u.orders.length,
        spent: u.orders.reduce((s, o) => s + o.total, 0),
      })),
    });
  }),
);
