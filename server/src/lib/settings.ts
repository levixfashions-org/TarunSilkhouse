import { z } from 'zod';
import { prisma } from '../db.ts';

/** Store-wide settings, editable in Admin → Settings. Stored as one JSON row per key. */
export const storeSettingsSchema = z.object({
  storeName: z.string().default('Tarun Silks'),
  tagline: z.string().default('Six yards of poetry'),
  email: z.string().default('hello@tarunsilks.in'),
  whatsapp: z.string().default('919999999999'),
  phone: z.string().default('+91 99999 99999'),
  instagram: z.string().default('tarunsilks'),
  facebook: z.string().default(''),
  youtube: z.string().default(''),
  address: z.string().default(''),
  mapUrl: z.string().default(''),
  gstin: z.string().default(''),
  logoUrl: z.string().default(''),
  announcement: z.string().default('Free shipping above ₹2,999  ·  Easy 7-day returns  ·  Handloom-mark certified weaves'),
  announcementVisible: z.boolean().default(true),
  gaId: z.string().default(''),
  metaPixelId: z.string().default(''),
});

export const shippingSettingsSchema = z.object({
  freeShippingAbove: z.number().int().default(299900), // paise
  defaultRate: z.number().int().default(9900),
  /** Zones matched by pincode prefix (longest prefix wins). */
  zones: z
    .array(z.object({ name: z.string(), prefixes: z.array(z.string()), rate: z.number().int(), days: z.number().int() }))
    .default([
      { name: 'Telangana & AP', prefixes: ['50', '51', '52', '53'], rate: 4900, days: 2 },
      { name: 'South India', prefixes: ['56', '57', '58', '59', '60', '61', '62', '63', '64', '67', '68', '69'], rate: 7900, days: 4 },
      { name: 'Metros', prefixes: ['11', '40', '41', '70'], rate: 9900, days: 5 },
      { name: 'North East', prefixes: ['78', '79'], rate: 14900, days: 8 },
    ]),
  defaultDays: z.number().int().default(6),
  giftWrapPrice: z.number().int().default(9900),
  /** Prices include GST; this rate is only shown on invoices. */
  gstPercent: z.number().default(5),
});

export const codSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  fee: z.number().int().default(4900),
  maxOrder: z.number().int().default(1500000), // ₹15,000
  blockedPrefixes: z.array(z.string()).default(['79', '19']),
});

const schemas = {
  store: storeSettingsSchema,
  shipping: shippingSettingsSchema,
  cod: codSettingsSchema,
} as const;
export type SettingKey = keyof typeof schemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof schemas)[K]> };

let cache: { at: number; value: Settings } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(schemas) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const value = {
    store: storeSettingsSchema.parse(map.get('store') ?? {}),
    shipping: shippingSettingsSchema.parse(map.get('shipping') ?? {}),
    cod: codSettingsSchema.parse(map.get('cod') ?? {}),
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSetting<K extends SettingKey>(key: K, value: unknown): Promise<Settings[K]> {
  const parsed = schemas[key].parse(value) as Settings[K];
  await prisma.setting.upsert({ where: { key }, create: { key, value: parsed as object }, update: { value: parsed as object } });
  cache = null;
  return parsed;
}

export function zoneFor(pincode: string, s: Settings['shipping']) {
  let best: { rate: number; days: number; name: string } | null = null;
  let bestLen = 0;
  for (const z of s.zones) {
    for (const p of z.prefixes) {
      if (pincode.startsWith(p) && p.length > bestLen) {
        best = z;
        bestLen = p.length;
      }
    }
  }
  return best ?? { rate: s.defaultRate, days: s.defaultDays, name: 'Rest of India' };
}
