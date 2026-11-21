import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma, prisma } from '../../db.ts';
import { ah, badRequest, notFound, parse } from '../../lib/errors.ts';
import { cleanHtml } from '../../lib/sanitize.ts';
import { storeImage } from '../../lib/storage.ts';
import { bump } from '../../lib/cache.ts';

export const adminCatalog = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const rupeesToPaise = z.number().min(0).max(10_000_000).transform((r) => Math.round(r * 100));

const colourInput = z.object({
  id: z.string().optional(),
  colourName: z.string().trim().min(1).max(40),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  family: z.string().max(20).optional().nullable(),
  stock: z.number().int().min(0).max(100000),
  priceDelta: z.number().min(-1_000_000).max(1_000_000).transform((r) => Math.round(r * 100)).default(0),
});

const imageInput = z.object({
  id: z.string().optional(),
  url: z.string().max(1024).regex(/^(\/uploads\/|https:\/\/)/, 'Images must be uploaded first'),
  alt: z.string().max(160).optional().nullable(),
  tag: z.enum(['MODEL', 'DETAIL', 'FLATLAY', 'OTHER']).default('OTHER'),
  colourIndex: z.number().int().min(0).optional().nullable(), // links to colours[] by position
});

const productInput = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(90).optional(),
  description: z.string().max(20000).default(''),
  fabric: z.string().trim().min(2).max(40),
  weave: z.string().max(60).optional().nullable(),
  work: z.string().max(30).optional().nullable(),
  border: z.string().max(120).optional().nullable(),
  pallu: z.string().max(120).optional().nullable(),
  origin: z.string().max(80).optional().nullable(),
  care: z.string().max(4000).optional().nullable(),
  occasions: z.array(z.string().max(30)).max(10).default([]),
  lengthInfo: z.string().max(80).default('Saree 5.5 m + blouse piece 0.8 m'),
  blouseIncluded: z.boolean().default(true),
  handloomMark: z.boolean().default(false),
  price: rupeesToPaise,
  mrp: rupeesToPaise,
  falloPicoPrice: rupeesToPaise.default(0),
  stitchingPrice: rupeesToPaise.default(0),
  isActive: z.boolean().default(true),
  isPinned: z.boolean().default(false),
  categoryId: z.string().optional().nullable(),
  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(170).optional().nullable(),
  colours: z.array(colourInput).min(1, 'Add at least one colour').max(20),
  images: z.array(imageInput).max(40).default([]),
  collectionIds: z.array(z.string()).max(30).default([]),
});

const adminProductInclude = {
  colours: { orderBy: { sortOrder: 'asc' as const } },
  images: { orderBy: { sortOrder: 'asc' as const } },
  collections: true,
  category: true,
} satisfies Prisma.ProductInclude;

function toAdmin(p: Prisma.ProductGetPayload<{ include: typeof adminProductInclude }>) {
  const colourIdx = new Map(p.colours.map((c, i) => [c.id, i]));
  return {
    ...p,
    price: p.price / 100,
    mrp: p.mrp / 100,
    falloPicoPrice: p.falloPicoPrice / 100,
    stitchingPrice: p.stitchingPrice / 100,
    colours: p.colours.map((c) => ({ ...c, priceDelta: c.priceDelta / 100 })),
    images: p.images.map((i) => ({ ...i, colourIndex: i.colourId ? (colourIdx.get(i.colourId) ?? null) : null })),
    collectionIds: p.collections.map((c) => c.collectionId),
  };
}

