import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request } from 'express';
import { prisma } from '../db.ts';
import { env } from '../env.ts';
import { ah } from '../lib/errors.ts';
import { stripTags } from '../lib/sanitize.ts';
import { getSettings } from '../lib/settings.ts';

export const seo = Router();

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

seo.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /account\nDisallow: /api/\n\nSitemap: ${env.PUBLIC_URL}/sitemap.xml\n`);
});

seo.get(
  '/sitemap.xml',
  ah(async (_req, res) => {
    const [products, collections, pages] = await Promise.all([
      prisma.product.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
      prisma.collection.findMany({ select: { handle: true } }),
      prisma.page.findMany({ select: { slug: true, updatedAt: true } }),
    ]);
    const urls = [
      { loc: '/', pri: '1.0' },
      { loc: '/shop', pri: '0.9' },
      { loc: '/journal', pri: '0.5' },
      ...collections.map((c) => ({ loc: `/collections/${c.handle}`, pri: '0.8' })),
      ...products.map((p) => ({ loc: `/products/${p.slug}`, pri: '0.8', mod: p.updatedAt })),
      ...pages.map((p) => ({ loc: `/pages/${p.slug}`, pri: '0.4', mod: p.updatedAt })),
    ];
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `<url><loc>${xml(env.PUBLIC_URL + u.loc)}</loc>${'mod' in u && u.mod ? `<lastmod>${(u.mod as Date).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${u.pri}</priority></url>`)
        .join('\n')}\n</urlset>`,
    );
  }),
);

type Meta = { title: string; description: string; image?: string; canonical: string; jsonLd: object[]; type?: string };

const abs = (u?: string | null) => (u ? (u.startsWith('http') ? u : env.PUBLIC_URL + u.split('#')[0]) : undefined);

async function metaFor(req: Request): Promise<Meta> {
  const s = await getSettings();
  const brand = s.store.storeName;
  const canonical = env.PUBLIC_URL + req.path.replace(/\/$/, '');
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand,
    url: env.PUBLIC_URL,
    logo: `${env.PUBLIC_URL}/icons/icon-512.png`,
    sameAs: [s.store.instagram ? `https://instagram.com/${s.store.instagram}` : null].filter(Boolean),
  };
  const base: Meta = {
    title: `${brand} — ${s.store.tagline} | Handloom Kanjivaram, Banarasi & Silk Sarees`,
    description: 'Heritage handloom sarees — Kanjivaram, Banarasi, Paithani, Chanderi, linen and cotton — woven by master weavers and delivered across India.',
    canonical,
    jsonLd: [org],
  };

  const pm = req.path.match(/^\/products\/([^/]+)/);
  if (pm) {
    const p = await prisma.product.findUnique({ where: { slug: pm[1] }, include: { images: { orderBy: { sortOrder: 'asc' }, take: 3 }, colours: true } });
    if (p && p.isActive) {
      const inStock = p.colours.some((c) => c.stock > 0);
      return {
        ...base,
        type: 'product',
        title: p.seoTitle || `${p.name} — ${p.fabric} Saree | ${brand}`,
        description: p.seoDescription || stripTags(p.description).slice(0, 160),
        image: abs(p.images[0]?.url),
        jsonLd: [
          org,
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: p.name,
            description: stripTags(p.description).slice(0, 500),
            image: p.images.map((i) => abs(i.url)),
            sku: p.id,
            brand: { '@type': 'Brand', name: brand },
            material: p.fabric,
            offers: {
              '@type': 'Offer',
              priceCurrency: 'INR',
              price: (p.price / 100).toFixed(2),
              availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              url: canonical,
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: env.PUBLIC_URL },
              { '@type': 'ListItem', position: 2, name: 'Shop', item: `${env.PUBLIC_URL}/shop` },
              { '@type': 'ListItem', position: 3, name: p.name, item: canonical },
            ],
          },
        ],
      };
    }
  }
  const cm = req.path.match(/^\/collections\/([^/]+)/);
  if (cm) {
    const c = await prisma.collection.findUnique({ where: { handle: cm[1] } });
    if (c) return { ...base, title: `${c.title} | ${brand}`, description: c.description ? stripTags(c.description).slice(0, 160) : base.description, image: abs(c.image) };
  }
  const pg = req.path.match(/^\/pages\/([^/]+)/);
  if (pg) {
    const p = await prisma.page.findUnique({ where: { slug: pg[1] } });
    if (p) return { ...base, title: `${p.seoTitle || p.title} | ${brand}`, description: stripTags(p.body).slice(0, 160) };
  }
  return base;
}

let template: string | null = null;
let templateMtime = 0;
export function htmlHandler(publicDir: string) {
  return ah(async (req, res) => {
    // A missing file (old hashed asset after a deploy, typo) must 404 — never return HTML for a .js/.css request.
    if (/\.[a-z0-9]{2,5}$/i.test(req.path)) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    const file = path.join(publicDir, 'index.html');
    const mtime = fs.statSync(file).mtimeMs;
    if (!template || mtime !== templateMtime) {
      template = fs.readFileSync(file, 'utf8');
      templateMtime = mtime;
    }
    let meta: Meta;
    try {
      meta = await metaFor(req);
    } catch {
      meta = { title: 'Tarun Silks', description: '', canonical: env.PUBLIC_URL + req.path, jsonLd: [] };
    }
    const noindex = /^\/(admin|checkout|account)/.test(req.path);
    const head = [
      `<title>${xml(meta.title)}</title>`,
      `<meta name="description" content="${xml(meta.description)}">`,
      `<link rel="canonical" href="${xml(meta.canonical)}">`,
      `<meta property="og:title" content="${xml(meta.title)}">`,
      `<meta property="og:description" content="${xml(meta.description)}">`,
      `<meta property="og:type" content="${meta.type ?? 'website'}">`,
      `<meta property="og:url" content="${xml(meta.canonical)}">`,
      `<meta property="og:image" content="${xml(meta.image ?? `${env.PUBLIC_URL}/og-default.jpg`)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      noindex ? '<meta name="robots" content="noindex">' : '',
      ...meta.jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
    ].join('\n    ');
    const html = template.replace(/<title>[\s\S]*?<\/title>/, '').replace('<!--app-head-->', head);
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(html);
  });
}
