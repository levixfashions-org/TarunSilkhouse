import { Router } from 'express';
import { z } from 'zod';
import { Prisma, prisma } from '../../db.ts';
import { bump } from '../../lib/cache.ts';
import { ah, notFound, parse } from '../../lib/errors.ts';
import { cleanHtml } from '../../lib/sanitize.ts';
import { getSettings, saveSetting } from '../../lib/settings.ts';
import { slugify } from './catalog.ts';

export const adminStore = Router();

// ---- Discounts
const couponInput = z.object({
  code: z.string().trim().min(3).max(30).transform((s) => s.toUpperCase().replace(/\s+/g, '')),
  type: z.enum(['PERCENT', 'FLAT', 'FREE_SHIPPING']),
  value: z.number().min(0), // percent, or rupees for FLAT
  minCart: z.number().min(0).default(0), // rupees
  maxDiscount: z.number().min(0).optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  perUser: z.number().int().min(1).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
});
function couponData(b: z.infer<typeof couponInput>) {
  return {
    code: b.code,
    type: b.type,
    value: b.type === 'FLAT' ? Math.round(b.value * 100) : Math.min(100, Math.round(b.value)),
    minCart: Math.round(b.minCart * 100),
    maxDiscount: b.maxDiscount ? Math.round(b.maxDiscount * 100) : null,
    usageLimit: b.usageLimit ?? null,
    perUser: b.perUser ?? null,
    expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
    isActive: b.isActive,
  };
}
adminStore.get('/coupons', ah(async (_req, res) => res.json({ items: await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }) })));
adminStore.post('/coupons', ah(async (req, res) => res.json({ coupon: await prisma.coupon.create({ data: couponData(parse(couponInput, req.body)) }) })));
adminStore.put(
  '/coupons/:id',
  ah(async (req, res) => res.json({ coupon: await prisma.coupon.update({ where: { id: req.params.id }, data: couponData(parse(couponInput, req.body)) }) })),
);
adminStore.delete(
  '/coupons/:id',
  ah(async (req, res) => {
    await prisma.coupon.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// ---- Reviews moderation
adminStore.get(
  '/reviews',
  ah(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }), req.query);
    const rows = await prisma.review.findMany({
      where: { status },
      include: { product: { select: { name: true, slug: true } }, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ items: rows });
  }),
);
adminStore.patch(
  '/reviews/:id',
  ah(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']) }), req.body);
    await prisma.review.update({ where: { id: req.params.id }, data: b });
    bump();
    res.json({ ok: true });
  }),
);

// ---- Settings
adminStore.get('/settings', ah(async (_req, res) => res.json(await getSettings())));
adminStore.put(
  '/settings/:key',
  ah(async (req, res) => {
    const { key } = parse(z.object({ key: z.enum(['store', 'shipping', 'cod']) }), req.params);
    const v = await saveSetting(key, req.body);
    bump();
    res.json(v);
  }),
);

// ---- Homepage sections
const sectionInput = z.object({
  type: z.string().min(2).max(30),
  title: z.string().max(120).optional().nullable(),
  data: z.record(z.string(), z.unknown()).default({}),
  isVisible: z.boolean().default(true),
});
adminStore.get('/home', ah(async (_req, res) => res.json({ items: await prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } }) })));
adminStore.post(
  '/home',
  ah(async (req, res) => {
    const b = parse(sectionInput, req.body);
    const max = await prisma.homeSection.aggregate({ _max: { sortOrder: true } });
    const s = await prisma.homeSection.create({ data: { ...b, data: b.data as Prisma.InputJsonValue, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    bump();
    res.json({ section: s });
  }),
);
adminStore.put(
  '/home/:id',
  ah(async (req, res) => {
    const b = parse(sectionInput, req.body);
    const s = await prisma.homeSection.update({ where: { id: req.params.id }, data: { ...b, data: b.data as Prisma.InputJsonValue } });
    bump();
    res.json({ section: s });
  }),
);
adminStore.delete(
  '/home/:id',
  ah(async (req, res) => {
    await prisma.homeSection.delete({ where: { id: req.params.id } });
    bump();
    res.json({ ok: true });
  }),
);
adminStore.post(
  '/home/reorder',
  ah(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.string()).max(100) }), req.body);
    await prisma.$transaction(ids.map((id, i) => prisma.homeSection.update({ where: { id }, data: { sortOrder: i } })));
    bump();
    res.json({ ok: true });
  }),
);

// ---- Content pages
const pageInput = z.object({ title: z.string().trim().min(1).max(120), slug: z.string().max(80).optional(), body: z.string().max(200000), seoTitle: z.string().max(70).optional().nullable() });
adminStore.get('/pages', ah(async (_req, res) => res.json({ items: await prisma.page.findMany({ orderBy: { title: 'asc' } }) })));
adminStore.put(
  '/pages/:slug',
  ah(async (req, res) => {
    const b = parse(pageInput, req.body);
    const slug = slugify(req.params.slug);
    const data = { title: b.title, body: cleanHtml(b.body), seoTitle: b.seoTitle ?? null };
    const p = await prisma.page.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    bump();
    res.json({ page: p });
  }),
);
adminStore.delete(
  '/pages/:slug',
  ah(async (req, res) => {
    const p = await prisma.page.findUnique({ where: { slug: req.params.slug } });
    if (!p) throw notFound();
    await prisma.page.delete({ where: { slug: p.slug } });
    res.json({ ok: true });
  }),
);

// ---- Subscribers export
adminStore.get(
  '/subscribers.csv',
  ah(async (_req, res) => {
    const rows = await prisma.subscriber.findMany({ orderBy: { createdAt: 'desc' } });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
    res.send(['email,joined', ...rows.map((r) => `${r.email},${r.createdAt.toISOString()}`)].join('\n'));
  }),
);
