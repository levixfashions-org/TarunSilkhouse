import { LogOut, Mail, Phone, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { Wordmark } from '@/components/Ornaments';
import { ProductCard } from '@/components/ProductCard';
import { Empty, Sheet, Spinner } from '@/components/ui';
import { del, get, patch, post } from '@/lib/api';
import { devSignIn, resetPassword, sendOtp, signInEmail, signInGoogle, signOut, verifyOtp } from '@/lib/auth';
import { isIOS } from '@/lib/device';
import { dateIN, inr, statusLabel } from '@/lib/format';
import { useSeo } from '@/lib/hooks';
import type { Address, Card, PublicOrder } from '@/lib/types';
import { useAuth, useBoot, useUI, useWish, type Theme } from '@/store';
import { OrderSummary, Timeline } from './Orders';

/* -------------------------------------------------- sign in */
export function SignIn() {
  useSeo('Sign in');
  const [params] = useSearchParams();
  const next = params.get('next') || '/account';
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const boot = useBoot((b) => b.boot);
  const [mode, setMode] = useState<'choose' | 'email' | 'phone'>('choose');
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (user) nav(next, { replace: true });
  }, [user, nav, next]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const noFirebase = !boot?.firebase;
  return (
    <div className="page-x flex min-h-[70vh] max-w-md flex-col justify-center py-16">
      <Wordmark className="mx-auto mb-10" />
      <h1 className="text-center font-serif text-d-3">Welcome back</h1>
      <p className="mt-2 text-center text-muted">Sign in to track orders, save addresses and keep your wishlist on every device.</p>

      {boot?.devAuth && (
        <form
          className="mt-8 rounded-card border border-dashed border-gold p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => devSignIn(email));
          }}
        >
          <p className="mb-2 text-[13px] text-muted">Local testing sign-in (disabled in production)</p>
          <div className="flex gap-2">
            <input className="field" type="email" required placeholder="any@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn-ghost">Go</button>
          </div>
        </form>
      )}

      {noFirebase && !boot?.devAuth && <p className="mt-8 rounded-xl bg-blush p-4 text-[14px]">Sign-in is not configured yet. You can still check out as a guest and track orders with your phone number.</p>}

      {!noFirebase && mode === 'choose' && (
        <div className="mt-8 space-y-3">
          <button className="btn-ghost w-full" disabled={busy} onClick={() => run(signInGoogle)}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5z" />
              <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.4 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3a11.5 11.5 0 0 0 10.2 6.3z" />
              <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z" />
              <path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3C6.5 7.1 9 5.1 12 5.1z" />
            </svg>
            Continue with Google
          </button>
          <button className="btn-ghost w-full" onClick={() => setMode('phone')}>
            <Phone size={18} /> Continue with mobile OTP
          </button>
          <button className="btn-ghost w-full" onClick={() => setMode('email')}>
            <Mail size={18} /> Continue with email
          </button>
          {isIOS() && <p className="pt-2 text-center text-[13px] text-muted">On iPhone, if Google sign-in does not open, use mobile OTP or email — they work the same.</p>}
        </div>
      )}

      {mode === 'email' && (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => signInEmail(email, pw, create));
          }}
        >
          <label className="block">
            <span className="label">Email</span>
            <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input className="field" type="password" autoComplete={create ? 'new-password' : 'current-password'} required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner />} {create ? 'Create account' : 'Sign in'}
          </button>
          <div className="flex justify-between text-[14px]">
            <button type="button" className="underline underline-offset-4" onClick={() => setCreate(!create)}>
              {create ? 'I already have an account' : 'Create an account'}
            </button>
            {!create && (
              <button
                type="button"
                className="text-muted underline underline-offset-4"
                onClick={() =>
                  run(async () => {
                    await resetPassword(email);
                    setInfo('Password reset link sent — check your inbox.');
                  })
                }
              >
                Forgot password?
              </button>
            )}
          </div>
          <button type="button" className="w-full text-[14px] text-muted" onClick={() => setMode('choose')}>
            Other ways to sign in
          </button>
        </form>
      )}

      {mode === 'phone' && (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!sent) {
                await sendOtp(phone, 'otp-btn');
                setSent(true);
                setInfo(`Code sent to +91 ${phone}`);
              } else await verifyOtp(code);
            });
          }}
        >
          {!sent ? (
            <label className="block">
              <span className="label">Mobile number</span>
              <div className="flex items-center gap-2">
                <span className="rounded-xl border border-line px-3 py-3 text-muted">+91</span>
                <input className="field" inputMode="numeric" autoComplete="tel-national" maxLength={10} required pattern="[6-9][0-9]{9}" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
              </div>
            </label>
          ) : (
            <label className="block">
              <span className="label">6-digit code</span>
              <input className="field text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </label>
          )}
          <button id="otp-btn" className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner />} {sent ? 'Verify and sign in' : 'Send code'}
          </button>
          <button type="button" className="w-full text-[14px] text-muted" onClick={() => setMode('choose')}>
            Other ways to sign in
          </button>
        </form>
      )}
      {info && <p className="mt-4 text-center text-[14px] text-sage">{info}</p>}
      {err && (
        <p className="mt-4 text-center text-[14px] text-danger" role="alert">
          {err}
        </p>
      )}
      <p className="mt-10 text-center text-[14px] text-muted">
        Ordered as a guest?{' '}
        <Link to="/track" className="text-maroon underline underline-offset-4">
          Track your order
        </Link>
      </p>
    </div>
  );
}

