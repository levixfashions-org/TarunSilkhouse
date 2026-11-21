/**
 * Firebase Auth, loaded lazily (the SDK never ships on the home page unless a user is signed in).
 * Google sign-in uses a popup, with a redirect fallback for iPhone/installed-app cases where popups fail.
 * Email/password and phone OTP are always available as alternatives.
 */
import type { Auth, ConfirmationResult, User as FbUser } from 'firebase/auth';
import { get, setTokenGetter } from './api';
import { isIOS, isStandalone } from './device';
import { useAuth, useBoot, useWish, type User } from '@/store';

let authP: Promise<{ auth: Auth; mod: typeof import('firebase/auth') }> | null = null;
const DEV_KEY = 'ts-dev-auth';

function devEmail(): string | null {
  try {
    return localStorage.getItem(DEV_KEY);
  } catch {
    return null;
  }
}

async function firebase() {
  const cfg = useBoot.getState().boot?.firebase;
  if (!cfg) throw new Error('Sign-in is not configured yet (add Firebase keys in the server .env).');
  authP ??= (async () => {
    const [{ initializeApp }, mod] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const app = initializeApp(cfg);
    const auth = mod.getAuth(app);
    await mod.setPersistence(auth, mod.browserLocalPersistence);
    return { auth, mod };
  })();
  return authP;
}

async function loadMe() {
  try {
    const r = await get<{ user: User }>('/account/me');
    useAuth.getState().set(r.user);
    void useWish.getState().merge();
  } catch {
    useAuth.getState().set(null);
  }
}

/** Call once at start-up. Only touches Firebase if the user has signed in before. */
export async function initAuth() {
  const boot = useBoot.getState().boot;
  if (boot?.devAuth && devEmail()) {
    setTokenGetter(async () => `dev:${devEmail()}`);
    await loadMe();
    useAuth.getState().setReady();
    return;
  }
  let signedInBefore = false;
  try {
    signedInBefore = localStorage.getItem('ts-signed-in') === '1';
  } catch {
    /* ignore */
  }
  if (!boot?.firebase || !signedInBefore) {
    useAuth.getState().setReady();
    return;
  }
  await attachFirebase();
}

async function attachFirebase() {
  const { auth, mod } = await firebase();
  setTokenGetter(async () => (auth.currentUser ? auth.currentUser.getIdToken() : null));
  await mod.getRedirectResult(auth).catch(() => null);
  await new Promise<void>((resolve) => {
    mod.onAuthStateChanged(auth, async (u: FbUser | null) => {
      try {
        localStorage.setItem('ts-signed-in', u ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (u) await loadMe();
      else useAuth.getState().set(null);
      useAuth.getState().setReady();
      resolve();
    });
  });
}

export async function signInGoogle() {
  const { auth, mod } = await firebase();
  const provider = new mod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (isStandalone() && isIOS()) {
    // Popups are blocked inside the installed iPhone app.
    await mod.signInWithRedirect(auth, provider);
    return;
  }
  try {
    await mod.signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code.includes('popup-blocked') || code.includes('operation-not-supported') || code.includes('web-storage-unsupported')) {
      await mod.signInWithRedirect(auth, provider);
      return;
    }
    throw friendly(e);
  }
  await afterSignIn();
}

export async function signInEmail(email: string, password: string, create: boolean) {
  const { auth, mod } = await firebase();
  try {
    if (create) {
      const cred = await mod.createUserWithEmailAndPassword(auth, email, password);
      await mod.sendEmailVerification(cred.user).catch(() => {});
    } else await mod.signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    throw friendly(e);
  }
  await afterSignIn();
}

export async function resetPassword(email: string) {
  const { auth, mod } = await firebase();
  await mod.sendPasswordResetEmail(auth, email).catch((e) => {
    throw friendly(e);
  });
}

let confirmation: ConfirmationResult | null = null;
export async function sendOtp(phone10: string, buttonId: string) {
  const { auth, mod } = await firebase();
  const verifier = new mod.RecaptchaVerifier(auth, buttonId, { size: 'invisible' });
  try {
    confirmation = await mod.signInWithPhoneNumber(auth, `+91${phone10}`, verifier);
  } catch (e) {
    verifier.clear();
    throw friendly(e);
  }
}
export async function verifyOtp(code: string) {
  if (!confirmation) throw new Error('Please request a new code');
  try {
    await confirmation.confirm(code);
  } catch (e) {
    throw friendly(e);
  }
  await afterSignIn();
}

async function afterSignIn() {
  try {
    localStorage.setItem('ts-signed-in', '1');
  } catch {
    /* ignore */
  }
  await attachFirebase();
}

/** Local development only — server must have DEV_AUTH_BYPASS=true and NODE_ENV≠production. */
export async function devSignIn(email: string) {
  localStorage.setItem(DEV_KEY, email.toLowerCase());
  setTokenGetter(async () => `dev:${email.toLowerCase()}`);
  await loadMe();
}

export async function signOut() {
  try {
    localStorage.removeItem(DEV_KEY);
    localStorage.setItem('ts-signed-in', '0');
  } catch {
    /* ignore */
  }
  if (authP) {
    const { auth, mod } = await authP;
    await mod.signOut(auth);
  }
  setTokenGetter(async () => null);
  useAuth.getState().set(null);
}

function friendly(e: unknown): Error {
  const code = (e as { code?: string }).code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account with this email — create one instead.',
    'auth/email-already-in-use': 'An account already exists with this email. Sign in instead.',
    'auth/weak-password': 'Use at least 6 characters for your password.',
    'auth/invalid-phone-number': 'Enter a valid 10-digit mobile number.',
    'auth/invalid-verification-code': 'That code is not right. Check the SMS and try again.',
    'auth/code-expired': 'The code expired. Request a new one.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
    'auth/popup-closed-by-user': 'The Google window was closed before signing in.',
    'auth/network-request-failed': 'Network problem — check your connection.',
  };
  return new Error(map[code] ?? (e as Error).message ?? 'Sign-in failed');
}
