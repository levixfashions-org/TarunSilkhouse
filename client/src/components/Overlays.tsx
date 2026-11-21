import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '@/lib/api';
import { consent, loadAnalytics } from '@/lib/analytics';
import { inr } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import type { Quote } from '@/lib/types';
import { useBag, useBoot, useUI } from '@/store';
import { EASE, Framed, Sheet } from './ui';

type Suggest = { products: { slug: string; name: string; price: number; fabric: string; image: string | null }[]; collections: { handle: string; title: string }[] };

export function SearchOverlay() {
  const { searchOpen, setSearch } = useUI();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 220);
  const [res, setRes] = useState<Suggest | null>(null);
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) setTimeout(() => input.current?.focus(), 80);
    else setQ('');
  }, [searchOpen]);
  useEffect(() => {
    if (!dq) return setRes(null);
    let alive = true;
    get<Suggest>(`/search/suggest?q=${encodeURIComponent(dq)}`)
      .then((r) => alive && setRes(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [dq]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === 'Escape') setSearch(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearch]);

  const go = (to: string) => {
    setSearch(false);
    nav(to);
  };
  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          className="fixed left-0 top-0 z-[90] h-full w-full overflow-y-auto bg-ivory/97 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          role="dialog"
          aria-label="Search"
          data-lenis-prevent
        >
          <div className="page-x pt-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) go(`/shop?q=${encodeURIComponent(q.trim())}`);
              }}
              className="flex items-center gap-3 border-b border-ink/20 pb-3"
            >
              <Search size={24} strokeWidth={1.4} className="text-muted" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search Kanjivaram, red silk, wedding…"
                className="min-w-0 flex-1 bg-transparent font-serif text-[2rem] outline-none placeholder:text-muted/50 md:text-[3rem]"
                aria-label="Search sarees"
                enterKeyHint="search"
              />
              <button type="button" onClick={() => setSearch(false)} className="flex h-11 w-11 items-center justify-center" aria-label="Close search">
                <X size={24} strokeWidth={1.4} />
              </button>
            </form>
            {!res && (
              <div className="py-8">
                <p className="mb-3 text-[14px] text-muted">Popular searches</p>
                <div className="flex flex-wrap gap-2">
                  {['Kanjivaram', 'Banarasi', 'Bridal', 'Chanderi', 'Linen', 'Red silk', 'Under 5000'].map((t) => (
                    <button key={t} className="chip" onClick={() => go(t === 'Under 5000' ? '/collections/under-5000' : `/shop?q=${encodeURIComponent(t === 'Bridal' ? 'wedding' : t)}`)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {res && (
              <div className="grid gap-8 py-8 md:grid-cols-12">
                <div className="md:col-span-3">
                  {res.collections.length > 0 && <p className="mb-3 text-[14px] text-muted">Collections</p>}
                  <ul className="space-y-2">
                    {res.collections.map((c) => (
                      <li key={c.handle}>
                        <button onClick={() => go(`/collections/${c.handle}`)} className="font-serif text-2xl hover:text-maroon">
                          {c.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:col-span-9">
                  {res.products.length === 0 ? (
                    <p className="text-muted">No sarees match “{dq}”. Try a fabric name like Kanjivaram or a colour.</p>
                  ) : (
                    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
                      {res.products.map((p) => (
                        <li key={p.slug}>
                          <button onClick={() => go(`/products/${p.slug}`)} className="block w-full text-left">
                            <Framed url={p.image} alt={p.name} sizes="160px" className="rounded-xl" />
                            <p className="mt-2 text-[13px] text-muted">{p.fabric}</p>
                            <p className="font-serif text-lg leading-tight">{p.name}</p>
                            <p className="text-[14px]">{inr(p.price)}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {res.products.length > 0 && (
                    <button onClick={() => go(`/shop?q=${encodeURIComponent(dq)}`)} className="btn-ghost mt-8">
                      See all results
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Live server quote for the bag (prices/stock always come from the server). */
export function useQuote(extra: { couponCode?: string; pincode?: string; paymentMethod?: 'RAZORPAY' | 'COD'; giftWrap?: boolean } = {}) {
  const items = useBag((s) => s.items);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const key = useMemo(() => JSON.stringify({ items: items.map(({ productId, colourId, qty, options }) => ({ productId, colourId, qty, options })), ...extra }), [items, extra]);
  useEffect(() => {
    if (!items.length) return setQuote(null);
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      post<{ quote: Quote }>('/checkout/quote', JSON.parse(key))
        .then((r) => alive && setQuote(r.quote))
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [key, items.length]);
  return { quote, loading };
}

export function FreeShipBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  const left = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div>
      <p className="text-[14px]">{left > 0 ? <>Add {inr(left)} more for free shipping</> : <>Free shipping unlocked</>}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <motion.div className="h-full bg-gold" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: EASE }} />
      </div>
    </div>
  );
}

export function BagDrawer() {
  const { items, open, setOpen, setQty, remove } = useBag();
  const { quote } = useQuote();
  const free = useBoot((b) => b.boot?.shipping.freeShippingAbove ?? 299900);
  const nav = useNavigate();
  const problems = new Map((quote?.problems ?? []).map((p) => [p.colourId, p.message]));
  const priceOf = (key: string) => quote?.lines.find((l) => `${l.productId}:${l.colourId}` === key.split(':').slice(0, 2).join(':'));

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={`Your bag${items.length ? ` (${items.reduce((s, i) => s + i.qty, 0)})` : ''}`}
      footer={
        items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="font-serif text-2xl">{quote ? inr(quote.subtotal) : '—'}</span>
            </div>
            <p className="text-[13px] text-muted">Shipping and coupon applied at checkout. Prices include GST.</p>
            <button
              className="btn-primary w-full"
              disabled={!!quote?.problems.length}
              onClick={() => {
                setOpen(false);
                nav('/checkout');
              }}
            >
              Checkout
            </button>
          </div>
        )
      }
    >
      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-serif text-2xl">Your bag is empty</p>
          <p className="mt-2 text-muted">Find a saree you love and it will wait here.</p>
          <Link to="/shop" onClick={() => setOpen(false)} className="btn-primary mt-6">
            Browse sarees
          </Link>
        </div>
      ) : (
        <>
          <FreeShipBar subtotal={quote?.subtotal ?? items.reduce((s, i) => s + i.price * i.qty, 0)} threshold={free} />
          <ul className="mt-6 divide-y divide-line">
            {items.map((it) => {
              const line = priceOf(it.key);
              const problem = problems.get(it.colourId);
              return (
                <li key={it.key} className="flex gap-4 py-4">
                  <Link to={`/products/${it.slug}`} onClick={() => setOpen(false)} className="w-20 shrink-0">
                    <Framed url={it.image} alt={it.name} sizes="80px" className="rounded-xl" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-serif text-lg leading-tight">{it.name}</p>
                        <p className="text-[13px] text-muted">{it.colourName}</p>
                        {it.options?.fallPico && <p className="text-[13px] text-muted">+ Fall &amp; pico</p>}
                        {it.options?.stitching && <p className="text-[13px] text-muted">+ Stitched blouse</p>}
                      </div>
                      <p className="shrink-0 text-[15px]">{inr(line ? line.lineTotal : it.price * it.qty)}</p>
                    </div>
                    {problem && <p className="mt-1 text-[13px] text-danger">{problem}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-line">
                        <button className="flex h-9 w-9 items-center justify-center" onClick={() => setQty(it.key, it.qty - 1)} aria-label="Decrease quantity" disabled={it.qty <= 1}>
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-[14px]" aria-live="polite">
                          {it.qty}
                        </span>
                        <button className="flex h-9 w-9 items-center justify-center" onClick={() => setQty(it.key, it.qty + 1)} aria-label="Increase quantity">
                          <Plus size={14} />
                        </button>
                      </div>
                      <button onClick={() => remove(it.key)} className="flex h-9 items-center gap-1 text-[13px] text-muted hover:text-danger" aria-label={`Remove ${it.name}`}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
}

export function ConsentBanner() {
  const s = useBoot((b) => b.boot?.store);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!s || (!s.gaId && !s.metaPixelId)) return;
    const c = consent.get();
    if (c === 'yes') loadAnalytics(s.gaId, s.metaPixelId);
    else if (c === null) setShow(true);
  }, [s]);
  if (!show || !s) return null;
  return (
    <div className="fixed bottom-[calc(var(--tabbar-h)+12px)] left-3 right-3 z-[70] mx-auto max-w-lg rounded-card border border-line bg-paper p-4 shadow-xl md:bottom-6">
      <p className="text-[14px]">We use cookies to understand what you love and improve the store. You can say no — the shop works the same.</p>
      <div className="mt-3 flex gap-2">
        <button
          className="btn-primary min-h-[40px] px-5"
          onClick={() => {
            consent.set('yes');
            loadAnalytics(s.gaId, s.metaPixelId);
            setShow(false);
          }}
        >
          Accept
        </button>
        <button
          className="btn-ghost min-h-[40px] px-5"
          onClick={() => {
            consent.set('no');
            setShow(false);
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

/** Asks to refresh when a new service-worker version is ready. */
export function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const on = (e: Event) => setWaiting((e as CustomEvent<ServiceWorker>).detail);
    window.addEventListener('ts-sw-update', on);
    return () => window.removeEventListener('ts-sw-update', on);
  }, []);
  if (!waiting) return null;
  return (
    <div className="fixed left-1/2 top-4 z-[99] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-[14px] text-ivory shadow-xl">
      A new version is ready
      <button
        className="rounded-full bg-gold px-4 py-2 text-[#1B1612]"
        onClick={() => {
          waiting.postMessage('skip-waiting');
          setWaiting(null);
        }}
      >
        Refresh
      </button>
    </div>
  );
}
