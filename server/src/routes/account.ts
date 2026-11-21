import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { requireUser } from '../lib/auth.ts';
import { ah, badRequest, notFound, parse } from '../lib/errors.ts';
import { cardInclude, toCard } from '../lib/serialize.ts';
import { stripTags } from '../lib/sanitize.ts';
import { publicOrder, shipSchema } from './checkout.ts';

export const account = Router();
account.use(requireUser);

account.get(
  '/me',
  ah(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
    res.json({ user: { id: u!.id, email: u!.email, phone: u!.phone, name: u!.name, isAdmin: req.user!.isAdmin } });
  }),
);

account.patch(
  '/me',
  ah(async (req, res) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(80).optional(), phone: z.string().regex(/^[6-9]\d{9}$/).optional() }), req.body);
    const u = await prisma.user.update({ where: { id: req.user!.id }, data: b });
    res.json({ user: { id: u.id, email: u.email, phone: u.phone, name: u.name, isAdmin: req.user!.isAdmin } });
  }),
);

account.get(
  '/orders',
  ah(async (req, res) => {
    // Also show guest orders placed with the same email before the customer signed up.
    const email = req.user!.email;
    const rows = await prisma.order.findMany({
      where: { OR: [{ userId: req.user!.id }, ...(email ? [{ email, userId: null }] : [])], status: { not: 'PENDING_PAYMENT' } },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ items: rows.map(publicOrder) });
  }),
);

account.get(
  '/addresses',
  ah(async (req, res) => {
    res.json({ items: await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }) });
  }),
);

account.post(
  '/addresses',
  ah(async (req, res) => {
    const b = parse(shipSchema.extend({ isDefault: z.boolean().optional() }), req.body);
    if (b.isDefault) await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    const a = await prisma.address.create({ data: { ...b, userId: req.user!.id } });
    res.json({ address: a });
  }),
);

account.put(
  '/addresses/:id',
  ah(async (req, res) => {
    const b = parse(shipSchema.extend({ isDefault: z.boolean().optional() }), req.body);
    const a = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!a) throw notFound();
    if (b.isDefault) await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    res.json({ address: await prisma.address.update({ where: { id: a.id }, data: b }) });
  }),
);

account.delete(
  '/addresses/:id',
  ah(async (req, res) => {
    await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ ok: true });
  }),
);

account.get(
  '/wishlist',
  ah(async (req, res) => {
    const rows = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id, product: { isActive: true } },
      include: { product: { include: cardInclude } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: rows.map((r) => toCard(r.product)) });
  }),
);

/** Merge local (guest) wishlist ids into the account. */
account.post(
  '/wishlist/merge',
  ah(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.string()).max(100) }), req.body);
    const valid = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
    await prisma.wishlistItem.createMany({ data: valid.map((p) => ({ userId: req.user!.id, productId: p.id })), skipDuplicates: true });
    const all = await prisma.wishlistItem.findMany({ where: { userId: req.user!.id }, select: { productId: true } });
    res.json({ ids: all.map((w) => w.productId) });
  }),
);

account.put(
  '/wishlist/:productId',
  ah(async (req, res) => {
    const p = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!p) throw notFound();
    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user!.id, productId: p.id } },
      create: { userId: req.user!.id, productId: p.id },
      update: {},
    });
    res.json({ ok: true });
  }),
);

account.delete(
  '/wishlist/:productId',
  ah(async (req, res) => {
    await prisma.wishlistItem.deleteMany({ where: { userId: req.user!.id, productId: req.params.productId } });
    res.json({ ok: true });
  }),
);

/** Reviews only after the order containing that saree is delivered. */
account.post(
  '/reviews',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        productId: z.string(),
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().max(80).optional(),
        body: z.string().trim().min(10).max(2000),
        photos: z.array(z.string().startsWith('/uploads/')).max(4).optional(),
      }),
      req.body,
    );
    const email = req.user!.email;
    const item = await prisma.orderItem.findFirst({
      where: {
        productId: b.productId,
        order: { status: 'DELIVERED', OR: [{ userId: req.user!.id }, ...(email ? [{ email }] : [])] },
      },
      select: { orderId: true },
    });
    if (!item) throw badRequest('You can review a saree after it has been delivered to you', 'not_delivered');
    const r = await prisma.review.upsert({
      where: { userId_productId_orderId: { userId: req.user!.id, productId: b.productId, orderId: item.orderId } },
      create: { ...b, title: b.title ? stripTags(b.title) : null, body: stripTags(b.body), userId: req.user!.id, orderId: item.orderId },
      update: { rating: b.rating, title: b.title ? stripTags(b.title) : null, body: stripTags(b.body), photos: b.photos, status: 'PENDING' },
    });
    res.json({ review: { id: r.id, status: r.status } });
  }),
);
