import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { prisma } from './db.ts';
import { env, isProd } from './env.ts';
import { startJobs } from './jobs.ts';
import { attachUser, requireAdmin } from './lib/auth.ts';
import { contentVersion } from './lib/cache.ts';
import { errorHandler } from './lib/errors.ts';
import { log } from './lib/log.ts';
import { uploadRoot } from './lib/storage.ts';
import { setupDatabase, setupState } from './lib/setup-db.ts';
import { account } from './routes/account.ts';
import { adminCatalog } from './routes/admin/catalog.ts';
import { adminOrders } from './routes/admin/orders.ts';
import { adminStore } from './routes/admin/store.ts';
import { catalog } from './routes/catalog.ts';
import { checkout, razorpayWebhook } from './routes/checkout.ts';
import { misc } from './routes/misc.ts';
import { htmlHandler, seo } from './routes/seo.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
// In production the bundle sits next to ./public (the built frontend). In dev, use ../client/dist if present.
const publicDir = [path.join(here, 'public'), path.join(here, '../../client/dist')].find((p) => fs.existsSync(path.join(p, 'index.html')));

const app = express();
app.set('trust proxy', 1); // Hostinger sits behind a proxy — needed for correct IPs in rate limits
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://checkout.razorpay.com', 'https://apis.google.com', 'https://www.gstatic.com', 'https://www.googletagmanager.com', 'https://connect.facebook.net'],
        'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://*.firebaseapp.com', 'https://www.google.com', 'https://*.google.com'],
        'connect-src': ["'self'", 'https://*.googleapis.com', 'https://*.razorpay.com', 'https://*.firebaseio.com', 'https://www.google-analytics.com', 'https://*.facebook.com', 'https://securetoken.googleapis.com', 'https://identitytoolkit.googleapis.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'blob:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'worker-src': ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Google sign-in popup
  }),
);
app.use(compression());

const allowed = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  '/api',
  cors({
    origin: (origin, cb) => cb(null, !origin || allowed.length === 0 || allowed.includes(origin) || origin === env.PUBLIC_URL),
    credentials: false,
  }),
);

// Webhook needs the raw body, so it goes before express.json()
app.use('/api/webhooks', razorpayWebhook);
app.use(express.json({ limit: '1mb' }));

// Rate limits on sensitive endpoints
const limit = (windowMin: number, max: number) => rateLimit({ windowMs: windowMin * 60_000, max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { message: 'Too many requests — please wait a minute.', code: 'rate_limited' } } });
app.use('/api/checkout/place', limit(10, 20));
app.use('/api/checkout/verify', limit(10, 30));
app.use('/api/checkout/quote', limit(1, 60));
app.use('/api/geocode', limit(10, 20));
app.use('/api/orders/track', limit(10, 30));
app.use('/api/newsletter', limit(60, 10));
app.use('/api/stock-alerts', limit(60, 20));
app.use('/api/account', limit(1, 120));
app.use('/api', limit(1, 300));

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'up', setup: setupState(), version: contentVersion() });
  } catch {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

app.use('/api', (req, res, next) => {
  if (setupState() === 'pending') {
    res.status(503).set('Retry-After', '5').json({ error: { message: 'The store is getting ready — please refresh in a few seconds.', code: 'setting_up' } });
    return;
  }
  next();
});

app.use('/api', attachUser);

// Public GETs revalidate on every request and change ETag whenever admin saves (cache-busting on write).
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/admin') && !req.path.startsWith('/account')) {
    res.set('Cache-Control', 'no-cache');
    res.set('X-Content-Version', String(contentVersion()));
  } else {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

app.use('/api', catalog);
app.use('/api', checkout);
app.use('/api', misc);
app.use('/api/account', account);
app.use('/api/admin', requireAdmin, adminOrders, adminCatalog, adminStore);
app.use('/api', (_req, res) => res.status(404).json({ error: { message: 'Not found', code: 'not_found' } }));

// Uploaded images: immutable (every upload gets a new random folder), cache for a year.
app.use('/uploads', express.static(uploadRoot, { immutable: true, maxAge: '365d', fallthrough: false, index: false }));

app.use(seo);

if (publicDir) {
  app.use(
    express.static(publicDir, {
      index: false,
      setHeaders(res, file) {
        if (/[\\/]assets[\\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else if (file.endsWith('sw.js') || file.endsWith('manifest.webmanifest')) res.setHeader('Cache-Control', 'no-cache');
        else res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    }),
  );
  app.get('*', htmlHandler(publicDir));
} else {
  app.get('/', (_req, res) => res.send('API running. Build the client (npm run build) to serve the storefront.'));
}

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  log.info('server_started', { port: env.PORT, env: env.NODE_ENV, publicDir: publicDir ?? null });
});
void setupDatabase().then(startJobs);

const shutdown = () => {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 8000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (e) => log.error('unhandled_rejection', { err: String(e) }));
if (!isProd) log.info('dev_mode', { hint: 'DEV_AUTH_BYPASS lets you sign in with any email locally' });