adminCatalog.get(
  '/products',
  ah(async (req, res) => {
    const q = parse(z.object({ q: z.string().optional(), status: z.enum(['all', 'active', 'hidden', 'low']).default('all') }), req.query);
    const where: Prisma.ProductWhereInput = {
      ...(q.q ? { OR: [{ name: { contains: q.q } }, { slug: { contains: q.q } }, { fabric: { contains: q.q } }] } : {}),
      ...(q.status === 'active' ? { isActive: true } : q.status === 'hidden' ? { isActive: false } : {}),
      ...(q.status === 'low' ? { colours: { some: { stock: { lte: 2 } } } } : {}),
    };
    const rows = await prisma.product.findMany({
      where,
      include: { colours: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({
      items: rows.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        fabric: p.fabric,
        price: p.price / 100,
        mrp: p.mrp / 100,
        isActive: p.isActive,
        isPinned: p.isPinned,
        sortOrder: p.sortOrder,
        stock: p.colours.reduce((s, c) => s + c.stock, 0),
        colours: p.colours.map((c) => ({ id: c.id, name: c.colourName, hex: c.hex, stock: c.stock })),
        image: p.images[0]?.url ?? null,
      })),
    });
  }),
);

adminCatalog.get(
  '/products/:id',
  ah(async (req, res) => {
    const p = await prisma.product.findUnique({ where: { id: req.params.id }, include: adminProductInclude });
    if (!p) throw notFound();
    res.json({ product: toAdmin(p) });
  }),
);

async function uniqueSlug(base: string, exceptId?: string) {
  let slug = slugify(base) || 'saree';
  for (let i = 2; ; i++) {
    const hit = await prisma.product.findUnique({ where: { slug } });
    if (!hit || hit.id === exceptId) return slug;
    slug = `${slugify(base)}-${i}`;
  }
}

async function saveProduct(id: string | null, raw: unknown) {
  const b = parse(productInput, raw);
  if (b.mrp < b.price) throw badRequest('MRP cannot be lower than the selling price');
  const slug = await uniqueSlug(b.slug || b.name, id ?? undefined);
  const base = {
    name: b.name,
    slug,
    description: cleanHtml(b.description),
    fabric: b.fabric,
    weave: b.weave,
    work: b.work,
    border: b.border,
    pallu: b.pallu,
    origin: b.origin,
    care: b.care ? cleanHtml(b.care) : null,
    occasions: b.occasions,
    lengthInfo: b.lengthInfo,
    blouseIncluded: b.blouseIncluded,
    handloomMark: b.handloomMark,
    price: b.price,
    mrp: b.mrp,
    falloPicoPrice: b.falloPicoPrice,
    stitchingPrice: b.stitchingPrice,
    isActive: b.isActive,
    isPinned: b.isPinned,
    categoryId: b.categoryId || null,
    seoTitle: b.seoTitle,
    seoDescription: b.seoDescription,
  };

  const productId = await prisma.$transaction(async (tx) => {
    const p = id ? await tx.product.update({ where: { id }, data: base }) : await tx.product.create({ data: base });

    // Colours: update existing by id, create new, delete removed (orders keep their snapshot).
    const existing = await tx.productColour.findMany({ where: { productId: p.id } });
    const keep = new Set(b.colours.filter((c) => c.id).map((c) => c.id!));
    const removed = existing.filter((c) => !keep.has(c.id)).map((c) => c.id);
    if (removed.length) await tx.productColour.deleteMany({ where: { id: { in: removed } } });
    const colourIds: string[] = [];
    for (const [i, c] of b.colours.entries()) {
      const data = { colourName: c.colourName, hex: c.hex.toUpperCase(), family: c.family ?? null, stock: c.stock, priceDelta: c.priceDelta, sortOrder: i };
      if (c.id && existing.some((e) => e.id === c.id)) {
        await tx.productColour.update({ where: { id: c.id }, data });
        colourIds.push(c.id);
      } else {
        const created = await tx.productColour.create({ data: { ...data, productId: p.id } });
        colourIds.push(created.id);
      }
    }

    // Images: replace order + metadata wholesale (first = cover).
    await tx.productImage.deleteMany({ where: { productId: p.id } });
    if (b.images.length) {
      await tx.productImage.createMany({
        data: b.images.map((img, i) => ({
          productId: p.id,
          url: img.url,
          alt: img.alt || b.name,
          tag: img.tag,
          sortOrder: i,
          colourId: img.colourIndex != null ? (colourIds[img.colourIndex] ?? null) : null,
        })),
      });
    }

    await tx.collectionProduct.deleteMany({ where: { productId: p.id } });
    if (b.collectionIds.length) {
      await tx.collectionProduct.createMany({ data: b.collectionIds.map((cid) => ({ collectionId: cid, productId: p.id })), skipDuplicates: true });
    }
    return p.id;
  });
  bump();
  const full = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: adminProductInclude });
  return toAdmin(full);
}

