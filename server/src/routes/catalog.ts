import { Router } from 'express';
import { z } from 'zod';
import { Prisma, prisma } from '../db.ts';
import { ah, notFound, parse } from '../lib/errors.ts';
import { cardInclude, productInclude, toCard, toProduct } from '../lib/serialize.ts';
import { getSettings } from '../lib/settings.ts';
import { devAuthBypass, env } from '../env.ts';

export const catalog = Router();

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  collection: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  fabric: csv,
  occasion: csv,
  colour: csv,
  work: csv,
  min: z.coerce.number().int().min(0).optional(), // rupees
  max: z.coerce.number().int().min(0).optional(),
  blouse: z.enum(['1']).optional(),
  inStock: z.enum(['1']).optional(),
  sort: z.enum(['new', 'price-asc', 'price-desc', 'popular', 'featured']).default('featured'),
  page: z.coerce.number().int().min(1).max(200).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

async function collectionWhere(handle: string): Promise<Prisma.ProductWhereInput | null> {
  const c = await prisma.collection.findUnique({ where: { handle } });
  if (!c) return null;
  if (!c.isRuleBased) return { collections: { some: { collectionId: c.id } } };
  const r = (c.rules ?? {}) as { fabric?: string[]; occasion?: string[]; maxPrice?: number; minPrice?: number; work?: string[] };
  const and: Prisma.ProductWhereInput[] = [];
  if (r.fabric?.length) and.push({ fabric: { in: r.fabric } });
  if (r.work?.length) and.push({ work: { in: r.work } });
  if (r.occasion?.length) and.push({ OR: r.occasion.map((o) => ({ occasions: { array_contains: [o] } })) });
  if (r.maxPrice) and.push({ price: { lte: r.maxPrice } });
  if (r.minPrice) and.push({ price: { gte: r.minPrice } });
  return { AND: and };
}

catalog.get(
  '/products',
  ah(async (req, res) => {
    const q = parse(listQuery, req.query);
    const and: Prisma.ProductWhereInput[] = [{ isActive: true }];
    if (q.collection) {
      const w = await collectionWhere(q.collection);
      if (!w) throw notFound('Collection not found');
      and.push(w);
    }
    if (q.category) and.push({ category: { slug: q.category } });
    if (q.q) {
      and.push({
        OR: [{ name: { contains: q.q } }, { fabric: { contains: q.q } }, { weave: { contains: q.q } }, { description: { contains: q.q } }],
      });
    }
    if (q.fabric.length) and.push({ fabric: { in: q.fabric } });
    if (q.work.length) and.push({ work: { in: q.work } });
    if (q.occasion.length) and.push({ OR: q.occasion.map((o) => ({ occasions: { array_contains: [o] } })) });
    if (q.colour.length) and.push({ colours: { some: { family: { in: q.colour } } } });
    if (q.min !== undefined) and.push({ price: { gte: q.min * 100 } });
    if (q.max !== undefined) and.push({ price: { lte: q.max * 100 } });
    if (q.blouse) and.push({ blouseIncluded: true });
    if (q.inStock) and.push({ colours: { some: { stock: { gt: 0 } } } });

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      q.sort === 'new'
        ? [{ createdAt: 'desc' }]
        : q.sort === 'price-asc'
          ? [{ price: 'asc' }]
          : q.sort === 'price-desc'
            ? [{ price: 'desc' }]
            : q.sort === 'popular'
              ? [{ popularity: 'desc' }]
              : [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }];

    const where = { AND: and };
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({ where, orderBy, include: cardInclude, skip: (q.page - 1) * q.limit, take: q.limit }),
    ]);
    res.json({ items: rows.map(toCard), total, page: q.page, pages: Math.ceil(total / q.limit) });
  }),
);

/** Facet values for the filter sheet. */
catalog.get(
  '/facets',
  ah(async (_req, res) => {
    const [fabrics, works, colours, price] = await Promise.all([
      prisma.product.groupBy({ by: ['fabric'], where: { isActive: true }, _count: true }),
      prisma.product.groupBy({ by: ['work'], where: { isActive: true, work: { not: null } }, _count: true }),
      prisma.productColour.groupBy({ by: ['family'], where: { family: { not: null }, product: { isActive: true } }, _count: true }),
      prisma.product.aggregate({ where: { isActive: true }, _min: { price: true }, _max: { price: true } }),
    ]);
    res.json({
      fabrics: fabrics.map((f) => ({ value: f.fabric, count: f._count })),
      works: works.map((w) => ({ value: w.work, count: w._count })),
      colours: colours.map((c) => ({ value: c.family, count: c._count })),
      occasions: ['wedding', 'festive', 'office', 'party', 'everyday', 'gifting'],
      price: { min: Math.floor((price._min.price ?? 0) / 100), max: Math.ceil((price._max.price ?? 0) / 100) },
    });
  }),
);

