import { AnimatePresence, motion } from 'framer-motion';
import { Box, Check, MessageCircle, Share2, Star, Truck } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Draw, Kalga, TempleBorder } from '@/components/Ornaments';
import { flyToBag, ProductCard, WishHeart } from '@/components/ProductCard';
import { EASE, Empty, Framed, RichText, Sheet, Spinner } from '@/components/ui';
import { ApiError, cached, get, post } from '@/lib/api';
import { track } from '@/lib/analytics';
import { gpuTier } from '@/lib/device';
import { dateIN, inr, occasionLabel, pctOff, waLink } from '@/lib/format';
import { useSeo } from '@/lib/hooks';
import { parseFrame, variant } from '@/lib/image';
import type { Card, Product as P, Review, Stitching } from '@/lib/types';
import { useBag, useBoot, useRecent, useUI } from '@/store';

const DrapeViewer = lazy(() => import('@/three/DrapeViewer'));

type Data = { product: P; related: Card[]; completeTheLook: Card[]; reviews: Review[]; rating: { avg: number | null; count: number } };

/** Press-and-hold (or hover on desktop) magnifier that follows the pointer. */
function WeaveZoom({ url, alt, priority, vtName, arch = true }: { url: string; alt: string; priority?: boolean; vtName?: string; arch?: boolean }) {
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoom = variant(parseFrame(url).src, 'zoom');
  const pos = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  return (
    <div
      className={`relative select-none ${arch ? 'arch arch-line' : 'overflow-hidden rounded-card'}`}
      style={{ touchAction: lens ? 'none' : 'pan-y' }}
      onPointerDown={(e) => {
        const p = pos(e);
        if (e.pointerType === 'mouse') return;
        hold.current = setTimeout(() => setLens(p), 220);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' || lens) setLens(pos(e));
      }}
      onPointerUp={() => {
        if (hold.current) clearTimeout(hold.current);
        setLens(null);
      }}
      onPointerLeave={() => {
        if (hold.current) clearTimeout(hold.current);
        setLens(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
      data-cursor="hide"
    >
      <Framed url={url} alt={alt} priority={priority} sizes="(min-width:1024px) 30vw, 100vw" vtName={vtName} />
      <AnimatePresence>
        {lens && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute h-40 w-40 rounded-full border-2 border-gold shadow-2xl md:h-48 md:w-48"
            style={{ left: `calc(${lens.x}% - 80px)`, top: `calc(${lens.y}% - 80px)`, backgroundImage: `url(${zoom})`, backgroundSize: '420%', backgroundPosition: `${lens.x}% ${lens.y}%` }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StitchForm({ value, onChange }: { value: Stitching | undefined; onChange: (s: Stitching) => void }) {
  const [v, setV] = useState<Partial<Stitching>>(value ?? {});
  const fields: [keyof Stitching, string][] = [
    ['bust', 'Bust'],
    ['waist', 'Waist'],
    ['shoulder', 'Shoulder'],
    ['sleeveLength', 'Sleeve length'],
    ['blouseLength', 'Blouse length'],
    ['neckFront', 'Front neck depth'],
    ['neckBack', 'Back neck depth'],
  ];
  const ok = fields.slice(0, 5).every(([k]) => typeof v[k] === 'number' && (v[k] as number) > 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onChange(v as Stitching);
      }}
    >
      <p className="mb-4 text-[14px] text-muted">All measurements in inches. Our tailor will WhatsApp you to confirm before cutting.</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, l], i) => (
          <label key={k}>
            <span className="label">
              {l}
              {i < 5 ? '' : ' (optional)'}
            </span>
            <input className="field" inputMode="decimal" value={(v[k] as number | undefined) ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : undefined })} required={i < 5} />
          </label>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="label">Notes for the tailor</span>
        <textarea className="field" rows={2} maxLength={400} value={v.notes ?? ''} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="e.g. princess cut, padded, back hooks" />
      </label>
      <button className="btn-primary mt-5 w-full" disabled={!ok}>
        Save measurements
      </button>
    </form>
  );
}

function PincodeCheck() {
  const [pin, setPin] = useState(() => localStorage.getItem('ts-pin') ?? '');
  const [res, setRes] = useState<{ city?: string; days: number; eta: string; cod: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async (p = pin) => {
    if (!/^[1-9]\d{5}$/.test(p)) return setErr('Enter a 6-digit pincode');
    setBusy(true);
    setErr(null);
    try {
      const r = await get<{ city?: string; days: number; eta: string; cod: boolean }>(`/pincode/${p}`);
      setRes(r);
      localStorage.setItem('ts-pin', p);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (pin.length === 6) void check(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="rounded-card border border-line p-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <label className="sr-only" htmlFor="pin">
          Pincode
        </label>
        <input id="pin" className="field" inputMode="numeric" maxLength={6} placeholder="Delivery pincode" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoComplete="postal-code" />
        <button className="btn-ghost min-h-[48px] px-5" disabled={busy}>
          {busy ? <Spinner /> : 'Check'}
        </button>
      </form>
      {err && <p className="mt-2 text-[14px] text-danger">{err}</p>}
      {res && (
        <ul className="mt-3 space-y-1.5 text-[14px]">
          <li className="flex items-center gap-2">
            <Truck size={16} className="text-sage" /> Delivery by <strong>{dateIN(res.eta, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
            {res.city ? ` to ${res.city}` : ''}
          </li>
          <li className="flex items-center gap-2">
            <Check size={16} className={res.cod ? 'text-sage' : 'text-muted'} /> {res.cod ? 'Cash on delivery available' : 'Prepaid only for this pincode'}
          </li>
        </ul>
      )}
    </div>
  );
}

function NotifyMe({ productId, colourId }: { productId: string; colourId: string }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  if (done) return <p className="text-[15px] text-sage">We will email you the moment it is back.</p>;
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await post('/stock-alerts', { productId, colourId, email }).catch(() => {});
        setDone(true);
      }}
    >
      <input type="email" required className="field" placeholder="Email me when it is back" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn-primary">Notify me</button>
    </form>
  );
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? 'fill-gold text-gold' : 'text-line'} />
      ))}
    </span>
  );
}