adminCatalog.post('/products', ah(async (req, res) => res.json({ product: await saveProduct(null, req.body) })));
adminCatalog.put('/products/:id', ah(async (req, res) => res.json({ product: await saveProduct(req.params.id, req.body) })));

adminCatalog.post(
  '/products/:id/duplicate',
  ah(async (req, res) => {
    const p = await prisma.product.findUnique({ where: { id: req.params.id }, include: adminProductInclude });
    if (!p) throw notFound();
    const a = toAdmin(p);
    const copy = await saveProduct(null, {
      ...a,
      name: `${p.name} (copy)`,
      slug: undefined,
      isActive: false,
      colours: a.colours.map(({ colourName, hex, family, stock, priceDelta }) => ({ colourName, hex, family, stock, priceDelta })),
      images: a.images.map(({ url, alt, tag, colourIndex }) => ({ url, alt, tag, colourIndex })),
    });
    res.json({ product: copy });
  }),
);

adminCatalog.patch(
  '/products/:id',
  ah(async (req, res) => {
    const b = parse(z.object({ isActive: z.boolean().optional(), isPinned: z.boolean().optional(), sortOrder: z.number().int().optional() }), req.body);
    await prisma.product.update({ where: { id: req.params.id }, data: b });
    bump();
    res.json({ ok: true });
  }),
);

adminCatalog.delete(
  '/products/:id',
  ah(async (req, res) => {
    await prisma.product.delete({ where: { id: req.params.id } });
    bump();
    res.json({ ok: true });
  }),
);

adminCatalog.post(
  '/products/reorder',
  ah(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.string()).max(1000) }), req.body);
    await prisma.$transaction(ids.map((id, i) => prisma.product.update({ where: { id }, data: { sortOrder: i } })));
    bump();
    res.json({ ok: true });
  }),
);

/** Bulk price / stock edit from the products table. */
adminCatalog.post(
  '/products/bulk',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        products: z.array(z.object({ id: z.string(), price: z.number().min(0).optional(), mrp: z.number().min(0).optional() })).max(500).default([]),
        colours: z.array(z.object({ id: z.string(), stock: z.number().int().min(0) })).max(2000).default([]),
        percent: z.object({ ids: z.array(z.string()), change: z.number().min(-90).max(300) }).optional(),
      }),
      req.body,
    );
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const p of b.products) {
      ops.push(
        prisma.product.update({
          where: { id: p.id },
          data: { ...(p.price !== undefined ? { price: Math.round(p.price * 100) } : {}), ...(p.mrp !== undefined ? { mrp: Math.round(p.mrp * 100) } : {}) },
        }),
      );
    }
    for (const c of b.colours) ops.push(prisma.productColour.update({ where: { id: c.id }, data: { stock: c.stock } }));
    await prisma.$transaction(ops);
    if (b.percent) {
      const rows = await prisma.product.findMany({ where: { id: { in: b.percent.ids } } });
      await prisma.$transaction(
        rows.map((r) => prisma.product.update({ where: { id: r.id }, data: { price: Math.round((r.price * (100 + b.percent!.change)) / 100 / 100) * 100 } })),
      );
    }
    bump();
    res.json({ ok: true });
  }),
);

