import type { ReactNode } from 'react';
import { frameStyle, parseFrame, variant } from '@/lib/image';
import { TempleBorder } from './Ornaments';

/** A zari band across the base of an arch, like the woven border of a saree. */
export function ArchZari({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute bottom-0 left-0 z-[2] h-[15%] w-full bg-gradient-to-b from-[#2A0B12]/30 via-[#2A0B12]/85 to-[#1B0A0E] ${className}`}>
      <TempleBorder className="absolute left-0 top-[18%] h-[22%] w-full text-[#C99A45]" />
      <div className="absolute bottom-[22%] left-0 h-px w-full bg-[#C99A45]/80" />
    </div>
  );
}

/** One arch window showing a saree photo (honours the admin's #lx framing). */
export function ArchImage({ url, alt, className = '', zari = true, sizes = '30vw' }: { url: string | null | undefined; alt: string; className?: string; zari?: boolean; sizes?: string }) {
  const { src, frame } = parseFrame(url);
  return (
    <div className={`arch arch-line bg-[#2A0B12] shadow-[0_30px_60px_-20px_rgba(0,0,0,.6)] ${className}`}>
      {src && (
        <img
          src={variant(src, 'main')}
          srcSet={`${variant(src, 'thumb')} 600w, ${variant(src, 'main')} 1600w`}
          sizes={sizes}
          alt={alt}
          className="absolute left-0 top-0 h-full w-full object-cover"
          style={frameStyle(frame)}
          loading="eager"
          decoding="async"
        />
      )}
      <div className="pointer-events-none absolute left-0 top-0 z-[1] h-full w-full bg-[radial-gradient(ellipse_at_30%_15%,rgba(255,230,190,.22),transparent_55%)]" />
      {zari && <ArchZari />}
    </div>
  );
}

/** A temple doorway: a photo in a square-based arch with a fine inner gold line. */
export function DoorArch({ url, alt, className = '', sizes = '30vw', eager = false, children }: { url: string | null | undefined; alt: string; className?: string; sizes?: string; eager?: boolean; children?: ReactNode }) {
  const { src, frame } = parseFrame(url);
  return (
    <div className={`arch-door arch-line bg-[#2A0B12] ${className}`}>
      {src && (
        <img
          src={variant(src, 'main')}
          srcSet={`${variant(src, 'thumb')} 600w, ${variant(src, 'main')} 1600w`}
          sizes={sizes}
          alt={alt}
          className="absolute left-0 top-0 h-full w-full object-cover transition-transform duration-1200 ease-silk"
          style={frameStyle(frame)}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
      <div className="pointer-events-none absolute left-0 top-0 z-[1] h-[60%] w-full bg-[radial-gradient(ellipse_at_30%_10%,rgba(255,230,190,.22),transparent_60%)]" />
      {children}
    </div>
  );
}

/** Concentric gold outlines that frame a doorway arch. Give the parent position:relative. */
export function DoorRings({ w, h, step = 40, count = 3 }: { w: number | string; h: number | string; step?: number; count?: number }) {
  const px = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="doorway"
          style={{ width: `calc(${px(w)} + ${(i + 1) * step}px)`, height: `calc(${px(h)} + ${(i + 1) * step * 0.6}px)`, ['--a' as string]: String(0.5 - i * 0.15) }}
        />
      ))}
    </>
  );
}

const TOWNS: [RegExp, string][] = [
  [/kanji|kanchi/i, 'Kanchipuram'],
  [/banaras|benaras/i, 'Varanasi'],
  [/paithani/i, 'Yeola'],
  [/chanderi/i, 'Chanderi'],
  [/gadwal/i, 'Gadwal'],
  [/pochampal|ikat/i, 'Pochampally'],
  [/tussar|tussore/i, 'Bhagalpur'],
  [/soft silk|arani/i, 'Arani'],
  [/linen/i, 'Handloom linen'],
  [/cotton/i, 'Handloom cotton'],
  [/organza/i, 'Woven organza'],
];
export const townFor = (title: string) => TOWNS.find(([re]) => re.test(title))?.[1] ?? 'Handwoven';

/**
 * A saree hanging from a gold rod, as sarees hang in a silk shop: a gold ring at the top,
 * a fringe of tassels at the hem and an ivory tag tied on with thread. Sways on hover.
 */
export function HangingSaree({ url, title, length, sizes = '20vw', delay = 0 }: { url: string | null | undefined; title: string; length: string; sizes?: string; delay?: number }) {
  const { src, frame } = parseFrame(url);
  return (
    <div className="hang relative flex flex-col items-center" style={{ animationDelay: `${delay}ms` }}>
      {/* the gold ring on the rod */}
      <span aria-hidden className="relative z-[3] -mb-1.5 block h-6 w-6 rounded-full border-[3px] border-[#E6C27A] bg-transparent shadow-[0_2px_6px_rgba(0,0,0,.5)]" />
      <div className="hang-cloth relative w-full origin-top">
        {/* the saree, folded over a hanger bar */}
        <div className="relative w-full overflow-hidden shadow-[0_40px_70px_-30px_rgba(0,0,0,.85)]" style={{ height: length }}>
          <span aria-hidden className="absolute left-0 top-0 z-[2] h-3 w-full bg-gradient-to-b from-[#C99A45] to-[#7A5518]" />
          {src && (
            <img
              src={variant(src, 'main')}
              srcSet={`${variant(src, 'thumb')} 600w, ${variant(src, 'main')} 1600w`}
              sizes={sizes}
              alt={`${title} sarees`}
              loading="lazy"
              decoding="async"
              className="absolute left-0 top-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-silk group-hover:scale-[1.06]"
              style={frameStyle(frame)}
            />
          )}
          {/* the fold where the saree drapes over the bar, and side shading */}
          <span aria-hidden className="pointer-events-none absolute left-0 top-3 z-[1] h-10 w-full bg-gradient-to-b from-black/45 to-transparent" />
          <span aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(0,0,0,.35),transparent_18%,transparent_82%,rgba(0,0,0,.35))]" />
          <span aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(115deg,transparent_35%,rgba(255,236,200,.18)_48%,transparent_60%)]" />
        </div>
        {/* tassel fringe at the hem */}
        <span aria-hidden className="block h-7 w-full bg-[repeating-linear-gradient(90deg,#C99A45_0_2px,transparent_2px_6px,#8A2838_6px_8px,transparent_8px_11px)] [mask-image:linear-gradient(180deg,#000_55%,transparent)]" />
        {/* the tag, tied to the ring with a thread */}
        <span className="hang-tag absolute -right-3 top-6 z-[4] origin-top-left md:-right-4">
          <span aria-hidden className="absolute -top-6 left-3 h-7 w-px rotate-[-28deg] bg-[#E6C27A]/80" />
          <span className="relative block min-w-[112px] rounded-[3px] bg-[#FBF7F0] px-3.5 pb-2.5 pt-4 text-left text-[#1B1612] shadow-[0_14px_24px_-10px_rgba(0,0,0,.7)] [clip-path:polygon(14px_0,100%_0,100%_100%,0_100%,0_14px)]">
            <span aria-hidden className="absolute left-2.5 top-2.5 h-2 w-2 rounded-full border border-[#B8893B]" />
            <span className="block font-serif text-[21px] italic leading-tight">{title}</span>
            <span className="mt-0.5 block text-[11px] text-[#6E6258]">{townFor(title)}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