/* -------------------------------------------------- account area */
function OrdersTab() {
  const [orders, setOrders] = useState<PublicOrder[] | null>(null);
  const [open, setOpen] = useState<PublicOrder | null>(null);
  const [review, setReview] = useState<{ name: string; productId: string } | null>(null);
  useEffect(() => {
    get<{ items: PublicOrder[] }>('/account/orders').then((r) => setOrders(r.items)).catch(() => setOrders([]));
  }, []);
  if (!orders) return <Spinner />;
  if (!orders.length) return <Empty title="No orders yet" body="When you order, you can follow every step here." action={<Link to="/shop" className="btn-primary">Start shopping</Link>} />;
  return (
    <>
      <ul className="space-y-4">
        {orders.map((o) => (
          <li key={o.number}>
            <button onClick={() => setOpen(o)} className="card flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:border-ink">
              <div>
                <p className="font-medium">{o.number}</p>
                <p className="text-[14px] text-muted">
                  {dateIN(o.createdAt)} · {o.items.length} item{o.items.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p>{inr(o.total)}</p>
                <p className={`text-[13px] ${o.status === 'DELIVERED' ? 'text-sage' : o.status === 'CANCELLED' ? 'text-danger' : 'text-maroon'}`}>{statusLabel[o.status]}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.number ?? ''} wide>
        {open && (
          <div className="space-y-8">
            <Timeline order={open} />
            <OrderSummary order={open} />
            {open.status === 'DELIVERED' && (
              <div>
                <h3 className="mb-2 font-serif text-xl">Love it? Leave a review</h3>
                <div className="flex flex-wrap gap-2">
                  {open.items.filter((i) => i.productId).map((i) => (
                    <button key={i.name} className="chip" onClick={() => setReview({ name: i.name, productId: i.productId! })}>
                      <Star size={14} /> {i.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>
      <ReviewSheet target={review} onClose={() => setReview(null)} />
    </>
  );
}

function ReviewSheet({ target, onClose }: { target: { name: string; productId: string } | null; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useUI((s) => s.toast);
  return (
    <Sheet open={!!target} onClose={onClose} title="Write a review" side="bottom">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await post('/account/reviews', { productId: target!.productId, rating, title: title || undefined, body });
            toast('Thank you — your review will appear after a quick check');
            onClose();
          } catch (e2) {
            setErr((e2 as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="font-serif text-xl">{target?.name}</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" role="radio" aria-checked={rating === i} onClick={() => setRating(i)} className="p-1" aria-label={`${i} stars`}>
              <Star size={28} className={i <= rating ? 'fill-gold text-gold' : 'text-line'} />
            </button>
          ))}
        </div>
        <input className="field" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <textarea className="field" rows={4} required minLength={10} placeholder="How did it look and feel?" value={body} onChange={(e) => setBody(e.target.value)} />
        {err && <p className="text-[14px] text-danger">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          Submit review
        </button>
      </form>
    </Sheet>
  );
}

function AddressesTab() {
  const [items, setItems] = useState<Address[] | null>(null);
  const load = () => get<{ items: Address[] }>('/account/addresses').then((r) => setItems(r.items));
  useEffect(() => {
    void load();
  }, []);
  if (!items) return <Spinner />;
  if (!items.length) return <p className="text-muted">Addresses you use at checkout are saved here.</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((a) => (
        <li key={a.id} className="card p-5 text-[15px]">
          <p className="font-medium">
            {a.name} {a.isDefault && <span className="ml-2 rounded-full bg-sage/20 px-2 py-0.5 text-[12px]">Default</span>}
          </p>
          <p className="text-muted">
            {a.line1}
            {a.line2 ? `, ${a.line2}` : ''}
            <br />
            {a.city}, {a.state} {a.pincode}
            <br />
            {a.phone}
          </p>
          <button
            className="mt-3 inline-flex items-center gap-1 text-[14px] text-muted hover:text-danger"
            onClick={async () => {
              await del(`/account/addresses/${a.id}`);
              void load();
            }}
          >
            <Trash2 size={14} /> Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProfileTab() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.set);
  const { theme, setTheme } = useUI();
  const [name, setName] = useState(user.name ?? '');
  const toast = useUI((s) => s.toast);
  return (
    <div className="max-w-md space-y-10">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await patch<{ user: typeof user }>('/account/me', { name });
          setUser(r.user);
          toast('Profile saved');
        }}
      >
        <label className="block">
          <span className="label">Name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="text-[14px] text-muted">{user.email ?? user.phone}</p>
        <button className="btn-primary">Save</button>
      </form>
      <div>
        <h3 className="mb-3 font-serif text-xl">Appearance</h3>
        <div className="flex gap-2">
          {(['light', 'dark', 'auto'] as Theme[]).map((t) => (
            <button key={t} className="chip capitalize" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Account() {
  useSeo('My account');
  const { user, ready } = useAuth();
  const nav = useNavigate();
  if (!ready) return <div className="flex justify-center py-32"><Spinner /></div>;
  if (!user) return <Navigate to="/signin?next=/account" replace />;
  const tab = 'whitespace-nowrap border-b-2 border-transparent pb-3 text-[15px] text-muted aria-[current=page]:border-maroon aria-[current=page]:text-ink';
  return (
    <div className="page-x py-10 md:py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-muted">Namaste,</p>
          <h1 className="font-serif text-d-3">{user.name || user.email || 'friend'}</h1>
        </div>
        <div className="flex gap-2">
          {user.isAdmin && (
            <Link to="/admin" className="btn-ghost min-h-[42px] px-5">
              Admin
            </Link>
          )}
          <button
            className="btn-ghost min-h-[42px] px-5"
            onClick={async () => {
              await signOut();
              nav('/');
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
      <nav className="no-scrollbar mb-8 flex gap-6 overflow-x-auto border-b border-line">
        <NavLink end to="/account" className={tab}>
          Orders
        </NavLink>
        <NavLink to="/account/addresses" className={tab}>
          Addresses
        </NavLink>
        <NavLink to="/wishlist" className={tab}>
          Wishlist
        </NavLink>
        <NavLink to="/account/profile" className={tab}>
          Profile
        </NavLink>
      </nav>
      <Routes>
        <Route index element={<OrdersTab />} />
        <Route path="addresses" element={<AddressesTab />} />
        <Route path="profile" element={<ProfileTab />} />
      </Routes>
    </div>
  );
}

export function Wishlist() {
  useSeo('Wishlist');
  const ids = useWish((s) => s.ids);
  const [items, setItems] = useState<Card[] | null>(null);
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return setItems([]);
    get<{ items: Card[] }>(`/products/by-ids?ids=${key}`).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [key]);
  return (
    <div className="page-x py-10 md:py-16">
      <h1 className="mb-8 font-serif text-d-3">Wishlist</h1>
      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty title="Nothing saved yet" body="Tap the heart on any saree to keep it here." action={<Link to="/shop" className="btn-primary">Browse sarees</Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
