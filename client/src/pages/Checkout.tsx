import { Gift, LocateFixed, Lock, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FreeShipBar, useQuote } from '@/components/Overlays';
import { Empty, Framed, Spinner } from '@/components/ui';
import { ApiError, get, post } from '@/lib/api';
import { track } from '@/lib/analytics';
import { inr, uid } from '@/lib/format';
import { useSeo } from '@/lib/hooks';
import type { Address } from '@/lib/types';
import { useAuth, useBag, useBoot, useUI } from '@/store';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.body.appendChild(s);
  });
}

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[13px] text-danger">{error}</span>}
    </label>
  );
}

const blank: Address = { name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' };

/** One idempotency key per checkout attempt; a new key only when the bag changes. */
function idemKey(bagHash: string) {
  const k = `ts-idem-${bagHash}`;
  let v = sessionStorage.getItem(k);
  if (!v) {
    v = uid();
    sessionStorage.setItem(k, v);
  }
  return v;
}

export default function Checkout() {
  useSeo('Checkout');
  const nav = useNavigate();
  const items = useBag((s) => s.items);
  const clear = useBag((s) => s.clear);
  const setBagEmail = useBag((s) => s.setEmail);
  const user = useAuth((s) => s.user);
  const boot = useBoot((b) => b.boot);
  const toast = useUI((s) => s.toast);

  const [email, setEmail] = useState(useBag.getState().email ?? '');
  const [addr, setAddr] = useState<Address>(blank);
  const [saved, setSaved] = useState<Address[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<string | undefined>();
  const [method, setMethod] = useState<'RAZORPAY' | 'COD'>('RAZORPAY');
  const [gift, setGift] = useState(false);
  const [giftMsg, setGiftMsg] = useState('');
  const [locating, setLocating] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const pinOk = /^[1-9]\d{5}$/.test(addr.pincode);
  const extra = useMemo(() => ({ couponCode: applied, pincode: pinOk ? addr.pincode : undefined, paymentMethod: method, giftWrap: gift }), [applied, pinOk, addr.pincode, method, gift]);
  const { quote, loading } = useQuote(extra);
  const onlineAvailable = !!boot?.razorpayKeyId;

  useEffect(() => {
    if (!onlineAvailable) setMethod('COD');
  }, [onlineAvailable]);
  useEffect(() => {
    if (quote && method === 'COD' && !quote.cod.available && onlineAvailable) setMethod('RAZORPAY');
  }, [quote, method, onlineAvailable]);
  useEffect(() => {
    if (items.length) track('begin_checkout', { value: items.reduce((s, i) => s + i.price * i.qty, 0) / 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!user) return;
    if (user.email && !email) setEmail(user.email);
    get<{ items: Address[] }>('/account/addresses')
      .then((r) => {
        setSaved(r.items);
        const def = r.items.find((a) => a.isDefault) ?? r.items[0];
        if (def) {
          setSavedId(def.id ?? null);
          setAddr({ ...blank, ...def, line2: def.line2 ?? '', landmark: def.landmark ?? '' });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // pincode → city/state autofill
  useEffect(() => {
    if (!pinOk) return;
    get<{ city?: string; state?: string }>(`/pincode/${addr.pincode}`)
      .then((r) => setAddr((a) => ({ ...a, city: a.city || r.city || '', state: a.state || r.state || '' })))
      .catch(() => {});
  }, [addr.pincode, pinOk]);

  const useLocation = () => {
    if (!('geolocation' in navigator)) return toast('Location is not available on this device', 'error');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await post<{ address: { line1: string; city: string; state: string; pincode: string }; lat: number; lng: number }>('/geocode/reverse', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setAddr((a) => ({ ...a, line1: a.line1 || r.address.line1, city: r.address.city || a.city, state: r.address.state || a.state, pincode: r.address.pincode || a.pincode, lat: r.lat, lng: r.lng }));
          setSavedId(null);
          toast('Address filled from your location — please add your flat / house number');
        } catch (e) {
          toast((e as Error).message, 'error');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast(err.code === 1 ? 'Location permission was denied. You can type the address instead.' : 'Could not get your location. Please type the address.', 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Enter a valid email for your receipt';
    if (addr.name.trim().length < 2) e.name = 'Enter the full name';
    if (!/^[6-9]\d{9}$/.test(addr.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))) e.phone = 'Enter a 10-digit mobile number';
    if (addr.line1.trim().length < 3) e.line1 = 'Enter house number and street';
    if (!pinOk) e.pincode = 'Enter a 6-digit pincode';
    if (addr.city.trim().length < 2) e.city = 'Enter the city';
    if (!addr.state) e.state = 'Choose the state';
    setFieldErr(e);
    return Object.keys(e).length === 0;
  };

  const place = async () => {
    setError(null);
    if (!validate()) {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setPlacing(true);
    setBagEmail(email);
    const lines = items.map(({ productId, colourId, qty, options }) => ({ productId, colourId, qty, options }));
    const key = idemKey(btoa(unescape(encodeURIComponent(JSON.stringify([lines, method, addr.pincode, applied ?? '', gift])))).slice(0, 40));
    try {
      const r = await post<{ order: { number: string; total: number }; razorpay?: { keyId: string; orderId: string; amount: number; currency: string } }>('/checkout/place', {
        idempotencyKey: key,
        email,
        items: lines,
        couponCode: applied,
        paymentMethod: method,
        giftWrap: gift,
        giftMessage: gift && giftMsg ? giftMsg : undefined,
        saveAddress: !!user && !savedId && saveAddress,
        ship: {
          name: addr.name,
          phone: addr.phone,
          line1: addr.line1,
          line2: addr.line2 || undefined,
          landmark: addr.landmark || undefined,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          lat: addr.lat,
          lng: addr.lng,
        },
      });
      const done = () => {
        track('purchase', { transaction_id: r.order.number, value: r.order.total / 100 });
        clear();
        sessionStorage.setItem('ts-last-order', JSON.stringify({ number: r.order.number, key }));
        nav(`/order/${r.order.number}`, { replace: true });
      };
      if (!r.razorpay) return done();
      await loadRazorpay();
      const rzp = new window.Razorpay!({
        key: r.razorpay.keyId,
        order_id: r.razorpay.orderId,
        amount: r.razorpay.amount,
        currency: 'INR',
        name: boot?.store.storeName ?? 'Tarun Silks',
        description: `Order ${r.order.number}`,
        prefill: { name: addr.name, email, contact: addr.phone },
        theme: { color: '#6B1F2A' },
        modal: {
          ondismiss: () => {
            setPlacing(false);
            setError('Payment was not completed. Your sarees are held for 30 minutes — tap Pay to try again.');
          },
        },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await post('/checkout/verify', resp);
            done();
          } catch (e) {
            setPlacing(false);
            setError((e as Error).message);
          }
        },
      });
      rzp.on('payment.failed', () => {
        setError('The payment failed. No money was taken — please try again or choose another method.');
      });
      rzp.open();
    } catch (e) {
      setPlacing(false);
      if (e instanceof ApiError && (e.code === 'sold_out' || e.code === 'stock')) {
        setError(`${e.message} Please update your bag.`);
        sessionStorage.removeItem(`ts-idem-${key}`);
      } else setError((e as Error).message);
    }
  };

  if (!items.length) return <Empty title="Your bag is empty" body="Add a saree to start checkout." action={<Link to="/shop" className="btn-primary">Browse sarees</Link>} />;

  const inp = (k: keyof Address, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      className={`field ${fieldErr[k] ? 'border-danger' : ''}`}
      aria-invalid={!!fieldErr[k]}
      value={(addr[k] as string | undefined) ?? ''}
      onChange={(e) => {
        setAddr({ ...addr, [k]: e.target.value });
        setSavedId(null);
      }}
      {...props}
    />
  );

  return (
    <div className="page-x py-8 md:py-12">
      <h1 className="mb-8 font-serif text-d-3">Checkout</h1>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-7">
          {/* contact */}
          <section>
            <h2 className="mb-4 font-serif text-2xl">Contact</h2>
            {!user && (
              <p className="mb-4 text-[14px] text-muted">
                Checking out as a guest.{' '}
                <Link to="/signin?next=/checkout" className="text-maroon underline underline-offset-4">
                  Sign in
                </Link>{' '}
                to use saved addresses.
              </p>
            )}
            <Field error={fieldErr.email} label="Email for order updates">
              <input className={`field ${fieldErr.email ? 'border-danger' : ''}`} aria-invalid={!!fieldErr.email} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => /\S+@\S+/.test(email) && setBagEmail(email)} />
            </Field>
          </section>

          {/* address */}
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">Delivery address</h2>
              <button type="button" className="chip" onClick={useLocation} disabled={locating}>
                {locating ? <Spinner className="h-4 w-4" /> : <LocateFixed size={16} />} Use my current location
              </button>
            </div>
            {saved.length > 0 && (
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                {saved.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSavedId(a.id ?? null);
                      setAddr({ ...blank, ...a, line2: a.line2 ?? '', landmark: a.landmark ?? '' });
                    }}
                    className={`rounded-card border p-4 text-left text-[14px] transition-colors ${savedId === a.id ? 'border-ink bg-paper' : 'border-line'}`}
                  >
                    <p className="font-medium">{a.name}</p>
                    <p className="text-muted">
                      {a.line1}, {a.city} {a.pincode}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field error={fieldErr.name} label="Full name">{inp('name', { autoComplete: 'name' })}</Field>
              <Field error={fieldErr.phone} label="Mobile number">{inp('phone', { autoComplete: 'tel-national', inputMode: 'tel', maxLength: 14 })}</Field>
              <div className="sm:col-span-2">
                <Field error={fieldErr.line1} label="Flat / house no., building, street">{inp('line1', { autoComplete: 'address-line1' })}</Field>
              </div>
              <Field error={fieldErr.line2} label="Area / locality (optional)">{inp('line2', { autoComplete: 'address-line2' })}</Field>
              <Field error={fieldErr.landmark} label="Landmark (optional)">{inp('landmark')}</Field>
              <Field error={fieldErr.pincode} label="Pincode">{inp('pincode', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 6 })}</Field>
              <Field error={fieldErr.city} label="City">{inp('city', { autoComplete: 'address-level2' })}</Field>
              <div className="sm:col-span-2">
                <Field error={fieldErr.state} label="State">
                  <select className={`field ${fieldErr.state ? 'border-danger' : ''}`} aria-invalid={!!fieldErr.state} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} autoComplete="address-level1">
                    <option value="">Choose state</option>
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            {addr.lat && <p className="mt-2 text-[13px] text-sage">Exact location saved for the courier.</p>}
            {user && !savedId && (
              <label className="mt-4 flex items-center gap-3 text-[14px]">
                <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--maroon))]" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address for next time
              </label>
            )}
            {quote?.delivery && <p className="mt-4 text-[14px]">Estimated delivery in {quote.delivery.days}–{quote.delivery.days + 2} days.</p>}
          </section>

          {/* gift */}
          <section>
            <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-card border border-line px-4">
              <span className="flex items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--maroon))]" checked={gift} onChange={(e) => setGift(e.target.checked)} />
                <Gift size={18} /> Gift wrap with a handwritten note
              </span>
              <span className="text-[14px] text-muted">+{inr(boot?.shipping.giftWrapPrice ?? 9900)}</span>
            </label>
            {gift && <textarea className="field mt-3" rows={3} maxLength={300} placeholder="Your message (we write it by hand)" value={giftMsg} onChange={(e) => setGiftMsg(e.target.value)} />}
          </section>

          {/* payment */}
          <section>
            <h2 className="mb-4 font-serif text-2xl">Payment</h2>
            <div className="space-y-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 ${method === 'RAZORPAY' ? 'border-ink bg-paper' : 'border-line'} ${onlineAvailable ? '' : 'opacity-50'}`}>
                <input type="radio" name="pay" className="mt-1 h-5 w-5 accent-[rgb(var(--maroon))]" checked={method === 'RAZORPAY'} disabled={!onlineAvailable} onChange={() => setMethod('RAZORPAY')} />
                <span>
                  <span className="block font-medium">Pay online</span>
                  <span className="text-[14px] text-muted">{onlineAvailable ? 'UPI, cards, netbanking and wallets via Razorpay' : 'Online payment is being set up — please use COD'}</span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 ${method === 'COD' ? 'border-ink bg-paper' : 'border-line'} ${quote && !quote.cod.available ? 'opacity-50' : ''}`}>
                <input type="radio" name="pay" className="mt-1 h-5 w-5 accent-[rgb(var(--maroon))]" checked={method === 'COD'} disabled={!!quote && !quote.cod.available} onChange={() => setMethod('COD')} />
                <span>
                  <span className="block font-medium">Cash on delivery {boot?.cod.fee ? `(+${inr(boot.cod.fee)})` : ''}</span>
                  <span className="text-[14px] text-muted">{quote && !quote.cod.available ? quote.cod.reason : 'Pay in cash or UPI when it arrives'}</span>
                </span>
              </label>
            </div>
          </section>
        </div>

        {/* summary */}
        <aside className="lg:col-span-5">
          <div className="card sticky top-[calc(var(--header-h)+16px)] p-5 md:p-6">
            <h2 className="mb-4 font-serif text-2xl">Order summary</h2>
            <ul className="divide-y divide-line">
              {(quote?.lines ?? []).map((l) => (
                <li key={`${l.colourId}${JSON.stringify(l.options)}`} className="flex gap-3 py-3">
                  <div className="w-14 shrink-0">
                    <Framed url={l.image} alt={l.name} sizes="56px" className="rounded-lg" />
                  </div>
                  <div className="min-w-0 flex-1 text-[14px]">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="text-muted">
                      {l.colourName} × {l.qty}
                      {l.options?.fallPico ? ' · fall & pico' : ''}
                      {l.options?.stitching ? ' · stitched blouse' : ''}
                    </p>
                  </div>
                  <p className="text-[14px]">{inr(l.lineTotal)}</p>
                </li>
              ))}
            </ul>
            {quote?.problems.map((p) => (
              <p key={p.colourId} className="mt-2 text-[14px] text-danger">
                {p.message}
              </p>
            ))}
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setApplied(coupon.trim() || undefined);
              }}
            >
              <div className="relative flex-1">
                <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="field pl-9 uppercase" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} aria-label="Coupon code" />
              </div>
              <button className="btn-ghost min-h-[48px] px-5">Apply</button>
            </form>
            {applied && quote?.couponError && <p className="mt-2 text-[14px] text-danger">{quote.couponError}</p>}
            {quote?.coupon && (
              <p className="mt-2 text-[14px] text-sage">
                {quote.coupon.code}: {quote.coupon.message}{' '}
                <button
                  className="ml-2 underline"
                  onClick={() => {
                    setApplied(undefined);
                    setCoupon('');
                  }}
                >
                  Remove
                </button>
              </p>
            )}
            {quote && (
              <div className="mt-5">
                <FreeShipBar subtotal={quote.subtotal - quote.discount} threshold={quote.freeShippingAbove} />
              </div>
            )}
            <dl className="mt-5 space-y-2 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{quote ? inr(quote.subtotal) : '—'}</dd>
              </div>
              {!!quote?.discount && (
                <div className="flex justify-between text-sage">
                  <dt>Discount</dt>
                  <dd>−{inr(quote.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd>{quote ? (quote.shipping ? inr(quote.shipping) : 'Free') : '—'}</dd>
              </div>
              {!!quote?.codFee && (
                <div className="flex justify-between">
                  <dt className="text-muted">COD fee</dt>
                  <dd>{inr(quote.codFee)}</dd>
                </div>
              )}
              {!!quote?.giftWrap && (
                <div className="flex justify-between">
                  <dt className="text-muted">Gift wrap</dt>
                  <dd>{inr(quote.giftWrap)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-medium">Total</dt>
                <dd className="font-serif text-[1.8rem]">{quote ? inr(quote.total) : '—'}</dd>
              </div>
            </dl>
            {error && <p className="mt-4 rounded-xl bg-danger/10 p-3 text-[14px] text-danger" role="alert">{error}</p>}
            <button className="btn-primary mt-5 w-full" onClick={place} disabled={placing || loading || !quote || quote.problems.length > 0}>
              {placing ? <Spinner /> : <Lock size={16} />}
              {method === 'COD' ? `Place order · ${quote ? inr(quote.total) : ''}` : `Pay ${quote ? inr(quote.total) : ''}`}
            </button>
            <p className="mt-3 text-center text-[12px] text-muted">Payments are encrypted and processed by Razorpay. We never see your card details.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