catalog.get(
  '/products/by-ids',
  ah(async (req, res) => {
    const ids = parse(z.object({ ids: csv }), req.query).ids.slice(0, 48);
    if (!ids.length) return res.json({ items: [] });
    const rows = await prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, include: cardInclude });
    const map = new Map(rows.map((r) => [r.id, r]));
    res.json({ items: ids.map((id) => map.get(id)).filter(Boolean).map((r) => toCard(r!)) });
  }),
);

catalog.get(
  '/products/:slug',
  ah(async (req, res) => {
    const p = await prisma.product.findUnique({ where: { slug: req.params.slug }, include: productInclude });
    if (!p || (!p.isActive && !req.user?.isAdmin)) throw notFound('This saree is not available');
    const [related, sameOccasion, reviews, agg] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, id: { not: p.id }, fabric: p.fabric },
        include: cardInclude,
        take: 8,
        orderBy: { popularity: 'desc' },
      }),
      prisma.product.findMany({
        where: { isActive: true, id: { not: p.id }, fabric: { not: p.fabric } },
        include: cardInclude,
        take: 4,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.findMany({
        where: { productId: p.id, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true } } },
      }),
      prisma.review.aggregate({ where: { productId: p.id, status: 'APPROVED' }, _avg: { rating: true }, _count: true }),
    ]);
    void prisma.product.update({ where: { id: p.id }, data: { popularity: { increment: 1 } } }).catch(() => {});
    res.json({
      product: toProduct(p),
      related: related.map(toCard),
      completeTheLook: sameOccasion.map(toCard),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        photos: (r.photos as string[] | null) ?? [],
        name: r.user.name?.split(' ')[0] ?? 'Customer',
        createdAt: r.createdAt,
      })),
      rating: { avg: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, count: agg._count },
    });
  }),
);

catalog.get(
  '/search/suggest',
  ah(async (req, res) => {
    const { q } = parse(z.object({ q: z.string().trim().min(1).max(60) }), req.query);
    const [products, collections] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, OR: [{ name: { contains: q } }, { fabric: { contains: q } }, { weave: { contains: q } }] },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        take: 6,
        orderBy: { popularity: 'desc' },
      }),
      prisma.collection.findMany({ where: { title: { contains: q } }, take: 3 }),
    ]);
    res.json({
      products: products.map((p) => ({ slug: p.slug, name: p.name, price: p.price, fabric: p.fabric, image: p.images[0]?.url ?? null })),
      collections: collections.map((c) => ({ handle: c.handle, title: c.title })),
    });
  }),
);

catalog.get(
  '/collections',
  ah(async (_req, res) => {
    const rows = await prisma.collection.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ items: rows.map((c) => ({ handle: c.handle, title: c.title, image: c.image, accent: c.accent, isEditorial: c.isEditorial, showInNav: c.showInNav, description: c.description })) });
  }),
);

catalog.get(
  '/collections/:handle',
  ah(async (req, res) => {
    const c = await prisma.collection.findUnique({ where: { handle: req.params.handle } });
    if (!c) throw notFound('Collection not found');
    res.json({ collection: { handle: c.handle, title: c.title, description: c.description, image: c.image, accent: c.accent, isEditorial: c.isEditorial } });
  }),
);

catalog.get(
  '/pages/:slug',
  ah(async (req, res) => {
    const p = await prisma.page.findUnique({ where: { slug: req.params.slug } });
    if (!p) throw notFound('Page not found');
    res.json({ page: { slug: p.slug, title: p.title, body: p.body, seoTitle: p.seoTitle, updatedAt: p.updatedAt } });
  }),
);

/** Everything the shell needs in one request: store info, menu, homepage blocks. */
catalog.get(
  '/bootstrap',
  ah(async (_req, res) => {
    const [settings, collections, categories, sections] = await Promise.all([
      getSettings(),
      prisma.collection.findMany({ where: { showInNav: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.category.findMany({ where: { showInNav: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.homeSection.findMany({ where: { isVisible: true }, orderBy: { sortOrder: 'asc' } }),
    ]);
    res.set('Cache-Control', 'no-cache');
    res.json({
      store: settings.store,
      shipping: { freeShippingAbove: settings.shipping.freeShippingAbove, giftWrapPrice: settings.shipping.giftWrapPrice },
      cod: { enabled: settings.cod.enabled, fee: settings.cod.fee },
      collections: collections.map((c) => ({ handle: c.handle, title: c.title, image: c.image, accent: c.accent, isEditorial: c.isEditorial })),
      categories: categories.map((c) => ({ slug: c.slug, name: c.name, kind: c.kind, image: c.image })),
      home: sections.map((s) => ({ id: s.id, type: s.type, title: s.title, data: s.data })),
      // Public web config (safe to expose). Lets you change Firebase/Razorpay keys without rebuilding.
      firebase: env.FIREBASE_WEB_API_KEY
        ? { apiKey: env.FIREBASE_WEB_API_KEY, authDomain: env.FIREBASE_AUTH_DOMAIN, projectId: env.FIREBASE_PROJECT_ID, appId: env.FIREBASE_APP_ID }
        : null,
      razorpayKeyId: env.RAZORPAY_KEY_ID ?? null,
      devAuth: devAuthBypass,
    });
  }),
);
