import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
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
  SMTP_PORT: z.coerce.number().default(465),
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
export const adminEmails = env.ADMIN_EMAILS.split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