/** Upload one or many photos. Returns the stored URLs (main size) ready for the product form. */
adminCatalog.post(
  '/media',
  upload.array('files', 20),
  ah(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw badRequest('Choose at least one photo');
    const keepOriginal = req.body.keepOriginal === 'true';
    const out = [];
    for (const f of files) {
      const s = await storeImage(f.buffer, { keepOriginalQuality: keepOriginal });
      await prisma.mediaFile.create({
        data: { key: s.key, original: s.original, thumb: s.thumb, main: s.main, zoom: s.zoom, width: s.width, height: s.height, bytes: s.bytes, mime: s.mime },
      });
      out.push({ url: s.main, thumb: s.thumb, original: s.original, width: s.width, height: s.height, bytes: s.bytes, savedBytes: s.savedBytes, name: f.originalname });
    }
    res.json({ files: out });
  }),
);

adminCatalog.get(
  '/media',
  ah(async (_req, res) => {
    const rows = await prisma.mediaFile.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ items: rows });
  }),
);

// ---- Categories
const categoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z.string().max(60).optional(),
  kind: z.enum(['fabric', 'occasion', 'work']).default('fabric'),
  image: z.string().max(1024).optional().nullable(),
  sortOrder: z.number().int().default(0),
  showInNav: z.boolean().default(true),
});
adminCatalog.get('/categories', ah(async (_req, res) => res.json({ items: await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }) })));
adminCatalog.post(
  '/categories',
  ah(async (req, res) => {
    const b = parse(categoryInput, req.body);
    const c = await prisma.category.create({ data: { ...b, slug: slugify(b.slug || b.name) } });
    bump();
    res.json({ category: c });
  }),
);
adminCatalog.put(
  '/categories/:id',
  ah(async (req, res) => {
    const b = parse(categoryInput, req.body);
    const c = await prisma.category.update({ where: { id: req.params.id }, data: { ...b, slug: slugify(b.slug || b.name) } });
    bump();
    res.json({ category: c });
  }),
);
adminCatalog.delete(
  '/categories/:id',
  ah(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    bump();
    res.json({ ok: true });
  }),
);

// ---- Collections
const collectionInput = z.object({
  title: z.string().trim().min(1).max(80),
  handle: z.string().max(80).optional(),
  description: z.string().max(4000).optional().nullable(),
  image: z.string().max(1024).optional().nullable(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  isRuleBased: z.boolean().default(false),
  rules: z
    .object({
      fabric: z.array(z.string()).optional(),
      occasion: z.array(z.string()).optional(),
      work: z.array(z.string()).optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    })
    .optional()
    .nullable(),
  showInNav: z.boolean().default(true),
  isEditorial: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  productIds: z.array(z.string()).max(500).optional(),
});

adminCatalog.get(
  '/collections',
  ah(async (_req, res) => {
    const rows = await prisma.collection.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } }, products: { orderBy: { sortOrder: 'asc' }, select: { productId: true } } } });
    res.json({ items: rows.map((r) => ({ ...r, productIds: r.products.map((p) => p.productId), products: undefined })) });
  }),
);

async function saveCollection(id: string | null, raw: unknown) {
  const b = parse(collectionInput, raw);
  const { productIds, rules, ...rest } = b;
  const data = {
    ...rest,
    description: rest.description ? cleanHtml(rest.description) : null,
    handle: slugify(b.handle || b.title),
    rules: rules ? (rules as Prisma.InputJsonValue) : Prisma.DbNull,
  };
  const c = id ? await prisma.collection.update({ where: { id }, data }) : await prisma.collection.create({ data });
  if (productIds) {
    await prisma.$transaction([
      prisma.collectionProduct.deleteMany({ where: { collectionId: c.id } }),
      prisma.collectionProduct.createMany({ data: productIds.map((pid, i) => ({ collectionId: c.id, productId: pid, sortOrder: i })), skipDuplicates: true }),
    ]);
  }
  bump();
  return c;
}
adminCatalog.post('/collections', ah(async (req, res) => res.json({ collection: await saveCollection(null, req.body) })));
adminCatalog.put('/collections/:id', ah(async (req, res) => res.json({ collection: await saveCollection(req.params.id, req.body) })));
adminCatalog.delete(
  '/collections/:id',
  ah(async (req, res) => {
    await prisma.collection.delete({ where: { id: req.params.id } });
    bump();
    res.json({ ok: true });
  }),
);
