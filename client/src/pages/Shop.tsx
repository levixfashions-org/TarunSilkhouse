import { AnimatePresence, motion } from 'framer-motion';
import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Kolam, TempleBorder } from '@/components/Ornaments';
import { CardSkeleton, ProductCard } from '@/components/ProductCard';
import { EASE, Empty, Framed, Reveal, RichText, Sheet } from '@/components/ui';
import { cached, get } from '@/lib/api';
import { colourFamilies, occasionLabel, workLabel } from '@/lib/format';
import { useSeo } from '@/lib/hooks';
import type { Card } from '@/lib/types';

type Facets = { fabrics: { value: string; count: number }[]; works: { value: string; count: number }[]; colours: { value: string; count: number }[]; occasions: string[]; price: { min: number; max: number } };
type Col = { handle: string; title: string; description: string | null; image: string | null; accent: string | null; isEditorial: boolean };
type Page = { items: Card[]; total: number; page: number; pages: number };

const MULTI = ['fabric', 'occasion', 'colour', 'work'] as const;
const SORTS: [string, string][] = [
  ['featured', 'Featured'],
  ['new', 'Newest'],
  ['popular', 'Most loved'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
];

function Filters({ params, set, facets }: { params: URLSearchParams; set: (k: string, v: string | null) => void; facets: Facets | null }) {
  const list = (k: string) => (params.get(k) ?? '').split(',').filter(Boolean);
  const toggle = (k: string, v: string) => {
    const cur = list(k);
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    set(k, next.length ? next.join(',') : null);
  };
  const group = (title: string, k: string, opts: { value: string; label: string; swatch?: string; count?: number }[]) => (
    <fieldset className="border-b border-line py-5">
      <legend className="mb-3 font-serif text-xl">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button key={o.value} type="button" className="chip" aria-pressed={list(k).includes(o.value)} onClick={() => toggle(k, o.value)}>
            {o.swatch && <span className="h-3.5 w-3.5 rounded-full border border-ink/15" style={{ background: o.swatch }} />}
            {o.label}
            {o.count !== undefined && <span className="text-[12px] opacity-60">{o.count}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div>
      {facets && group('Fabric', 'fabric', facets.fabrics.map((f) => ({ value: f.value, label: f.value, count: f.count })))}
      {group('Occasion', 'occasion', Object.entries(occasionLabel).map(([value, label]) => ({ value, label })))}
      {group(
        'Colour',
        'colour',
        colourFamilies.filter((c) => !facets || facets.colours.some((x) => x.value === c.value)).map((c) => ({ value: c.value, label: c.label, swatch: c.hex })),
      )}
      {facets && group('Work', 'work', facets.works.map((w) => ({ value: w.value, label: workLabel[w.value] ?? w.value })))}
      <fieldset className="border-b border-line py-5">
        <legend className="mb-3 font-serif text-xl">Price (₹)</legend>
        <div className="flex items-center gap-3">
          <input
            className="field"
            inputMode="numeric"
            placeholder={`${facets?.price.min ?? 0}`}
            defaultValue={params.get('min') ?? ''}
            onBlur={(e) => set('min', e.target.value.replace(/\D/g, '') || null)}
            aria-label="Minimum price"
          />
          <span className="text-muted">to</span>
          <input
            className="field"
            inputMode="numeric"
            placeholder={`${facets?.price.max ?? 30000}`}
            defaultValue={params.get('max') ?? ''}
            onBlur={(e) => set('max', e.target.value.replace(/\D/g, '') || null)}
            aria-label="Maximum price"
          />
        </div>
      </fieldset>
      <div className="space-y-3 py-5">
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span>Blouse piece included</span>
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--maroon))]" checked={params.get('blouse') === '1'} onChange={(e) => set('blouse', e.target.checked ? '1' : null)} />
        </label>
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span>In stock only</span>
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--maroon))]" checked={params.get('inStock') === '1'} onChange={(e) => set('inStock', e.target.checked ? '1' : null)} />
        </label>
      </div>
    </div>
  );
}

