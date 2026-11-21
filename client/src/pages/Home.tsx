import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardSkeleton, ProductCard } from '@/components/ProductCard';
import { Draw, Kolam, Lotus, TempleBorder } from '@/components/Ornaments';
import { DoorArch, DoorRings } from '@/components/Arch';
import { EASE, Framed, Magnetic, Reveal } from '@/components/ui';
import { cached, post } from '@/lib/api';
import { useInView, useReveal, useSeo } from '@/lib/hooks';
import type { Card, HomeSection, Product } from '@/lib/types';
import { inr, pctOff } from '@/lib/format';
import { useBoot } from '@/store';

type List = { items: Card[] };
const s = <T,>(v: unknown, d: T): T => (v === undefined || v === null ? d : (v as T));
/** Headings typed in the admin: a line break splits into two lines (the second is italic). */
const lines = (title: string | null | undefined, fallback: string[]) => {
  const t = (title ?? '').trim();
  return t ? t.split(/\n+/).map((x) => x.trim()).filter(Boolean) : fallback;
};
/** Same as lines(), but a one-line heading is split in two so the second half can be set in italic. */
const twoLines = (title: string | null | undefined, fallback: string[]) => {
  const l = lines(title, fallback);
  if (l.length > 1) return l;
  const t = l[0] ?? '';
  const dot = t.indexOf('. ');
  if (dot > 0) return [t.slice(0, dot + 1), t.slice(dot + 2)];
  const w = t.split(' ');
  if (w.length < 3) return l;
  const cut = w.findIndex((x, i) => i > 0 && ['to', 'of', 'in', 'for', 'with'].includes(x.toLowerCase()));
  const at = cut > 0 ? cut : Math.ceil(w.length / 2);
  return [w.slice(0, at).join(' '), w.slice(at).join(' ')];
};

/* ------------------------------------------------------------------ hero */
/** The temple of silk: five sarees in arch doorways, the tallest in the middle, gold outlines behind it. */
function TempleArches() {
  const cols = useBoot((b) => b.boot?.collections ?? []);
  const imgs = cols.filter((c) => c.image && !c.isEditorial).slice(0, 5);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / innerWidth - 0.5;
        el.querySelectorAll<HTMLElement>('[data-depth]').forEach((n) => {
          n.style.translate = `${x * Number(n.dataset.depth) * 26}px 0`;
        });
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
    };
  }, []);
  if (!imgs.length) return null;
  const [centre, l1, r1, l2, r2] = imgs;
  // [collection, size classes, position classes, depth, delay]
  const side: [typeof centre | undefined, string, string, number, number][] = [
    [l2, 'h-[150px] w-[86px] md:h-[280px] md:w-[170px] opacity-80', 'left-[1%] md:left-[3%]', 0.3, 0.5],
    [r2, 'h-[150px] w-[86px] md:h-[280px] md:w-[170px] opacity-80', 'right-[1%] md:right-[3%]', 0.3, 0.5],
    [l1, 'h-[210px] w-[118px] md:h-[390px] md:w-[230px]', 'left-[13%] md:left-[19%]', 0.6, 0.3],
    [r1, 'h-[210px] w-[118px] md:h-[390px] md:w-[230px]', 'right-[13%] md:right-[19%]', 0.6, 0.3],
  ];
  return (
    <div ref={box} className="relative mx-auto mt-6 h-[300px] w-full max-w-[1200px] md:mt-8 md:h-[540px]">
      <div className="absolute bottom-0 left-1/2 h-[300px] w-[210px] -translate-x-1/2 md:h-[520px] md:w-[360px]">
        <DoorRings w="100%" h="100%" step={52} />
      </div>
      {side.map(([c, size, pos, depth, delay]) =>
        c ? (
          <Link
            key={c.handle}
            to={`/collections/${c.handle}`}
            tabIndex={-1}
            aria-hidden
            data-depth={depth}
            className={`absolute bottom-0 block transition-[translate] duration-900 ease-silk ${pos}`}
          >
            <div className="temple-rise" style={{ animationDelay: `${delay + 0.4}s` }}>
              <DoorArch url={c.image} alt="" sizes="18vw" eager className={`${size} shadow-[0_40px_80px_-24px_rgba(0,0,0,.75)] hover:[&_img]:scale-105`} />
            </div>
          </Link>
        ) : null,
      )}
      <Link
        to={`/collections/${centre.handle}`}
        data-depth={1}
        data-cursor="view"
        data-cursor-label={centre.title}
        className="absolute bottom-0 left-1/2 block -translate-x-1/2 transition-[translate] duration-900 ease-silk"
      >
        <div className="temple-rise" style={{ animationDelay: '0.2s' }}>
        <DoorArch url={centre.image} alt={`${centre.title} sarees`} sizes="(min-width:768px) 360px, 210px" eager className="h-[280px] w-[196px] shadow-[0_60px_120px_-30px_rgba(0,0,0,.85),0_0_0_1px_rgba(230,194,122,.4)] md:h-[520px] md:w-[360px] hover:[&_img]:scale-105" />
        </div>
        <span className="absolute bottom-[22%] left-[78%] hidden items-center gap-3 whitespace-nowrap rounded-full border border-[#E6C27A]/40 bg-[#1B0A0E]/60 py-2.5 pl-2.5 pr-5 text-left text-[13px] backdrop-blur-md lg:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E6C27A] text-[#1B0A0E]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
          <span>
            <span className="block font-serif text-[18px] leading-tight">{centre.title}</span>
            <span className="text-[#FBF7F0]/65">Explore the weave</span>
          </span>
        </span>
      </Link>
    </div>
  );
}

