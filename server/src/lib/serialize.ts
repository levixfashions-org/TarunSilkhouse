import type { Prisma } from '../db.ts';

export const cardInclude = {
  images: { orderBy: { sortOrder: 'asc' as const }, take: 4 },
  colours: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

const NEW_DAYS = 30;

export function toCard(p: CardRow) {
  const stock = p.colours.reduce((s, c) => s + c.stock, 0);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    fabric: p.fabric,
    work: p.work,
    price: p.price,
    mrp: p.mrp,
    handloomMark: p.handloomMark,
    isNew: Date.now() - p.createdAt.getTime() < NEW_DAYS * 86400_000,
    soldOut: stock <= 0,
    lowStock: stock > 0 && stock <= 2 ? stock : null,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? p.name, tag: i.tag, colourId: i.colourId })),
    colours: p.colours.map((c) => ({ id: c.id, name: c.colourName, hex: c.hex, inStock: c.stock > 0 })),
  };
}

export const productInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  colours: { orderBy: { sortOrder: 'asc' as const } },
  category: true,
} satisfies Prisma.ProductInclude;

type FullRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function toProduct(p: FullRow) {
  return {
    ...toCard(p),
    description: p.description,
    weave: p.weave,
    border: p.border,
    pallu: p.pallu,
    origin: p.origin,
    care: p.care,
    occasions: (p.occasions as string[]) ?? [],
    lengthInfo: p.lengthInfo,
    blouseIncluded: p.blouseIncluded,
    falloPicoPrice: p.falloPicoPrice,
    stitchingPrice: p.stitchingPrice,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    category: p.category ? { name: p.category.name, slug: p.category.slug } : null,
    colours: p.colours.map((c) => ({
      id: c.id,
      name: c.colourName,
      hex: c.hex,
      inStock: c.stock > 0,
      stock: c.stock <= 3 ? c.stock : null, // only reveal exact numbers when scarce
      priceDelta: c.priceDelta,
    })),
  };
}