export default function Shop({ editorial = false }: { editorial?: boolean }) {
  const { handle } = useParams();
  const [params, setParams] = useSearchParams();
  const [facets, setFacets] = useState<Facets | null>(null);
  const [col, setCol] = useState<Col | null>(null);
  const [items, setItems] = useState<Card[] | null>(null);
  const [meta, setMeta] = useState<{ total: number; page: number; pages: number }>({ total: 0, page: 1, pages: 1 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useSeo(col?.title ?? (params.get('q') ? `Search: ${params.get('q')}` : 'Shop all sarees'), col?.description?.replace(/<[^>]+>/g, '').slice(0, 160));

  useEffect(() => {
    cached<Facets>('/facets', 300_000).then(setFacets).catch(() => {});
  }, []);
  useEffect(() => {
    setCol(null);
    if (!handle) return;
    get<{ collection: Col }>(`/collections/${handle}`)
      .then((r) => setCol(r.collection))
      .catch((e) => setErr((e as Error).message));
  }, [handle]);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const [k, v] of params) if (v) q.set(k, v);
    if (handle) q.set('collection', handle);
    q.set('limit', '12');
    return q;
  }, [params, handle]);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setErr(null);
    get<Page>(`/products?${query.toString()}`)
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setMeta(r);
      })
      .catch((e) => alive && setErr((e as Error).message));
    return () => {
      alive = false;
    };
  }, [query]);

  const loadMore = async () => {
    setLoadingMore(true);
    const q = new URLSearchParams(query);
    q.set('page', String(meta.page + 1));
    try {
      const r = await get<Page>(`/products?${q.toString()}`);
      setItems((x) => [...(x ?? []), ...r.items]);
      setMeta(r);
    } finally {
      setLoadingMore(false);
    }
  };

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };
  const active: [string, string][] = [];
  for (const k of MULTI) for (const v of (params.get(k) ?? '').split(',').filter(Boolean)) active.push([k, v]);
  if (params.get('min')) active.push(['min', `From ₹${params.get('min')}`]);
  if (params.get('max')) active.push(['max', `Up to ₹${params.get('max')}`]);
  const removeChip = (k: string, v: string) => {
    if (k === 'min' || k === 'max') return set(k, null);
    const next = (params.get(k) ?? '').split(',').filter((x) => x && x !== v);
    set(k, next.length ? next.join(',') : null);
  };
  const chipLabel = (k: string, v: string) => (k === 'occasion' ? occasionLabel[v] : k === 'colour' ? (colourFamilies.find((c) => c.value === v)?.label ?? v) : k === 'work' ? (workLabel[v] ?? v) : v);

  const isEdit = editorial || col?.isEditorial;
  const accent = col?.accent ?? '#6B1F2A';
  const title = col?.title ?? (params.get('q') ? `“${params.get('q')}”` : 'All sarees');

  return (
    <div>
      {isEdit && col ? (
        /* -------- editorial look-book header: asymmetric, art-directed with the collection's own accent */
        <section className="relative overflow-hidden" style={{ background: `${accent}14` }}>
          <div className="page-x grid gap-8 py-12 md:grid-cols-12 md:py-20">
            <div className="relative z-10 md:col-span-6 md:pt-16">
              <Reveal lines={col.title.split(' ').length > 2 ? [col.title.split(' ').slice(0, 2).join(' '), col.title.split(' ').slice(2).join(' ')] : [col.title]} italicLast as="h1" className="font-serif text-d-1" />
              {col.description && <RichText html={col.description} className="mt-8 max-w-md font-serif text-[1.5rem] leading-snug" />}
              <div className="mt-8 h-px w-24" style={{ background: accent }} />
            </div>
            <div className="relative md:col-span-6">
              <div className="relative ml-auto w-[78%]">
                <Framed url={col.image} alt={col.title} priority sizes="40vw" className="rounded-[26px]" />
              </div>
              <div className="absolute -bottom-6 left-0 w-[42%] md:-left-10">
                <Framed url={items?.[1]?.images[0]?.url} alt="" sizes="20vw" className="rounded-[20px] shadow-2xl ring-8 ring-ivory" />
              </div>
              <p className="absolute right-0 top-4 hidden max-w-[10rem] rotate-90 origin-top-right translate-x-full font-serif text-lg italic text-muted md:block">woven to be passed down</p>
            </div>
          </div>
          <TempleBorder className="h-4 w-full" style={{ color: accent }} />
        </section>
      ) : (
        <section className="relative overflow-hidden border-b border-line">
          <Kolam className="pointer-events-none absolute -right-8 -top-8 h-56 w-56 text-gold/20" />
          <div className="page-x py-12 md:py-16">
            <nav className="mb-4 text-[13px] text-muted" aria-label="Breadcrumb">
              <Link to="/">Home</Link> <span aria-hidden>/</span> <Link to="/shop">Shop</Link>
              {col && (
                <>
                  {' '}
                  <span aria-hidden>/</span> {col.title}
                </>
              )}
            </nav>
            <Reveal lines={[title]} as="h1" className="font-serif text-d-2" />
            {col?.description && <RichText html={col.description} className="mt-4 max-w-xl text-muted" />}
          </div>
        </section>
      )}

      <div className="page-x py-8">
        <div className="sticky top-[var(--header-h)] z-30 -mx-5 mb-6 flex items-center justify-between gap-3 border-b border-line bg-ivory/90 px-5 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
          <button className="chip lg:hidden" onClick={() => setSheet(true)}>
            <SlidersHorizontal size={16} /> Filters {active.length > 0 && `(${active.length})`}
          </button>
          <p className="hidden text-[14px] text-muted lg:block">{items ? `${meta.total} sarees` : 'Loading…'}</p>
          <label className="flex items-center gap-2 text-[14px]">
            <span className="hidden sm:inline">Sort</span>
            <select className="rounded-full border border-line bg-paper px-4 py-2" value={params.get('sort') ?? 'featured'} onChange={(e) => set('sort', e.target.value === 'featured' ? null : e.target.value)}>
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        {active.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {active.map(([k, v]) => (
              <button key={`${k}${v}`} className="chip border-ink bg-ink text-ivory" onClick={() => removeChip(k, v)}>
                {chipLabel(k, v)} <X size={14} />
              </button>
            ))}
            <button className="text-[14px] underline underline-offset-4" onClick={() => setParams(params.get('q') ? { q: params.get('q')! } : {}, { replace: true })}>
              Clear all
            </button>
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-12">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-[calc(var(--header-h)+16px)] max-h-[calc(100vh-var(--header-h)-32px)] overflow-y-auto pr-4" data-lenis-prevent>
              <Filters params={params} set={set} facets={facets} />
            </div>
          </aside>
          <div className="lg:col-span-9">
            {err ? (
              <Empty title="We could not load sarees" body={err} action={<button className="btn-primary" onClick={() => setParams(new URLSearchParams(params))}>Try again</button>} />
            ) : items && items.length === 0 ? (
              <Empty title="No sarees match these filters" body="Try removing a filter or two — new weaves arrive every week." action={<button className="btn-primary" onClick={() => setParams({}, { replace: true })}>Clear filters</button>} />
            ) : (
              <motion.div layout className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6">
                <AnimatePresence mode="popLayout">
                  {(items ?? Array.from({ length: 6 }, () => null)).map((p, i) =>
                    p ? (
                      <motion.div key={p.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: EASE, delay: Math.min(i % 12, 6) * 0.04 }}>
                        <ProductCard p={p} priority={i < 2} sizes="(min-width:1024px) 25vw, 50vw" />
                      </motion.div>
                    ) : (
                      <CardSkeleton key={i} />
                    ),
                  )}
                </AnimatePresence>
              </motion.div>
            )}
            {items && meta.page < meta.pages && (
              <div className="mt-14 text-center">
                <p className="mb-4 text-[14px] text-muted">
                  Showing {items.length} of {meta.total}
                </p>
                <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more sarees'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filters"
        side="bottom"
        footer={
          <button className="btn-primary w-full" onClick={() => setSheet(false)}>
            Show {meta.total} sarees
          </button>
        }
      >
        <Filters params={params} set={set} facets={facets} />
      </Sheet>
    </div>
  );
}