function Hero({ sec }: { sec: HomeSection }) {
  const d = sec.data;
  const textRef = useReveal<HTMLDivElement>(0.01);
  const video = s<string>(d.video, '');
  const poster = s<string>(d.poster, '');

  return (
    <section className="hero-temple relative -mt-[var(--header-h)] overflow-hidden text-[#FBF7F0]">
      {video ? (
        <video className="absolute left-0 top-0 h-full w-full object-cover opacity-25 mix-blend-luminosity" src={video} poster={poster || undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden />
      ) : poster ? (
        <img src={poster} alt="" className="absolute left-0 top-0 h-full w-full object-cover opacity-20 mix-blend-luminosity" />
      ) : null}
      <div className="butti pointer-events-none absolute left-0 top-0 h-full w-full opacity-60" />
      <div className="grain pointer-events-none absolute left-0 top-0 h-full w-full" />
      <p className="absolute left-9 top-[52%] hidden origin-left -rotate-90 text-[12px] tracking-[0.32em] text-[#FBF7F0]/55 xl:block">{s(d.sideText, 'SINCE 1987 · KANCHIPURAM')}</p>
      <p className="absolute right-9 top-[32%] hidden font-serif text-[18px] italic text-[#E6C27A]/75 [writing-mode:vertical-rl] xl:block">woven in light</p>

      <div ref={textRef} className="relative flex flex-col items-center pb-[86px] pt-[calc(var(--header-h)+28px)] text-center md:pb-[96px] md:pt-[calc(var(--header-h)+48px)]">
        <p className="page-x mb-3 text-[13px] text-[#FBF7F0]/75 opacity-0 transition-opacity delay-700 duration-1200 md:mb-4 md:text-[15px] [.is-in_&]:opacity-100">{s(d.eyebrow, '')}</p>
        <h1 className="page-x font-serif text-[clamp(3.6rem,9.4vw,8.4rem)] leading-[0.86] tracking-[-0.025em]">
          <span className="mask-line">
            <span>{s(d.line1, 'Six yards')}</span>
          </span>
          <span className="mask-line">
            <span className="italic text-[#E6C27A]">{s(d.line2, 'of poetry.')}</span>
          </span>
        </h1>
        <TempleArches />
        <div className="page-x mt-9 flex flex-col items-center gap-x-7 gap-y-4 opacity-0 transition-opacity delay-1000 duration-1200 sm:flex-row sm:justify-center md:mt-11 [.is-in_&]:opacity-100">
          <Magnetic>
            <Link to={s(d.ctaLink, '/shop')} className="btn-gold min-h-[56px] w-full px-9 text-[16px] sm:w-auto" data-cursor="view" data-cursor-label="Enter">
              {s(d.cta, 'Explore the collection')}
            </Link>
          </Magnetic>
          {s<string>(d.secondary, '') && (
            <Link to={s(d.secondaryLink, '/')} className="border-b border-[#B8893B] pb-1 text-[16px] text-[#FBF7F0] hover:text-[#E6C27A]">
              {s(d.secondary, '')}
            </Link>
          )}
        </div>
      </div>
      <div className="zari-band absolute bottom-0 left-0 w-full" aria-hidden />
    </section>
  );
}

/* ------------------------------------------------------------------ marquee */
function Marquee({ sec }: { sec: HomeSection }) {
  const items = s<string[]>(sec.data.items, []);
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden bg-[linear-gradient(90deg,#B8893B,#E6C27A_50%,#B8893B)] py-4 text-[#1B1612]" aria-hidden>
      <div className="marquee">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((t, i) => (
              <span key={`${k}${i}`} className="flex items-center gap-6 px-6 font-serif text-[1.4rem] italic md:text-[1.65rem]">
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

/* ------------------------------------------------------------------ story: loom → weaver → drape */
function Story({ sec }: { sec: HomeSection }) {
  const steps = s<{ title: string; body: string; image?: string }[]>(sec.data.steps, []);
  const cols = useBoot((b) => b.boot?.collections ?? []);
  const pics = cols.filter((c) => c.image).map((c) => c.image);
  const [ref, near] = useInView<HTMLElement>('-15% 0px');
  const [inView, setSeen] = useState(false);
  useEffect(() => {
    if (near) setSeen(true);
  }, [near]);
  const head = twoLines(sec.title, ['From loom', 'to drape.']);
  return (
    <section ref={ref} className="relative overflow-hidden bg-ivory py-20 md:py-36">
      <div className="butti-soft pointer-events-none absolute left-0 top-0 h-full w-full opacity-70" />
      <div className="page-x relative grid gap-14 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-4 md:pt-4">
          <Reveal lines={head} italicLast className="font-serif text-[clamp(3rem,6.4vw,5.6rem)] leading-[0.92] tracking-[-0.02em] [&_.italic]:text-maroon" />
          {s<string>(sec.data.body, '') && <p className="mt-7 max-w-sm text-[17px] leading-relaxed text-muted">{s(sec.data.body, '')}</p>}
          <div className="mt-10 h-px w-28 bg-gold" />
        </div>
        <ol className="relative border-l border-line pl-8 md:col-span-8 md:pl-14">
          {steps.map((st, i) => (
            <li
              key={st.title}
              className={`relative grid items-center gap-6 pb-14 transition-[opacity,transform] duration-1200 ease-silk last:pb-0 sm:grid-cols-[160px_1fr] md:grid-cols-[200px_1fr] md:gap-11 md:pb-[72px] ${inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
              style={{ transitionDelay: `${i * 180}ms` }}
            >
              <span aria-hidden className={`absolute -left-[39px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 rounded-full shadow-[0_0_0_6px_rgb(var(--ivory))] md:-left-[64px] ${i === steps.length - 1 ? 'bg-maroon' : 'bg-gold'}`} />
              <DoorArch url={st.image || pics[i % Math.max(1, pics.length)]} alt={st.title} sizes="200px" className="h-[220px] w-[150px] sm:w-full md:h-[260px]" />
              <div>
                <p className="font-serif text-[22px] text-gold">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-1 font-serif text-[clamp(2rem,3.4vw,2.75rem)] leading-tight">{st.title}</h3>
                <p className="mt-3 max-w-md text-[17px] leading-relaxed text-muted">{st.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ collections: a row of arch doorways */
function Collections({ sec }: { sec: HomeSection }) {
  const boot = useBoot((b) => b.boot);
  const handles = s<string[]>(sec.data.handles, []);
  const cols = handles.map((h) => boot?.collections.find((c) => c.handle === h)).filter(Boolean) as NonNullable<typeof boot>['collections'];
  const shown = cols.slice(0, 6);
  // outer arches shorter, middle ones tallest — like a temple skyline
  const heights = shown.length === 6 ? ['md:h-[420px]', 'md:h-[470px]', 'md:h-[520px]', 'md:h-[520px]', 'md:h-[470px]', 'md:h-[420px]'] : shown.map(() => 'md:h-[480px]');
  return (
    <section className="grain relative overflow-hidden bg-[#1B1612] py-20 text-[#FBF7F0] md:py-32">
      <div className="page-x mb-10 flex items-end justify-between gap-6 md:mb-16">
        <Reveal lines={twoLines(sec.title, ['Eight looms.', 'One obsession.'])} italicLast className="font-serif text-[clamp(2.9rem,6.8vw,6rem)] leading-[0.9] tracking-[-0.02em] [&_.italic]:text-[#E6C27A]" />
        <Link to="/shop" className="hidden shrink-0 border-b border-[#B8893B] pb-1 text-[16px] md:block">
          Shop every fabric
        </Link>
      </div>
      <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 md:mx-auto md:grid md:max-w-page md:items-end md:gap-[22px] md:overflow-visible md:px-10" style={{ gridTemplateColumns: `repeat(${Math.max(1, shown.length)}, minmax(0, 1fr))` }}>
        {shown.map((c, i) => (
          <Link key={c.handle} to={`/collections/${c.handle}`} className="group block w-[58vw] shrink-0 snap-start sm:w-[36vw] md:w-auto" data-cursor="view" data-cursor-label="Open">
            <DoorArch url={c.image} alt={`${c.title} sarees`} sizes="(min-width:768px) 16vw, 58vw" className={`h-[340px] shadow-[0_30px_60px_-24px_rgba(0,0,0,.8)] group-hover:[&_img]:scale-105 ${heights[i]}`}>
              <span className="pointer-events-none absolute bottom-0 left-0 z-[2] h-[55%] w-full bg-gradient-to-t from-[#1B0A0E]/90 to-transparent" />
              <span className="absolute bottom-6 left-0 z-[4] w-full text-center">
                <span className="block font-serif text-[clamp(1.6rem,2.1vw,1.9rem)] italic leading-tight">{c.title}</span>
                <span className="mt-1 block text-[12px] text-[#FBF7F0]/65 transition-colors group-hover:text-[#E6C27A]">Explore</span>
              </span>
            </DoorArch>
          </Link>
        ))}
      </div>
      {cols.length > 6 && (
        <div className="page-x mt-10 flex flex-wrap justify-center gap-3">
          {cols.slice(6).map((c) => (
            <Link key={c.handle} to={`/collections/${c.handle}`} className="rounded-full border border-[#E6C27A]/35 px-5 py-2.5 font-serif text-[18px] italic hover:bg-[#E6C27A] hover:text-[#1B0A0E]">
              {c.title}
            </Link>
          ))}
        </div>
      )}
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
      <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 md:scroll-px-10 md:gap-6 md:px-10">
        {(items ?? Array.from({ length: 4 }, () => null)).map((p, i) => (
          <div key={p?.id ?? i} className="w-[64vw] shrink-0 snap-start sm:w-[40vw] md:w-[calc((100%-72px)/4)]">
            {p ? <ProductCard p={p} sizes="(min-width:768px) 25vw, 64vw" /> : <CardSkeleton />}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ spotlight: one saree in a gold doorway */
function Pallu({ sec }: { sec: HomeSection }) {
  const slug = s<string>(sec.data.slug, '');
  const [p, setP] = useState<Product | null>(null);
  const [img, setImg] = useState(0);
  useEffect(() => {
    if (!slug) return;
    cached<{ product: Product }>(`/products/${slug}`)
      .then((r) => setP(r.product))
      .catch(() => {});
  }, [slug]);
  if (!slug) return null;
  const pics = p?.images ?? [];
  const off = p ? pctOff(p.price, p.mrp) : 0;
  const head = lines(sec.title, []);
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_60%_70%_at_30%_50%,#5A1622_0%,#2A0B12_55%,#1B0A0E_100%)] py-20 text-[#FBF7F0] md:py-36">
      <div className="butti pointer-events-none absolute left-0 top-0 h-full w-full opacity-25" />
      <div className="page-x relative grid items-center gap-14 md:grid-cols-2 md:gap-24">
        <div className="relative mx-auto h-[460px] w-full max-w-[520px] md:h-[700px]">
          <div className="absolute bottom-0 left-1/2 h-[430px] w-[280px] -translate-x-1/2 md:h-[640px] md:w-[420px]">
            <DoorRings w="100%" h="100%" step={50} count={2} />
          </div>
          <Link to={`/products/${slug}`} className="absolute bottom-0 left-1/2 block -translate-x-1/2" data-cursor="view" data-cursor-label="View">
            <DoorArch url={pics[img]?.url} alt={p?.name ?? 'Featured saree'} sizes="(min-width:768px) 420px, 280px" className="h-[430px] w-[280px] shadow-[0_60px_120px_-30px_rgba(0,0,0,.85)] md:h-[640px] md:w-[420px]" />
          </Link>
          {pics.length > 1 && (
            <div className="absolute bottom-6 left-1/2 z-[5] flex -translate-x-1/2 gap-2 rounded-full border border-[#E6C27A]/40 bg-[#1B0A0E]/65 p-1.5 backdrop-blur-md" role="tablist" aria-label="Photos">
              {pics.slice(0, 4).map((im, k) => (
                <button key={im.url} role="tab" aria-selected={k === img} aria-label={im.tag.toLowerCase()} onClick={() => setImg(k)} className={`h-8 rounded-full px-3 text-[12px] capitalize transition-colors ${k === img ? 'bg-[#E6C27A] text-[#1B0A0E]' : 'text-[#FBF7F0]/80 hover:text-[#FBF7F0]'}`}>
                  {(() => {
                    const name = im.tag === 'MODEL' ? 'Drape' : im.tag === 'FLATLAY' ? 'Pallu' : im.tag === 'DETAIL' ? 'Weave' : 'View';
                    const n = pics.slice(0, k).filter((x) => x.tag === im.tag).length;
                    return n ? `${name} ${n + 1}` : name;
                  })()}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="font-serif text-[22px] italic text-[#E6C27A] md:text-[24px]">{head[0] ?? 'The saree of the season'}</p>
          <h2 className="mt-3 font-serif text-[clamp(3rem,6vw,5.25rem)] leading-[0.95] tracking-[-0.02em]">{p?.name ?? ' '}</h2>
          <p className="mt-6 max-w-[470px] text-[17px] leading-relaxed text-[#FBF7F0]/75 md:text-[18px]">{s(sec.data.body, '') || p?.pallu || ''}</p>
          {p && (
            <dl className="mt-9 grid grid-cols-2 gap-5 border-y border-[#E6C27A]/25 py-6 sm:grid-cols-3 sm:gap-6">
              <div>
                <dt className="text-[13px] text-[#FBF7F0]/55">Fabric</dt>
                <dd className="mt-1.5 font-serif text-[20px] leading-tight sm:text-[22px] md:text-[24px]">{p.fabric}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-[#FBF7F0]/55">Origin</dt>
                <dd className="mt-1.5 font-serif text-[20px] leading-tight sm:text-[22px] md:text-[24px]">{p.origin || 'India'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-[#FBF7F0]/55">Weave</dt>
                <dd className="mt-1.5 font-serif text-[20px] leading-tight sm:text-[22px] md:text-[24px]">{p.weave || 'Handloom'}</dd>
              </div>
            </dl>
          )}
          {p && (
            <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-serif text-[46px] leading-none">{inr(p.price)}</span>
              {off > 0 && (
                <>
                  <span className="text-[17px] text-[#FBF7F0]/50 line-through">{inr(p.mrp)}</span>
                  <span className="text-[14px] text-[#A9BC97]">{off}% off</span>
                </>
              )}
            </div>
          )}
          {p && p.colours.length > 0 && (
            <div className="mt-6 flex gap-3" aria-label="Available colours">
              {p.colours.map((c) => (
                <span key={c.id} title={c.name} className="h-10 w-10 rounded-full border-2 border-[#E6C27A]/60 shadow-[inset_0_0_0_4px_#2A0B12]" style={{ background: c.hex }} />
              ))}
            </div>
          )}
          <div className="mt-9 flex flex-wrap gap-3.5">
            <Link to={`/products/${slug}`} className="btn-gold min-h-[56px] px-9">
              {s(sec.data.cta, 'View the saree')}
            </Link>
            <Link to="/shop" className="btn min-h-[56px] border border-[#FBF7F0]/35 px-8 text-[#FBF7F0] hover:bg-[#FBF7F0] hover:text-[#1B1612]">
              Shop all sarees
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ shop by colour: living palette */
function Colours({ sec }: { sec: HomeSection }) {
  const swatches = s<{ name: string; family: string; hex: string }[]>(sec.data.swatches, []);
  const [pick, setPickRaw] = useState<string | null>(swatches[0]?.family ?? null);
  const [touched, setTouched] = useState(false);
  const setPick = (v: string | null) => {
    setTouched(true);
    setPickRaw(v);
  };
  const [items, setItems] = useState<Card[]>([]);
  const chosen = swatches.find((w) => w.family === pick);

  useEffect(() => {
    // flood the page background with the chosen colour (only once the shopper picks one)
    const hex = touched ? chosen?.hex : undefined;
    document.body.style.setProperty('--flood', hex ? `${hex}22` : 'transparent');
    return () => {
      document.body.style.setProperty('--flood', 'transparent');
    };
  }, [chosen, touched]);
  useEffect(() => {
    if (!pick) return setItems([]);
    cached<List>(`/products?colour=${pick}&limit=4`).then((r) => setItems(r.items)).catch(() => {});
  }, [pick]);

  return (
    <section className="py-20 md:py-28">
      <div className="page-x text-center">
        <Reveal lines={twoLines(sec.title, ["Choose a", "mood."])} italicLast className="font-serif text-[clamp(2.9rem,6.8vw,6rem)] leading-[0.9] tracking-[-0.02em] [&_.italic]:text-maroon" />
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
  const [a, b, ...rest] = cols;
  return (
    <section className="relative overflow-hidden bg-ivory py-20 md:py-36">
      <div className="page-x grid items-center gap-14 md:grid-cols-12 md:gap-20">
        <div className="relative h-[520px] md:col-span-7 md:h-[720px]">
          <Link to={`/edits/${a.handle}`} className="group absolute left-0 top-0 block" data-cursor="view" data-cursor-label="Enter">
            <DoorArch url={a.image} alt={a.title} sizes="(min-width:768px) 470px, 76vw" className="h-[470px] w-[76vw] max-w-[470px] group-hover:[&_img]:scale-[1.04] md:h-[660px] md:w-[470px]" />
          </Link>
          {b && (
            <Link to={`/edits/${b.handle}`} className="group absolute bottom-0 right-0 block md:right-[2%]" data-cursor="view" data-cursor-label={b.title}>
              <div className="border-[10px] border-ivory shadow-[0_40px_80px_-30px_rgba(27,22,18,.45)] [border-radius:9999px_9999px_0_0]">
                <DoorArch url={b.image} alt={b.title} sizes="250px" className="h-[250px] w-[170px] group-hover:[&_img]:scale-[1.05] md:h-[360px] md:w-[250px]" />
              </div>
              <p className="mt-2 text-center font-serif text-[20px] italic">{b.title}</p>
            </Link>
          )}
          <p className="absolute left-[500px] top-10 hidden font-serif text-[20px] italic text-gold [writing-mode:vertical-rl] lg:block">woven to be passed down</p>
        </div>
        <div className="md:col-span-5">
          <p className="font-serif text-[24px] italic text-maroon">{a.title}</p>
          <blockquote className="mt-4 font-serif text-[clamp(2.1rem,3.8vw,3.25rem)] leading-[1.08] tracking-[-0.01em]">“{s(sec.data.quote, '') || 'A Kanjivaram is not bought for a day. It is bought for a daughter’s daughter.'}”</blockquote>
          <p className="mt-5 text-muted">— {s(sec.data.quoteBy, '') || 'a weaver in Kanchipuram'}</p>
          <Link to={`/edits/${a.handle}`} className="btn-primary mt-10 min-h-[56px] px-9">
            Enter the {a.title.replace(/^the\s+/i, '')}
          </Link>
          {rest.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              {rest.map((x) => (
                <Link key={x.handle} to={`/edits/${x.handle}`} className="border-b border-gold pb-0.5 hover:text-maroon">
                  {x.title}
                </Link>
              ))}
            </div>
          )}
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
          <Reveal lines={twoLines(sec.title, ["Every saree,", "verifiably handwoven."])} italicLast className="font-serif text-[clamp(2.6rem,5vw,4.5rem)] leading-[0.95] [&_.italic]:text-[#E6C27A]" />
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
  const head = twoLines(sec.title, ['Letters from', 'the loom.']);
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_70%_90%_at_50%_100%,#5A1622,#1B0A0E_75%)] py-20 text-center text-[#FBF7F0] md:py-28">
      <div className="butti pointer-events-none absolute left-0 top-0 h-full w-full opacity-30" />
      <div className="page-x relative">
        <div className="zari-row mx-auto mb-10 w-[196px]" aria-hidden />
        <h2 className="font-serif text-[clamp(2.6rem,5vw,4rem)] leading-none">
          {head[0]} {head[1] && <span className="italic text-[#E6C27A]">{head[1]}</span>}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[#FBF7F0]/70">{s(sec.data.body, '')}</p>
        {state === 'done' ? (
          <p className="mt-8 font-serif text-2xl text-[#E6C27A]">You are on the list. The first letter arrives soon.</p>
        ) : (
          <form
            className="mx-auto mt-9 flex max-w-[480px] flex-col gap-3 sm:flex-row"
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
            <input id="nl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="h-[54px] flex-1 rounded-full border border-[#FBF7F0]/25 bg-transparent px-6 text-[16px] text-[#FBF7F0] outline-none placeholder:text-[#FBF7F0]/45 focus:border-[#E6C27A]" autoComplete="email" />
            <button className="btn-gold min-h-[54px] px-8" disabled={state === 'busy'}>
              Subscribe
            </button>
          </form>
        )}
        {state === 'error' && <p className="mt-3 text-[14px] text-[#F2A7A0]">That email did not work — check it and try again.</p>}
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
