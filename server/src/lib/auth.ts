import type { NextFunction, Request, Response } from 'express';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { prisma } from '../db.ts';
import { adminEmails, devAuthBypass, env } from '../env.ts';
import { forbidden, unauthorized } from './errors.ts';
import { log } from './log.ts';

export type AuthUser = { id: string; firebaseUid: string; email: string | null; phone: string | null; name: string | null; isAdmin: boolean };

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser | null;
  }
}

let firebaseReady = false;
if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        // Hostinger env panels store newlines as "\n" — restore them.
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  firebaseReady = true;
} else {
  log.warn('firebase_admin_not_configured', { hint: 'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY' });
}

type Claims = { uid: string; email?: string; phone?: string; name?: string };

async function verify(token: string): Promise<Claims | null> {
  if (devAuthBypass && token.startsWith('dev:')) {
    // Local testing only: "dev:someone@example.com". Disabled in production.
    const email = token.slice(4).toLowerCase();
    return { uid: `dev-${email}`, email, name: email.split('@')[0] };
  }
  if (!firebaseReady) return null;
  try {
    const d = await getAuth().verifyIdToken(token, true);
    return { uid: d.uid, email: d.email?.toLowerCase(), phone: d.phone_number, name: d.name as string | undefined };
  } catch {
    return null;
  }
}

/** Reads the Bearer token if present. Never rejects — use requireUser/requireAdmin for that. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  req.user = null;
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next();
  try {
    const claims = await verify(h.slice(7));
    if (!claims) return next();
    const isAdmin = !!claims.email && adminEmails.includes(claims.email);
    const user = await prisma.user.upsert({
      where: { firebaseUid: claims.uid },
      create: {
        firebaseUid: claims.uid,
        email: claims.email ?? null,
        phone: claims.phone ?? null,
        name: claims.name ?? null,
        role: isAdmin ? 'ADMIN' : 'CUSTOMER',
      },
      update: {
        // keep role in sync with the allow-list on every request
        role: isAdmin ? 'ADMIN' : 'CUSTOMER',
        ...(claims.phone ? { phone: claims.phone } : {}),
      },
    });
    req.user = { id: user.id, firebaseUid: user.firebaseUid, email: user.email, phone: user.phone, name: user.name, isAdmin };
  } catch (e) {
    log.warn('auth_attach_failed', { err: String(e) });
  }
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

/** Admin = signed in with Firebase AND email on ADMIN_EMAILS. Checked on every /api/admin request. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (!req.user.isAdmin) return next(forbidden('This account is not an admin'));
  next();
}
