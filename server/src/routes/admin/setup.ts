import fs from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { adminEmails, env } from '../../env.ts';
import { clearTeamCache, teamEmails } from '../../lib/auth.ts';
import { bump } from '../../lib/cache.ts';
import { ah, badRequest, parse } from '../../lib/errors.ts';
import { SAMPLE_SLUGS } from '../../lib/demo-seed.ts';
import { getSettings } from '../../lib/settings.ts';
import { storeVideo, uploadRoot } from '../../lib/storage.ts';

export const adminSetup = Router();

const DEFAULTS = { whatsapp: '919999999999', email: 'hello@tarunsilks.in', phone: '+91 99999 99999' };

/** Everything the dashboard's "Set up your store" checklist needs, in one call. */
adminSetup.get(
  '/setup-status',
  ah(async (_req, res) => {
    const s = await getSettings();
    const [totalProducts, sampleProducts, collections, homeSections, pagesEdited, orders] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { slug: { in: SAMPLE_SLUGS } } }),
      prisma.collection.count(),
      prisma.homeSection.count({ where: { isVisible: true } }),
      prisma.page.count({ where: { slug: { in: ['privacy', 'terms', 'returns', 'shipping'] }, updatedAt: { gt: new Date(Date.now() - 1000 * 86400 * 3650) } } }),
      prisma.order.count({ where: { status: { not: 'PENDING_PAYMENT' } } }),
    ]);
    const policyPages = await prisma.page.findMany({ where: { slug: { in: ['privacy', 'terms'] } }, select: { body: true } });
    const policiesWritten = policyPages.length === 2 && policyPages.every((p) => !/Replace (this|with)/i.test(p.body));

    let uploadsWritable = true;
    try {
      await fs.mkdir(uploadRoot, { recursive: true });
      await fs.access(uploadRoot, fs.constants.W_OK);
    } catch {
      uploadsWritable = false;
    }

    const razorKey = env.RAZORPAY_KEY_ID ?? '';
    res.json({
      integrations: {
        signIn: { ok: !!(env.FIREBASE_WEB_API_KEY && env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY), detail: env.FIREBASE_PROJECT_ID || null },
        payments: {
          ok: !!(razorKey && env.RAZORPAY_KEY_SECRET),
          mode: razorKey.startsWith('rzp_live_') ? 'live' : razorKey.startsWith('rzp_test_') ? 'test' : null,
          webhook: !!env.RAZORPAY_WEBHOOK_SECRET,
        },
        email: { ok: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS), detail: env.SMTP_USER || null },
        maps: { ok: true, detail: env.OLA_MAPS_API_KEY ? 'Ola Maps' : env.GOOGLE_MAPS_API_KEY ? 'Google Maps' : 'OpenStreetMap (free)' },
        uploads: { ok: uploadsWritable, detail: uploadRoot },
        analytics: { ok: !!(s.store.gaId || s.store.metaPixelId) },
      },
      checklist: {
        storeDetails: s.store.email !== DEFAULTS.email && s.store.phone !== DEFAULTS.phone,
        whatsapp: s.store.whatsapp !== DEFAULTS.whatsapp,
        logo: !!s.store.logoUrl,
        address: !!s.store.address,
        ownProducts: totalProducts - sampleProducts > 0,
        samplesRemoved: sampleProducts === 0,
        collections: collections > 0,
        homepage: homeSections > 0,
        policies: policiesWritten,
        shipping: true,
        payments: !!(razorKey && env.RAZORPAY_KEY_SECRET),
        firstOrder: orders > 0,
      },
      counts: { totalProducts, sampleProducts, collections, homeSections, orders, pagesEdited },
      publicUrl: env.PUBLIC_URL,
    });
  }),
);

// ---- Team: who can open the admin panel
adminSetup.get(
  '/team',
  ah(async (_req, res) => {
    res.json({ locked: adminEmails, emails: await teamEmails() });
  }),
);
adminSetup.put(
  '/team',
  ah(async (req, res) => {
    const { emails } = parse(z.object({ emails: z.array(z.string().trim().toLowerCase().email()).max(30) }), req.body);
    const unique = [...new Set(emails)].filter((e) => !adminEmails.includes(e));
    await prisma.setting.upsert({ where: { key: 'team' }, create: { key: 'team', value: { emails: unique } }, update: { value: { emails: unique } } });
    clearTeamCache();
    res.json({ locked: adminEmails, emails: unique });
  }),
);

// ---- Remove the 12 starter sarees (orders keep their own copy of names, prices and photos)
adminSetup.delete(
  '/sample-content',
  ah(async (_req, res) => {
    const r = await prisma.product.deleteMany({ where: { slug: { in: SAMPLE_SLUGS } } });
    bump();
    res.json({ removed: r.count });
  }),
);

// ---- Exports & lists
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
adminSetup.get(
  '/orders.csv',
  ah(async (req, res) => {
    const { from, to } = parse(z.object({ from: z.string().optional(), to: z.string().optional() }), req.query);
    const rows = await prisma.order.findMany({
      where: {
        status: { not: 'PENDING_PAYMENT' },
        createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59+05:30`) } : {}) },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const head = ['Order', 'Date', 'Status', 'Payment', 'Customer', 'Phone', 'Email', 'City', 'State', 'Pincode', 'Items', 'Subtotal', 'Discount', 'Shipping', 'COD fee', 'Total', 'Coupon', 'Courier', 'AWB'];
    const lines = rows.map((o) =>
      [
        o.number,
        o.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        o.status,
        o.paymentMethod,
        o.shipName,
        o.phone,
        o.email,
        o.shipCity,
        o.shipState,
        o.shipPincode,
        o.items.map((i) => `${i.name} (${i.colourName}) x${i.qty}`).join('; '),
        o.subtotal / 100,
        o.discount / 100,
        o.shipping / 100,
        o.codFee / 100,
        o.total / 100,
        o.couponCode,
        o.courier,
        o.awb,
      ]
        .map(csvCell)
        .join(','),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tarun-silks-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + [head.join(','), ...lines].join('\n'));
  }),
);

adminSetup.get(
  '/subscribers',
  ah(async (_req, res) => {
    res.json({ items: await prisma.subscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 2000 }) });
  }),
);
adminSetup.delete(
  '/subscribers/:id',
  ah(async (req, res) => {
    await prisma.subscriber.deleteMany({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

adminSetup.get(
  '/stock-alerts',
  ah(async (_req, res) => {
    const rows = await prisma.stockAlert.findMany({
      include: { product: { select: { name: true, slug: true, id: true } }, colour: { select: { colourName: true, stock: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({
      items: rows.map((a) => ({
        id: a.id,
        product: a.product.name,
        productId: a.product.id,
        slug: a.product.slug,
        colour: a.colour?.colourName ?? null,
        inStockNow: (a.colour?.stock ?? 0) > 0,
        email: a.email,
        phone: a.phone,
        notifiedAt: a.notifiedAt,
        createdAt: a.createdAt,
      })),
    });
  }),
);

// ---- Video upload (hero / background video)
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 80 * 1024 * 1024, files: 1 } });
adminSetup.post(
  '/media/video',
  videoUpload.single('file'),
  ah(async (req, res) => {
    const f = req.file;
    if (!f) throw badRequest('Choose a video file');
    const v = await storeVideo(f.buffer);
    await prisma.mediaFile.create({ data: { key: v.key, original: v.url, thumb: v.url, main: v.url, zoom: v.url, width: 0, height: 0, bytes: v.bytes, mime: v.mime } });
    res.json({ file: { url: v.url, bytes: v.bytes, name: f.originalname, mime: v.mime } });
  }),
);
