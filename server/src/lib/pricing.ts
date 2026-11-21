import { z } from 'zod';
import { prisma } from '../db.ts';
import { badRequest } from './errors.ts';
import { getSettings, zoneFor } from './settings.ts';

export const stitchingSchema = z.object({
  bust: z.number().min(20).max(60),
  waist: z.number().min(18).max(60),
  shoulder: z.number().min(10).max(24),
  sleeveLength: z.number().min(0).max(25),
  blouseLength: z.number().min(10).max(24),
  neckFront: z.number().min(3).max(12).optional(),
  neckBack: z.number().min(3).max(14).optional(),
  notes: z.string().max(400).optional(),
});

export const lineSchema = z.object({
  productId: z.string().min(1),
  colourId: z.string().min(1),
  qty: z.number().int().min(1).max(10),
  options: z
    .object({
      fallPico: z.boolean().optional(),
      stitching: stitchingSchema.optional(),
    })
    .optional(),
});
export type Line = z.infer<typeof lineSchema>;

export const quoteInputSchema = z.object({
  items: z.array(lineSchema).min(1).max(30),
  couponCode: z.string().trim().max(40).optional(),
  pincode: z.string().regex(/^[1-9]\d{5}$/).optional(),
  paymentMethod: z.enum(['RAZORPAY', 'COD']).optional(),
  giftWrap: z.boolean().optional(),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export type QuoteLine = {
  productId: string;
  colourId: string;
  slug: string;
  name: string;
  colourName: string;
  image: string | null;
  unitPrice: number;
  mrp: number;
  qty: number;
  servicesFee: number;
  lineTotal: number;
  stock: number;
  options: Line['options'];
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  giftWrap: number;
  total: number;
  coupon: { code: string; message: string } | null;
  couponError: string | null;
  cod: { available: boolean; reason?: string };
  delivery: { days: number; zone: string } | null;
  freeShippingAbove: number;
  problems: { productId: string; colourId: string; message: string }[];
};

/**
 * The single source of truth for money. Everything the browser shows is recomputed here
 * from the database — the client never sends prices.
 */
export async function buildQuote(input: QuoteInput, opts: { userId?: string | null; strict?: boolean } = {}): Promise<Quote> {
  const settings = await getSettings();
  const colourIds = [...new Set(input.items.map((i) => i.colourId))];
  const colours = await prisma.productColour.findMany({
    where: { id: { in: colourIds } },
    include: {
      product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
    },
  });
  const byId = new Map(colours.map((c) => [c.id, c]));

  const problems: Quote['problems'] = [];
  const lines: QuoteLine[] = [];
  // Merge duplicate lines of the same colour+options so stock checks are correct.
  const qtyByColour = new Map<string, number>();

  for (const item of input.items) {
    const c = byId.get(item.colourId);
    if (!c || c.productId !== item.productId || !c.product.isActive) {
      problems.push({ productId: item.productId, colourId: item.colourId, message: 'This saree is no longer available' });
      continue;
    }
    const p = c.product;
    const unitPrice = p.price + c.priceDelta;
    let servicesFee = 0;
    if (item.options?.fallPico) {
      if (!p.falloPicoPrice) throw badRequest(`Fall & pico is not offered for ${p.name}`);
      servicesFee += p.falloPicoPrice;
    }
    if (item.options?.stitching) {
      if (!p.stitchingPrice) throw badRequest(`Blouse stitching is not offered for ${p.name}`);
      servicesFee += p.stitchingPrice;
    }
    const wanted = (qtyByColour.get(c.id) ?? 0) + item.qty;
    qtyByColour.set(c.id, wanted);
    if (c.stock <= 0) problems.push({ productId: p.id, colourId: c.id, message: `${p.name} (${c.colourName}) is sold out` });
    else if (wanted > c.stock)
      problems.push({ productId: p.id, colourId: c.id, message: `Only ${c.stock} left of ${p.name} (${c.colourName})` });

    lines.push({
      productId: p.id,
      colourId: c.id,
      slug: p.slug,
      name: p.name,
      colourName: c.colourName,
      image: c.images[0]?.url ?? p.images[0]?.url ?? null,
      unitPrice,
      mrp: p.mrp + c.priceDelta,
      qty: item.qty,
      servicesFee,
      lineTotal: (unitPrice + servicesFee) * item.qty,
      stock: c.stock,
      options: item.options,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // Coupon
  let discount = 0;
  let freeShipFromCoupon = false;
  let coupon: Quote['coupon'] = null;
  let couponError: string | null = null;
  if (input.couponCode) {
    const code = input.couponCode.toUpperCase();
    const cp = await prisma.coupon.findUnique({ where: { code } });
    if (!cp || !cp.isActive) couponError = 'This code is not valid';
    else if (cp.expiresAt && cp.expiresAt < new Date()) couponError = 'This code has expired';
    else if (cp.usageLimit !== null && cp.usedCount >= cp.usageLimit) couponError = 'This code has been fully used';
    else if (subtotal < cp.minCart) couponError = `Add ₹${Math.ceil((cp.minCart - subtotal) / 100).toLocaleString('en-IN')} more to use this code`;
    else {
      if (cp.perUser && opts.userId) {
        const used = await prisma.order.count({
          where: { userId: opts.userId, couponCode: code, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } },
        });
        if (used >= cp.perUser) couponError = 'You have already used this code';
      }
      if (!couponError) {
        if (cp.type === 'PERCENT') {
          discount = Math.floor((subtotal * cp.value) / 100);
          if (cp.maxDiscount) discount = Math.min(discount, cp.maxDiscount);
          coupon = { code, message: `${cp.value}% off applied` };
        } else if (cp.type === 'FLAT') {
          discount = Math.min(cp.value, subtotal);
          coupon = { code, message: `₹${(cp.value / 100).toLocaleString('en-IN')} off applied` };
        } else {
          freeShipFromCoupon = true;
          coupon = { code, message: 'Free shipping applied' };
        }
      }
    }
  }

  const afterDiscount = subtotal - discount;
  let shipping = 0;
  let delivery: Quote['delivery'] = null;
  if (input.pincode) {
    const z = zoneFor(input.pincode, settings.shipping);
    delivery = { days: z.days, zone: z.name };
    shipping = z.rate;
  } else {
    shipping = settings.shipping.defaultRate;
  }
  if (freeShipFromCoupon || afterDiscount >= settings.shipping.freeShippingAbove || lines.length === 0) shipping = 0;

  // COD rules
  let cod: Quote['cod'] = { available: settings.cod.enabled };
  if (!settings.cod.enabled) cod = { available: false, reason: 'Cash on delivery is not available right now' };
  else if (afterDiscount + shipping > settings.cod.maxOrder)
    cod = { available: false, reason: `COD is available for orders up to ₹${(settings.cod.maxOrder / 100).toLocaleString('en-IN')}` };
  else if (input.pincode && settings.cod.blockedPrefixes.some((p) => input.pincode!.startsWith(p)))
    cod = { available: false, reason: 'COD is not available for this pincode' };
  else if (lines.some((l) => l.options?.stitching)) cod = { available: false, reason: 'Stitched blouses need prepaid payment' };

  const codFee = input.paymentMethod === 'COD' && cod.available ? settings.cod.fee : 0;
  const giftWrap = input.giftWrap ? settings.shipping.giftWrapPrice : 0;
  const total = afterDiscount + shipping + codFee + giftWrap;

  if (opts.strict) {
    if (problems.length) throw badRequest(problems[0].message, 'stock', problems);
    if (input.couponCode && couponError) throw badRequest(couponError, 'coupon');
    if (input.paymentMethod === 'COD' && !cod.available) throw badRequest(cod.reason ?? 'COD not available', 'cod');
    if (!lines.length) throw badRequest('Your bag is empty');
  }

  return {
    lines,
    subtotal,
    discount,
    shipping,
    codFee,
    giftWrap,
    total,
    coupon,
    couponError,
    cod,
    delivery,
    freeShippingAbove: settings.shipping.freeShippingAbove,
    problems,
  };
}