function Recent({ exclude }: { exclude: string }) {
  const all = useRecent((s) => s.ids);
  const key = useMemo(() => all.filter((x) => x !== exclude).slice(0, 4).join(','), [all, exclude]);
  const [items, setItems] = useState<Card[]>([]);
  useEffect(() => {
    if (!key) return;
    get<{ items: Card[] }>(`/products/by-ids?ids=${key}`).then((r) => setItems(r.items)).catch(() => {});
  }, [key]);
  if (!items.length) return null;
  return (
    <section className="page-x py-16">
      <h2 className="mb-8 font-serif text-d-4">Recently viewed</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {items.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

export default function Product() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [colourId, setColourId] = useState<string | null>(params.get('colour'));
  const [fallPico, setFallPico] = useState(false);
  const [stitch, setStitch] = useState<Stitching | undefined>();
  const [stitchOpen, setStitchOpen] = useState(false);
  const [tab, setTab] = useState<'details' | 'care' | 'shipping'>('details');
  const [drape, setDrape] = useState(false);
  const [canDrape, setCanDrape] = useState(false);
  const [slide, setSlide] = useState(0);
  const addRef = useRef<HTMLDivElement>(null);
  const store = useBoot((b) => b.boot?.store);
  const add = useBag((s) => s.add);
  const toast = useUI((s) => s.toast);
  const pushRecent = useRecent((s) => s.push);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    setD(null);
    setErr(null);
    cached<Data>(`/products/${slug}`, 20_000)
      .then((r) => {
        if (!alive) return;
        setD(r);
        pushRecent(r.product.id);
        setColourId((c) => (c && r.product.colours.some((x) => x.id === c) ? c : (r.product.colours.find((x) => x.inStock) ?? r.product.colours[0])?.id ?? null));
        track('view_item', { value: r.product.price / 100, items: [{ item_id: r.product.id, item_name: r.product.name }] });
      })
      .catch((e) => alive && setErr(e instanceof ApiError && e.status === 404 ? 'not-found' : (e as Error).message));
    void gpuTier().then((t) => setCanDrape(t === 'high'));
    return () => {
      alive = false;
    };
  }, [slug, pushRecent]);

  const p = d?.product;
  useSeo(p ? p.seoTitle || `${p.name} — ${p.fabric} saree` : undefined, p?.seoDescription ?? undefined);
  const colour = p?.colours.find((c) => c.id === colourId) ?? p?.colours[0];
  const images = useMemo(() => {
    if (!p) return [];
    const mine = p.images.filter((i) => i.colourId === colour?.id);
    const shared = p.images.filter((i) => !i.colourId);
    const list = [...mine, ...shared];
    return list.length ? list : p.images;
  }, [p, colour?.id]);
  useEffect(() => setSlide(0), [colour?.id]);

  if (err === 'not-found') return <Empty title="This saree has found its home" body="It may have sold out or been removed. Here are others you might love." action={<Link to="/shop" className="btn-primary">Browse sarees</Link>} />;
  if (err) return <Empty title="Could not load this saree" body={err} action={<button className="btn-primary" onClick={() => location.reload()}>Try again</button>} />;
  if (!p || !colour)
    return (
      <div className="page-x grid gap-8 py-8 lg:grid-cols-12">
        <div className="frame skeleton rounded-card lg:col-span-7" />
        <div className="space-y-4 lg:col-span-5">
          <div className="skeleton h-10 w-2/3 rounded" />
          <div className="skeleton h-6 w-1/3 rounded" />
          <div className="skeleton h-32 rounded" />
        </div>
      </div>
    );

  const price = p.price + (colour.priceDelta ?? 0);
  const mrp = p.mrp + (colour.priceDelta ?? 0);
  const services = (fallPico ? p.falloPicoPrice : 0) + (stitch ? p.stitchingPrice : 0);
  const off = pctOff(price, mrp);
  const detailRail = images.filter((i) => i.tag === 'DETAIL' || i.tag === 'FLATLAY');
  const pageUrl = typeof location !== 'undefined' ? location.href : '';

  const addToBag = (buyNow = false) => {
    if (!colour.inStock) return;
    add({ productId: p.id, colourId: colour.id, name: p.name, slug: p.slug, colourName: colour.name, image: images[0]?.url ?? null, price: price + services, options: { fallPico: fallPico || undefined, stitching: stitch } });
    flyToBag(addRef.current?.querySelector('img') ?? null, images[0]?.url ?? null);
    track('add_to_cart', { value: (price + services) / 100, items: [{ item_id: p.id, item_name: p.name, item_variant: colour.name }] });
    if (buyNow) {
      nav('/checkout');
      return;
    }
    toast(`${p.name} added to your bag`);
  };

  const share = async () => {
    const data = { title: p.name, text: `${p.name} — ${inr(price)} at Tarun Silks`, url: pageUrl };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else {
      await navigator.clipboard.writeText(pageUrl).catch(() => {});
      toast('Link copied');
    }
  };

  return (
    <div className="pb-28 md:pb-0">
      <div className="page-x grid gap-8 py-4 md:py-8 lg:grid-cols-12 lg:gap-12">
        {/* ------------- gallery */}
        <div className="lg:col-span-7" ref={addRef}>
          {drape && images[0] ? (
            <div className="frame rounded-card bg-blush">
              <Suspense fallback={<div className="frame-fill skeleton" />}>
                <DrapeViewer url={variant(parseFrame(images[0].url).src, 'main', 'jpg')} />
              </Suspense>
              <p className="pointer-events-none absolute bottom-3 left-0 w-full text-center text-[13px] text-muted">Drag to tilt · pinch or scroll to zoom</p>
            </div>
          ) : (
            <>
              {/* mobile: swipeable */}
              <div className="-mx-5 md:hidden">
                <div
                  className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
                  onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
                >
                  {images.map((im, i) => (
                    <div key={im.url} className="w-full shrink-0 snap-center px-5">
                      <WeaveZoom url={im.url} alt={im.alt} priority={i === 0} vtName={i === 0 ? 'product-hero' : undefined} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-center gap-1.5">
                  {images.map((_, i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-ink' : 'w-1.5 bg-line'}`} />
                  ))}
                </div>
                <p className="mt-2 text-center text-[13px] text-muted">Press and hold a photo to see the weave</p>
              </div>
              {/* desktop: large grid */}
              <div className="hidden grid-cols-2 gap-4 md:grid">
                {images.map((im, i) => (
                  <div key={im.url} className={i === 0 ? 'col-span-2 mx-auto w-full max-w-[560px]' : ''}>
                    <WeaveZoom url={im.url} alt={im.alt} priority={i === 0} vtName={i === 0 ? 'product-hero' : undefined} />
                  </div>
                ))}
              </div>
            </>
          )}
          {canDrape && images[0] && (
            <button className="chip mt-4" onClick={() => setDrape(!drape)} aria-pressed={drape}>
              <Box size={16} /> {drape ? 'Back to photos' : 'Drape view'}
            </button>
          )}
          {detailRail.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-serif text-xl">Pallu, border &amp; body</h2>
              <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto">
                {detailRail.map((im) => (
                  <div key={im.url} className="w-40 shrink-0 snap-start">
                    <div className="arch arch-line">
                      <Framed url={im.url} alt={im.alt} sizes="160px" />
                    </div>
                    <p className="mt-1 text-[13px] text-muted">{im.tag === 'DETAIL' ? 'Weave detail' : 'Pallu'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ------------- buy box */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)]">
            <nav className="mb-3 text-[13px] text-muted" aria-label="Breadcrumb">
              <Link to="/shop">Shop</Link> <span aria-hidden>/</span> <Link to={`/shop?fabric=${encodeURIComponent(p.fabric)}`}>{p.fabric}</Link>
            </nav>
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-serif text-d-3">{p.name}</h1>
              <WishHeart id={p.id} className="mt-1 shrink-0 border border-line" />
            </div>
            {d.rating.count > 0 && (
              <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-[14px] text-muted">
                <Stars value={d.rating.avg ?? 0} /> {d.rating.avg} · {d.rating.count} reviews
              </a>
            )}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-serif text-[2rem]">{inr(price)}</span>
              {off > 0 && (
                <>
                  <s className="text-muted">{inr(mrp)}</s>
                  <span className="text-[14px] font-medium text-sage">{off}% off</span>
                </>
              )}
            </div>
            <p className="text-[13px] text-muted">Inclusive of all taxes</p>

            <div className="mt-6">
              <p className="mb-2 text-[14px]">
                Colour: <strong>{colour.name}</strong>
              </p>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour">
                {p.colours.map((c) => (
                  <button
                    key={c.id}
                    role="radio"
                    aria-checked={c.id === colour.id}
                    aria-label={`${c.name}${c.inStock ? '' : ' (sold out)'}`}
                    onClick={() => setColourId(c.id)}
                    className={`relative h-11 w-11 rounded-full border-2 transition-transform ${c.id === colour.id ? 'scale-110 border-ink' : 'border-transparent'}`}
                  >
                    <span className="absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-full border border-ink/10" style={{ background: c.hex }} />
                    {!c.inStock && <span className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink" />}
                  </button>
                ))}
              </div>
              {colour.inStock && colour.stock != null && colour.stock <= 3 && <p className="mt-3 text-[14px] text-maroon">Only {colour.stock} left in this colour — handloom pieces are not restocked often.</p>}
            </div>

            <p className="mt-6 rounded-xl bg-blush px-4 py-3 text-[14px]">{p.lengthInfo}</p>

            {(p.falloPicoPrice > 0 || p.stitchingPrice > 0) && (
              <div className="mt-4 space-y-2">
                {p.falloPicoPrice > 0 && (
                  <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4">
                    <span className="flex items-center gap-3">
                      <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--maroon))]" checked={fallPico} onChange={(e) => setFallPico(e.target.checked)} />
                      Add fall &amp; pico
                    </span>
                    <span className="text-[14px] text-muted">+{inr(p.falloPicoPrice)}</span>
                  </label>
                )}
                {p.stitchingPrice > 0 && (
                  <div className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-line px-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--maroon))]" checked={!!stitch} onChange={(e) => (e.target.checked ? setStitchOpen(true) : setStitch(undefined))} />
                      Add stitched blouse
                    </label>
                    <span className="flex items-center gap-3 text-[14px] text-muted">
                      {stitch && (
                        <button className="underline" onClick={() => setStitchOpen(true)}>
                          Edit
                        </button>
                      )}
                      +{inr(p.stitchingPrice)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 hidden gap-3 md:flex">
              {colour.inStock ? (
                <>
                  <button className="btn-primary flex-1" onClick={() => addToBag(false)}>
                    Add to bag · {inr(price + services)}
                  </button>
                  <button className="btn-ghost" onClick={() => addToBag(true)}>
                    Buy now
                  </button>
                </>
              ) : (
                <div className="w-full">
                  <p className="mb-2 font-medium">{colour.name} is sold out</p>
                  <NotifyMe productId={p.id} colourId={colour.id} />
                </div>
              )}
            </div>
            {!colour.inStock && (
              <div className="mt-6 md:hidden">
                <p className="mb-2 font-medium">{colour.name} is sold out</p>
                <NotifyMe productId={p.id} colourId={colour.id} />
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {store?.whatsapp && (
                <a className="chip flex-1 justify-center" href={waLink(store.whatsapp, `Hi! I have a question about ${p.name} (${colour.name}): ${pageUrl}`)} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> Ask about this saree
                </a>
              )}
              <button className="chip" onClick={share} aria-label="Share">
                <Share2 size={16} /> Share
              </button>
            </div>

            <div className="mt-6">
              <PincodeCheck />
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-[13px]">
              {p.handloomMark && <span className="rounded-full bg-gold/15 px-3 py-1.5 text-ink">Handloom Mark certified</span>}
              <span className="rounded-full bg-sage/15 px-3 py-1.5">Secure payment · UPI, cards</span>
              <span className="rounded-full bg-sage/15 px-3 py-1.5">Easy 7-day returns</span>
            </div>

            {/* tabs */}
            <div className="mt-8 border-t border-line pt-6">
              <div className="mb-4 flex gap-6" role="tablist">
                {(
                  [
                    ['details', 'Details'],
                    ['care', 'Care'],
                    ['shipping', 'Shipping & returns'],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`border-b-2 pb-2 text-[15px] transition-colors ${tab === k ? 'border-maroon text-ink' : 'border-transparent text-muted'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {tab === 'details' && (
                <div>
                  <RichText html={p.description} className="text-[15px]" />
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px]">
                    {(
                      [
                        ['Fabric', p.fabric],
                        ['Weave', p.weave],
                        ['Work', p.work],
                        ['Border', p.border],
                        ['Pallu', p.pallu],
                        ['Origin', p.origin],
                        ['Blouse', p.blouseIncluded ? 'Unstitched piece included' : 'Not included'],
                        ['Occasion', p.occasions.map((o) => occasionLabel[o] ?? o).join(', ')],
                      ] as [string, string | null][]
                    )
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-muted">{k}</dt>
                          <dd className="capitalize">{v}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              )}
              {tab === 'care' && (p.care ? <RichText html={p.care} className="text-[15px]" /> : <p className="text-muted">Dry clean recommended.</p>)}
              {tab === 'shipping' && (
                <div className="rich text-[15px]">
                  <p>Ships within 24 hours from our studio. Free shipping above ₹2,999.</p>
                  <ul>
                    <li>7-day easy returns on unused sarees with tags</li>
                    <li>Sarees with fall &amp; pico or stitched blouses are made for you and cannot be returned</li>
                  </ul>
                  <p>
                    <Link to="/pages/returns">Read the full returns policy</Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TempleBorder className="my-10 h-4 w-full text-gold/60" />

      {/* reviews */}
      <section id="reviews" className="page-x py-10">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-serif text-d-4">Reviews</h2>
          {d.rating.count > 0 && (
            <p className="flex items-center gap-2 text-muted">
              <Stars value={d.rating.avg ?? 0} size={16} /> {d.rating.avg} out of 5
            </p>
          )}
        </div>
        {d.reviews.length === 0 ? (
          <p className="text-muted">No reviews yet. Reviews open once a saree has been delivered — they come only from verified buyers.</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {d.reviews.map((r) => (
              <li key={r.id} className="card p-5">
                <Stars value={r.rating} />
                {r.title && <p className="mt-2 font-serif text-xl">{r.title}</p>}
                <p className="mt-1 text-[15px]">{r.body}</p>
                {r.photos.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {r.photos.map((ph) => (
                      <img key={ph} src={variant(ph, 'thumb')} alt="" className="h-20 w-16 rounded-lg object-cover" loading="lazy" />
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[13px] text-muted">
                  {r.name} · verified buyer · {dateIN(r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.completeTheLook.length > 0 && (
        <section className="page-x py-12">
          <div className="mb-8 flex items-center gap-4">
            <Draw className="w-10 text-gold">
              <Kalga />
            </Draw>
            <h2 className="font-serif text-d-4">Complete the look</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {d.completeTheLook.map((c) => (
              <ProductCard key={c.id} p={c} />
            ))}
          </div>
        </section>
      )}
      {d.related.length > 0 && (
        <section className="page-x py-12">
          <h2 className="mb-8 font-serif text-d-4">You may also like</h2>
          <div className="no-scrollbar -mx-5 flex snap-x gap-4 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:px-0">
            {d.related.slice(0, 4).map((c) => (
              <div key={c.id} className="w-[64vw] shrink-0 snap-start md:w-auto">
                <ProductCard p={c} />
              </div>
            ))}
          </div>
        </section>
      )}
      <Recent exclude={p.id} />

      {/* mobile sticky buy bar */}
      {colour.inStock && (
        <div className="safe-bottom fixed bottom-0 left-0 z-[55] w-full border-t border-line bg-ivory/95 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-serif text-xl leading-none">{inr(price + services)}</p>
              <p className="truncate text-[12px] text-muted">{colour.name}</p>
            </div>
            <button className="btn-ghost ml-auto min-h-[46px] px-4" onClick={() => addToBag(true)}>
              Buy now
            </button>
            <motion.button whileTap={{ scale: 0.96 }} transition={{ ease: EASE }} className="btn-primary min-h-[46px] px-5" onClick={() => addToBag(false)}>
              Add to bag
            </motion.button>
          </div>
        </div>
      )}

      <Sheet open={stitchOpen} onClose={() => setStitchOpen(false)} title="Blouse measurements" side="bottom">
        <StitchForm
          value={stitch}
          onChange={(s) => {
            setStitch(s);
            setStitchOpen(false);
            toast('Measurements saved');
          }}
        />
      </Sheet>
    </div>
  );
}
