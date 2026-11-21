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
