import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardSkeleton, ProductCard } from '@/components/ProductCard';
import { Draw, Kalga, Kolam, Lotus, Peacock, TempleBorder } from '@/components/Ornaments';
import { EASE, Framed, Magnetic, Reveal } from '@/components/ui';
import { cached, post } from '@/lib/api';
import { gpuTier } from '@/lib/device';
import { useInView, useMedia, useReveal, useSeo } from '@/lib/hooks';
import type { Card, HomeSection } from '@/lib/types';
import { useBoot, useUI } from '@/store';

const SilkHero = lazy(() => import('@/three/SilkHero'));

type List = { items: Card[] };
const s = <T,>(v: unknown, d: T): T => (v === undefined || v === null ? d : (v as T));
/** Headings typed in the admin: a line break splits into two lines (the second is italic). */
const lines = (title: string | null | undefined, fallback: string[]) => {
  const t = (title ?? '').trim();
  return t ? t.split(/\n+/).map((x) => x.trim()).filter(Boolean) : fallback;
};

/* ------------------------------------------------------------------ hero */
function Hero({ sec }: { sec: HomeSection }) {
  const d = sec.data;
  const [mode, setMode] = useState<'pending' | 'gl' | 'fallback'>('pending');
  const [ref, inView] = useInView<HTMLElement>('0px');
  const [visible, setVisible] = useState(true);
  const scroll = useRef(0);
  const textRef = useReveal<HTMLDivElement>(0.01);
  const dark = useUI((u) => u.theme) === 'dark';

  useEffect(() => {
    let alive = true;
    void gpuTier().then((t) => alive && setMode(t === 'high' ? 'gl' : 'fallback'));
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    const onScroll = () => {
      scroll.current = Math.min(1, window.scrollY / window.innerHeight);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const video = s<string>(d.video, '');
  const poster = s<string>(d.poster, '') || '/hero-poster.jpg';

  return (
    <section ref={ref} className="grain relative -mt-[var(--header-h)] h-[100svh] min-h-[560px] overflow-hidden bg-[#1B0A0E] text-[#FBF7F0]">
      {/* fallback always rendered underneath: poster (and admin video if set) */}
      <div className="absolute left-0 top-0 h-full w-full">
        {video && mode === 'fallback' ? (
          // muted + playsInline + autoplay so iPhone Safari plays it; never gated on Reduce Motion
          <video className="h-full w-full object-cover" src={video} poster={poster} autoPlay muted loop playsInline preload="metadata" />
        ) : (
          <img src={poster} alt="" className="h-full w-full object-cover" fetchPriority="high" />
        )}
      </div>
      {mode === 'gl' && (
        <Suspense fallback={null}>
          <SilkHero scrollRef={scroll} active={inView && visible} onFail={() => setMode('fallback')} dark={dark} />
        </Suspense>
      )}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-gradient-to-b from-[#1B0A0E]/50 via-transparent to-[#1B0A0E]/70" />

      <div ref={textRef} className="page-x relative flex h-full flex-col justify-end pb-[calc(var(--tabbar-h)+40px)] md:justify-center md:pb-0">
        <p className="mb-6 max-w-xs text-[15px] text-[#FBF7F0]/80 opacity-0 transition-opacity delay-700 duration-1200 [.is-in_&]:opacity-100">{s(d.eyebrow, '')}</p>
        <h1 className="font-serif text-d-1">
          <span className="mask-line">
            <span>{s(d.line1, 'Six yards')}</span>
          </span>
          <span className="mask-line">
            <span className="italic text-[#E6C27A]">{s(d.line2, 'of poetry.')}</span>
          </span>
        </h1>
        <div className="mt-10 flex flex-wrap items-center gap-4 opacity-0 transition-opacity delay-1000 duration-1200 [.is-in_&]:opacity-100">
          <Magnetic>
            <Link to={s(d.ctaLink, '/shop')} className="btn-gold pointer-events-auto px-8" data-cursor="view" data-cursor-label="Enter">
              {s(d.cta, 'Explore the collection')}
            </Link>
          </Magnetic>
          {s<string>(d.secondary, '') && (
            <Link to={s(d.secondaryLink, '/')} className="pointer-events-auto text-[15px] text-[#FBF7F0]/85 underline decoration-[#B8893B] underline-offset-[6px] hover:text-[#FBF7F0]">
              {s(d.secondary, '')}
            </Link>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 w-full">
        <TempleBorder className="h-4 w-full text-[#B8893B]/70" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ marquee */
function Marquee({ sec }: { sec: HomeSection }) {
  const items = s<string[]>(sec.data.items, []);
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-b border-line bg-gold/90 py-3 text-[#1B1612]" aria-hidden>
      <div className="marquee">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((t, i) => (
              <span key={`${k}${i}`} className="flex items-center gap-6 px-6 font-serif text-[1.4rem] italic">
                {t}
                <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden>
                  <path d="M5 0L10 5L5 10L0 5Z" fill="currentColor" />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ story (pinned, scroll-scrubbed) */
function Story({ sec }: { sec: HomeSection }) {
  const steps = s<{ title: string; body: string }[]>(sec.data.steps, []);
  const root = useRef<HTMLElement>(null);
  const cloth = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let kill: (() => void) | null = null;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: '+=220%',
            scrub: 0.8,
            pin: true,
            anticipatePin: 1,
            onUpdate: (st) => setActive(Math.min(steps.length - 1, Math.floor(st.progress * steps.length * 0.999))),
          },
        });
        // the saree unfurls across the page: loom (rolled) → weaver → full drape
        tl.fromTo(cloth.current, { scaleX: 0.08, skewY: -6 }, { scaleX: 1, skewY: 0, ease: 'none' }, 0);
        tl.fromTo(thread.current, { scaleY: 0 }, { scaleY: 1, ease: 'none' }, 0);
      }, root);
      kill = () => ctx.revert();
    });
    return () => kill?.();
  }, [steps.length]);

  return (
    <section ref={root} className="relative h-[100svh] overflow-hidden bg-ivory">
      {/* gold progress thread */}
      <div className="absolute left-5 top-[15%] h-[70%] w-px bg-line md:left-10">
        <div ref={thread} className="h-full w-full origin-top bg-gold" />
      </div>
      <div className="page-x grid h-full items-center gap-10 md:grid-cols-12">
        <div className="pl-6 md:col-span-5 md:pl-10">
          <h2 className="mb-10 font-serif text-d-3">{lines(sec.title, ['From loom to drape']).join(' ')}</h2>
          <ol className="space-y-8">
            {steps.map((st, i) => (
              <li key={st.title} className={`transition-opacity duration-900 ease-silk ${i === active ? 'opacity-100' : 'opacity-30'}`}>
                <p className="font-serif text-[1.1rem] text-gold">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-serif text-[2rem] leading-tight">{st.title}</h3>
                <p className="mt-2 max-w-sm text-muted">{st.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative hidden h-[64vh] md:col-span-7 md:block">
          <div ref={cloth} className="absolute left-0 top-0 h-full w-full origin-left overflow-hidden rounded-[28px] bg-maroon shadow-2xl">
            <div className="absolute left-0 top-0 h-full w-full opacity-40">
              <svg width="100%" height="100%" aria-hidden>
                <defs>
                  <pattern id="story-butti" width="64" height="72" patternUnits="userSpaceOnUse">
                    <path d="M32 16c8 8 8 20 0 26c-8-6-8-18 0-26z" fill="#C99A45" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#story-butti)" />
              </svg>
            </div>
            <div className="absolute bottom-0 left-0 h-[22%] w-full bg-[#2A0B12]">
              <TempleBorder className="mt-4 h-6 w-full text-[#C99A45]" />
            </div>
            <div className="absolute left-0 top-0 h-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,230,190,.18)_35%,transparent_50%,transparent_60%,rgba(0,0,0,.18)_75%,transparent_90%)]" />
          </div>
        </div>
        {/* mobile: show the cloth as a slim unfurling band */}
        <div className="relative h-40 md:hidden">
          <div className="absolute left-0 top-0 h-full w-full overflow-hidden rounded-card bg-maroon">
            <TempleBorder className="absolute bottom-3 h-5 w-full text-[#C99A45]" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ collections: horizontal pinned gallery */
function Collections({ sec }: { sec: HomeSection }) {
  const boot = useBoot((b) => b.boot);
  const handles = s<string[]>(sec.data.handles, []);
  const cols = handles.map((h) => boot?.collections.find((c) => c.handle === h)).filter(Boolean) as NonNullable<typeof boot>['collections'];
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const desktop = useMedia('(min-width: 768px)');

  useEffect(() => {
    if (!desktop || !cols.length) return;
    let kill: (() => void) | null = null;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        const dist = () => track.current!.scrollWidth - window.innerWidth + 80;
        gsap.to(track.current, {
          x: () => -dist(),
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top top', end: () => `+=${dist()}`, scrub: 0.6, pin: true, invalidateOnRefresh: true },
        });
        gsap.utils.toArray<HTMLElement>('.col-zoom').forEach((el) => {
          gsap.fromTo(el, { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: () => `+=${dist()}`, scrub: true } });
        });
      }, root);
      kill = () => ctx.revert();
    });
    return () => kill?.();
  }, [desktop, cols.length]);

  return (
    <section ref={root} className="relative overflow-hidden bg-[#1B1612] py-16 text-[#FBF7F0] md:h-[100svh] md:py-0">
      <div className="flex h-full flex-col justify-center">
        <div className="page-x mb-8 flex items-end justify-between gap-6 md:mb-10">
          <Reveal lines={lines(sec.title, ['Eight looms.', 'One obsession.'])} italicLast className="font-serif text-d-2" />
          <Link to="/shop" className="hidden shrink-0 text-[15px] underline decoration-[#B8893B] underline-offset-[6px] md:block">
            Shop every fabric
          </Link>
        </div>
        <div ref={track} className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 md:gap-6 md:overflow-visible md:px-10">
          {cols.map((c) => (
            <Link
              key={c.handle}
              to={`/collections/${c.handle}`}
              className="group relative w-[74vw] shrink-0 snap-start overflow-hidden rounded-[22px] sm:w-[46vw] md:h-[62vh] md:w-[34vh]"
              data-cursor="view"
              data-cursor-label="Open"
            >
              <div className="frame md:h-full md:pb-0">
                <div className="col-zoom frame-fill">
                  <Framed url={c.image} alt={`${c.title} sarees`} sizes="(min-width:768px) 34vh, 74vw" ratio={125} className="md:h-full md:!pb-0" />
                </div>
                {/* macro weave close-up revealed on hover */}
                <div
                  className="frame-fill scale-150 opacity-0 transition-[opacity,transform] duration-900 ease-silk group-hover:scale-125 group-hover:opacity-100"
                  style={{ backgroundImage: c.image ? `url(${c.image.split('#')[0].replace('main.webp', 'zoom.webp')})` : undefined, backgroundSize: '260%', backgroundPosition: '50% 30%' }}
                />
              </div>
              <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-5">
                <p className="font-serif text-[2.2rem] italic leading-none">{c.title}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ product rail */
function Rail({ title, query, link }: { title: string; query: string; link: string }) {
  const [items, setItems] = useState<Card[] | null>(null);
  const [ref, inView] = useInView<HTMLElement>('400px');
  useEffect(() => {
    if (!inView || items) return;
    cached<List>(`/products?${query}`).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [inView, items, query]);
  return (
    <section ref={ref} className="py-20 md:py-28">
      <div className="page-x mb-8 flex items-end justify-between">
        <Reveal lines={[title]} className="font-serif text-d-3" />
        <Link to={link} className="text-[15px] underline decoration-gold underline-offset-[6px]">
          View all
        </Link>
      </div>
      <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 md:gap-6 md:px-10">
        {(items ?? Array.from({ length: 4 }, () => null)).map((p, i) => (
          <div key={p?.id ?? i} className="w-[64vw] shrink-0 snap-start sm:w-[40vw] md:w-[calc((100%-72px)/4)]">
            {p ? <ProductCard p={p} sizes="(min-width:768px) 25vw, 64vw" /> : <CardSkeleton />}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ pallu feature with magnifier */
function Pallu({ sec }: { sec: HomeSection }) {
  const slug = s<string>(sec.data.slug, '');
  const [img, setImg] = useState<string | null>(null);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!slug) return;
    cached<{ product: { images: { url: string; tag: string }[] } }>(`/products/${slug}`)
      .then((r) => setImg((r.product.images.find((i) => i.tag === 'FLATLAY') ?? r.product.images[0])?.url ?? null))
      .catch(() => {});
  }, [slug]);
  const zoomSrc = img?.split('#')[0].replace('main.webp', 'zoom.webp');
  return (
    <section className="grid md:grid-cols-2">
      <div
        className="relative cursor-none overflow-hidden"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setLens({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onPointerLeave={() => setLens(null)}
        data-cursor="hide"
      >
        <Framed url={img} alt="Pallu detail" sizes="50vw" ratio={110} />
        {lens && zoomSrc && (
          <div
            className="pointer-events-none absolute h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold shadow-2xl"
            style={{ left: `${lens.x}%`, top: `${lens.y}%`, backgroundImage: `url(${zoomSrc})`, backgroundSize: '380%', backgroundPosition: `${lens.x}% ${lens.y}%` }}
          />
        )}
        <span className="absolute bottom-4 left-4 rounded-full bg-ivory/90 px-4 py-2 text-[13px] text-ink">Move over the pallu to see the weave</span>
      </div>
      <div className="flex flex-col justify-center bg-blush px-6 py-16 md:px-16">
        <Draw className="mb-6 w-16 text-gold">
          <Kalga />
        </Draw>
        <Reveal lines={lines(sec.title, ['All the drama lives', 'in the pallu.'])} italicLast className="font-serif text-d-3" />
        <p className="mt-6 max-w-md text-[17px] text-muted">{s(sec.data.body, '')}</p>
        {slug && (
          <Link to={`/products/${slug}`} className="btn-primary mt-8 self-start">
            {s(sec.data.cta, 'See the weave')}
          </Link>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ shop by colour: living palette */
function Colours({ sec }: { sec: HomeSection }) {
  const swatches = s<{ name: string; family: string; hex: string }[]>(sec.data.swatches, []);
  const [pick, setPick] = useState<string | null>(null);
  const [items, setItems] = useState<Card[]>([]);
  const chosen = swatches.find((w) => w.family === pick);

  useEffect(() => {
    // flood the page background with the chosen colour
    const hex = chosen?.hex;
    document.body.style.setProperty('--flood', hex ? `${hex}22` : 'transparent');
    return () => {
      document.body.style.setProperty('--flood', 'transparent');
    };
  }, [chosen]);
  useEffect(() => {
    if (!pick) return setItems([]);
    cached<List>(`/products?colour=${pick}&limit=4`).then((r) => setItems(r.items)).catch(() => {});
  }, [pick]);

  return (
    <section className="py-20 md:py-28">
      <div className="page-x text-center">
        <Reveal lines={lines(sec.title, ['Choose a mood.'])} italicLast className="font-serif text-d-2" />
        <p className="mx-auto mt-4 max-w-md text-muted">Tap a colour to see every saree woven in it.</p>
        <div className="mx-auto mt-12 flex max-w-3xl flex-wrap justify-center gap-5 md:gap-8">
          {swatches.map((w) => (
            <button key={w.family} onClick={() => setPick(pick === w.family ? null : w.family)} onMouseEnter={() => matchMedia('(hover:hover)').matches && setPick(w.family)} aria-pressed={pick === w.family} className="group flex flex-col items-center gap-3">
              <span
                className={`block h-16 w-16 rounded-full shadow-[inset_-8px_-10px_20px_rgba(0,0,0,.25),inset_6px_8px_16px_rgba(255,255,255,.35)] transition-transform duration-600 ease-silk md:h-24 md:w-24 ${pick === w.family ? 'scale-110 ring-2 ring-gold ring-offset-4 ring-offset-ivory' : 'group-hover:scale-105'}`}
                style={{ background: `radial-gradient(circle at 30% 28%, ${w.hex}cc, ${w.hex} 55%, ${w.hex})` }}
              />
              <span className="font-serif text-lg">{w.name}</span>
            </button>
          ))}
        </div>
      </div>
      <LayoutGroup>
        <motion.div layout className="page-x mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          <AnimatePresence mode="popLayout">
            {items.map((p) => (
              <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.7, ease: EASE }}>
                <ProductCard p={p} sizes="(min-width:768px) 25vw, 50vw" />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>
      {pick && (
        <div className="mt-8 text-center">
          <Link to={`/shop?colour=${pick}`} className="btn-ghost">
            See all {chosen?.name.toLowerCase()} sarees
          </Link>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ editorial edits */
function Edits({ sec }: { sec: HomeSection }) {
  const boot = useBoot((b) => b.boot);
  const handles = s<string[]>(sec.data.handles, []);
  const cols = handles.map((h) => boot?.collections.find((c) => c.handle === h)).filter(Boolean) as NonNullable<typeof boot>['collections'];
  if (!cols.length) return null;
  const [a, b, c] = cols;
  return (
    <section className="page-x py-20 md:py-28">
      <div className="grid gap-6 md:grid-cols-12 md:gap-8">
        {a && (
          <Link to={`/edits/${a.handle}`} className="group relative md:col-span-7 md:row-span-2" data-cursor="view">
            <Framed url={a.image} alt={a.title} sizes="(min-width:768px) 58vw, 100vw" className="rounded-[26px]" imgClassName="group-hover:scale-[1.03]" />
            <div className="absolute bottom-0 left-0 w-full rounded-b-[26px] bg-gradient-to-t from-black/60 to-transparent p-6 text-[#FBF7F0] md:p-10">
              <p className="font-serif text-d-3 italic">{a.title}</p>
            </div>
          </Link>
        )}
        <div className="flex flex-col justify-center md:col-span-5">
          <Draw className="mb-6 w-28 text-gold">
            <Peacock />
          </Draw>
          <blockquote className="font-serif text-d-4 leading-snug">“{s(sec.data.quote, '') || 'A Kanjivaram is not bought for a day. It is bought for a daughter’s daughter.'}”</blockquote>
          <p className="mt-4 text-muted">— {s(sec.data.quoteBy, '') || 'a weaver in Kanchipuram'}</p>
        </div>
        <div className="grid grid-cols-2 gap-6 md:col-span-5">
          {[b, c].filter(Boolean).map((x) => (
            <Link key={x!.handle} to={`/edits/${x!.handle}`} className="group" data-cursor="view">
              <Framed url={x!.image} alt={x!.title} sizes="25vw" className="rounded-[20px]" imgClassName="group-hover:scale-[1.04]" />
              <p className="mt-3 font-serif text-xl">{x!.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ craft / trust */
function Craft({ sec }: { sec: HomeSection }) {
  const pts = s<{ title: string; body: string }[]>(sec.data.points, []);
  return (
    <section className="grain relative overflow-hidden bg-maroon py-20 text-[#FBF7F0] md:py-28 dark:bg-[#3a141b]">
      <Kolam className="pointer-events-none absolute -left-16 top-10 h-80 w-80 text-[#E6C27A]/15" />
      <div className="page-x relative grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <Reveal lines={lines(sec.title, ['Every saree, verifiably handwoven.'])} className="font-serif text-d-3" />
        </div>
        <ul className="grid gap-10 md:col-span-7 md:grid-cols-3">
          {pts.map((p) => (
            <li key={p.title}>
              <Draw className="mb-4 w-14 text-[#E6C27A]">
                <Lotus />
              </Draw>
              <h3 className="font-serif text-2xl leading-tight">{p.title}</h3>
              <p className="mt-2 text-[15px] text-[#FBF7F0]/75">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Testimonials({ sec }: { sec: HomeSection }) {
  const items = s<{ name: string; city: string; quote: string }[]>(sec.data.items, []);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length]);
  const it = items[i];
  if (!it) return null;
  return (
    <section className="page-x py-20 text-center md:py-28">
      <TempleBorder className="mx-auto mb-12 h-4 w-48 text-gold" />
      <AnimatePresence mode="wait">
        <motion.figure key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.8, ease: EASE }}>
          <blockquote className="mx-auto max-w-3xl font-serif text-d-4 leading-snug">“{it.quote}”</blockquote>
          <figcaption className="mt-6 text-muted">
            {it.name}, {it.city}
          </figcaption>
        </motion.figure>
      </AnimatePresence>
      <div className="mt-8 flex justify-center gap-2">
        {items.map((_, k) => (
          <button key={k} onClick={() => setI(k)} aria-label={`Testimonial ${k + 1}`} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-maroon' : 'w-2 bg-line'}`} />
        ))}
      </div>
    </section>
  );
}

function Instagram({ sec }: { sec: HomeSection }) {
  const [items, setItems] = useState<Card[]>([]);
  const handle = useBoot((b) => b.boot?.store.instagram);
  const [ref, inView] = useInView<HTMLElement>('300px');
  useEffect(() => {
    if (inView && !items.length) cached<List>('/products?sort=popular&limit=6').then((r) => setItems(r.items)).catch(() => {});
  }, [inView, items.length]);
  return (
    <section ref={ref} className="py-16">
      <div className="page-x mb-6 flex items-end justify-between">
        <h2 className="font-serif text-d-4">{sec.title ?? `@${handle}`}</h2>
        {handle && (
          <a href={`https://instagram.com/${handle}`} target="_blank" rel="noreferrer" className="text-[15px] underline decoration-gold underline-offset-[6px]">
            Follow on Instagram
          </a>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1 md:grid-cols-6">
        {items.map((p) => (
          <a key={p.id} href={`/products/${p.slug}`} className="block">
            <Framed url={p.images[1]?.url ?? p.images[0]?.url} alt={p.name} ratio={100} sizes="17vw" />
          </a>
        ))}
      </div>
    </section>
  );
}

function Newsletter({ sec }: { sec: HomeSection }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  return (
    <section className="page-x py-20">
      <div className="relative overflow-hidden rounded-[28px] bg-blush px-6 py-14 text-center md:px-16 md:py-20">
        <Kalga className="pointer-events-none absolute -right-6 -top-6 h-48 w-36 text-gold/30" />
        <h2 className="font-serif text-d-3">{sec.title ?? 'Letters from the loom'}</h2>
        <p className="mx-auto mt-3 max-w-md text-muted">{s(sec.data.body, '')}</p>
        {state === 'done' ? (
          <p className="mt-8 font-serif text-2xl text-maroon">You are on the list. The first letter arrives soon.</p>
        ) : (
          <form
            className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              setState('busy');
              try {
                await post('/newsletter', { email });
                setState('done');
              } catch {
                setState('error');
              }
            }}
          >
            <label className="sr-only" htmlFor="nl-email">
              Email
            </label>
            <input id="nl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="field flex-1 rounded-full" autoComplete="email" />
            <button className="btn-primary" disabled={state === 'busy'}>
              Subscribe
            </button>
          </form>
        )}
        {state === 'error' && <p className="mt-3 text-[14px] text-danger">That email did not work — check it and try again.</p>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ page */
export default function Home() {
  const boot = useBoot((b) => b.boot);
  useSeo(boot ? `${boot.store.storeName} — ${boot.store.tagline}` : undefined);
  const sections = boot?.home ?? [];
  return (
    <>
      {sections.map((sec) => {
        switch (sec.type) {
          case 'hero':
            return <Hero key={sec.id} sec={sec} />;
          case 'marquee':
            return <Marquee key={sec.id} sec={sec} />;
          case 'story':
            return <Story key={sec.id} sec={sec} />;
          case 'collections':
            return <Collections key={sec.id} sec={sec} />;
          case 'new':
            return <Rail key={sec.id} title={sec.title ?? 'New arrivals'} query="sort=new&limit=8" link="/shop?sort=new" />;
          case 'bestsellers':
            return <Rail key={sec.id} title={sec.title ?? 'Bestsellers'} query="sort=popular&limit=8" link="/shop?sort=popular" />;
          case 'pallu':
            return <Pallu key={sec.id} sec={sec} />;
          case 'colours':
            return <Colours key={sec.id} sec={sec} />;
          case 'edits':
            return <Edits key={sec.id} sec={sec} />;
          case 'craft':
            return <Craft key={sec.id} sec={sec} />;
          case 'testimonials':
            return <Testimonials key={sec.id} sec={sec} />;
          case 'instagram':
            return <Instagram key={sec.id} sec={sec} />;
          case 'newsletter':
            return <Newsletter key={sec.id} sec={sec} />;
          default:
            return null;
        }
      })}
    </>
  );
}
