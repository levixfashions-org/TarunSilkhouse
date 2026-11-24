import 'dotenv/config';
import { z } from 'zod';

// Hosting panels often save an empty field as "" — treat that as "not set".
const num = (d: number) => z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.coerce.number().int().positive().default(d));

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: num(3000),
  PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGINS: z.string().default(''),
  UPLOAD_DIR: z.string().default('uploads'),

  // Firebase Admin (service account)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  ADMIN_EMAILS: z.string().default(''),
  // Firebase web app config (public, sent to the browser)
  FIREBASE_WEB_API_KEY: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  FIREBASE_APP_ID: z.string().optional(),
  /** Local testing only. Ignored when NODE_ENV=production. */
  DEV_AUTH_BYPASS: bool,

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Email (SMTP — Hostinger mail works: smtp.hostinger.com:465)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: num(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Tarun Silks <orders@example.com>'),
  ORDER_ALERT_EMAIL: z.string().optional(),

  // Geocoding
  OLA_MAPS_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const devAuthBypass = !isProd && env.DEV_AUTH_BYPASS;
// Forgiving about how the list is typed in a hosting panel: commas, semicolons or spaces between
// emails, and stray quotes or <angle brackets> around them are all ignored.
export const adminEmails = env.ADMIN_EMAILS.split(/[\s,;]+/)
  .map((e) => e.replace(/[<>"'`]/g, '').trim().toLowerCase())
  .filter((e) => e.includes('@'));
if (isProd && adminEmails.length === 0) {
  console.warn('[auth] ADMIN_EMAILS is empty or has no valid email — only people added under Team can open /admin.');
}
