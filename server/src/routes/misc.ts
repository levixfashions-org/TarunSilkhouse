import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { env } from '../env.ts';
import { ah, badRequest, parse } from '../lib/errors.ts';
import { log } from '../lib/log.ts';
import { getSettings, zoneFor } from '../lib/settings.ts';

export const misc = Router();

const pinCache = new Map<string, { city: string; state: string } | null>();

async function lookupPincode(pin: string) {
  if (pinCache.has(pin)) return pinCache.get(pin)!;
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(4000) });
    const j = (await r.json()) as { Status: string; PostOffice?: { District: string; State: string }[] }[];
    const po = j[0]?.Status === 'Success' ? j[0].PostOffice?.[0] : undefined;
    const val = po ? { city: po.District, state: po.State } : null;
    pinCache.set(pin, val);
    return val;
  } catch {
    return null; // service down — let the customer type city/state
  }
}

misc.get(
  '/pincode/:pin',
  ah(async (req, res) => {
    const { pin } = parse(z.object({ pin: z.string().regex(/^[1-9]\d{5}$/) }), req.params);
    const s = await getSettings();
    const place = await lookupPincode(pin);
    const zone = zoneFor(pin, s.shipping);
    const eta = new Date(Date.now() + zone.days * 86400_000);
    const cod = s.cod.enabled && !s.cod.blockedPrefixes.some((p) => pin.startsWith(p));
    res.json({ pincode: pin, ...place, deliverable: true, days: zone.days, eta: eta.toISOString(), cod, shippingRate: zone.rate });
  }),
);

type Geo = { line1: string; city: string; state: string; pincode: string; source: string };

async function reverseOla(lat: number, lng: number): Promise<Geo | null> {
  if (!env.OLA_MAPS_API_KEY) return null;
  const r = await fetch(`https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${env.OLA_MAPS_API_KEY}`, {
    signal: AbortSignal.timeout(5000),
  });
  const j = (await r.json()) as { results?: { formatted_address: string; address_components: { long_name: string; types: string[] }[] }[] };
  return fromComponents(j.results?.[0], 'ola');
}

async function reverseGoogle(lat: number, lng: number): Promise<Geo | null> {
  if (!env.GOOGLE_MAPS_API_KEY) return null;
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&region=in&key=${env.GOOGLE_MAPS_API_KEY}`, {
    signal: AbortSignal.timeout(5000),
  });
  const j = (await r.json()) as { results?: { formatted_address: string; address_components: { long_name: string; types: string[] }[] }[] };
  return fromComponents(j.results?.[0], 'google');
}

function fromComponents(
  res: { formatted_address: string; address_components: { long_name: string; types: string[] }[] } | undefined,
  source: string,
): Geo | null {
  if (!res) return null;
  const get = (t: string) => res.address_components.find((c) => c.types.includes(t))?.long_name ?? '';
  const pincode = get('postal_code');
  const city = get('locality') || get('administrative_area_level_3') || get('administrative_area_level_2');
  const state = get('administrative_area_level_1');
  const line1 = res.formatted_address.split(',').slice(0, 3).join(',').trim();
  return pincode ? { line1, city, state, pincode, source } : null;
}

async function reverseOsm(lat: number, lng: number): Promise<Geo | null> {
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&countrycodes=in`, {
    headers: { 'User-Agent': `TarunSilks/1.0 (${env.PUBLIC_URL})`, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(6000),
  });
  const j = (await r.json()) as { address?: Record<string, string> };
  const a = j.address;
  if (!a || a.country_code !== 'in') return null;
  const line1 = [a.house_number, a.road, a.neighbourhood || a.suburb].filter(Boolean).join(', ');
  return {
    line1,
    city: a.city || a.town || a.village || a.county || a.state_district || '',
    state: a.state || '',
    pincode: (a.postcode || '').replace(/\s/g, ''),
    source: 'osm',
  };
}

misc.post(
  '/geocode/reverse',
  ah(async (req, res) => {
    const { lat, lng } = parse(z.object({ lat: z.number().min(6).max(38), lng: z.number().min(68).max(98) }), req.body);
    for (const fn of [reverseOla, reverseGoogle, reverseOsm]) {
      try {
        const g = await fn(lat, lng);
        if (g) return res.json({ address: g, lat, lng });
      } catch (e) {
        log.warn('geocode_provider_failed', { provider: fn.name, err: String(e) });
      }
    }
    throw badRequest('We could not read your location. Please type the address.', 'geocode_failed');
  }),
);

misc.post(
  '/newsletter',
  ah(async (req, res) => {
    const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req.body);
    await prisma.subscriber.upsert({ where: { email }, create: { email }, update: {} });
    res.json({ ok: true });
  }),
);

misc.post(
  '/stock-alerts',
  ah(async (req, res) => {
    const b = parse(
      z
        .object({ productId: z.string(), colourId: z.string().optional(), email: z.string().email().optional(), phone: z.string().regex(/^[6-9]\d{9}$/).optional() })
        .refine((v) => v.email || v.phone, 'Email or phone required'),
      req.body,
    );
    await prisma.stockAlert.create({ data: b });
    res.json({ ok: true });
  }),
);
