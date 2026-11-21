/**
 * Ornament library — authentic Indian textile motifs drawn as crisp strokes.
 * Wrap any of them in <Draw> to have the strokes draw on as they scroll into view.
 */
import type { ReactNode, SVGProps } from 'react';
import { useReveal } from '@/lib/hooks';

type P = SVGProps<SVGSVGElement> & { tone?: string };

/** Temple border (korvai) — a run of gopuram triangles with a thread rule. Used as a section threshold. */
export function TempleBorder({ tone = 'currentColor', className = '', ...p }: P) {
  const peaks = Array.from({ length: 24 }, (_, i) => `M${i * 40} 26 L${i * 40 + 20} 4 L${i * 40 + 40} 26`).join(' ');
  return (
    <svg viewBox="0 0 960 34" preserveAspectRatio="none" className={className} fill="none" stroke={tone} strokeWidth="1.2" aria-hidden {...p}>
      <path d={peaks} style={{ ['--len' as string]: 2600 }} />
      <path d="M0 30 H960" />
      <path d="M0 33 H960" strokeOpacity=".5" />
    </svg>
  );
}

/** Kalga — the mango/paisley. */
export function Kalga({ tone = 'currentColor', className = '', ...p }: P) {
  return (
    <svg viewBox="0 0 80 110" className={className} fill="none" stroke={tone} strokeWidth="1.2" aria-hidden {...p}>
      <path d="M40 104C10 104 4 70 18 48C30 30 52 26 60 8C70 34 74 60 64 82C58 96 50 104 40 104Z" style={{ ['--len' as string]: 320 }} />
      <path d="M40 92C22 92 18 72 26 58C34 46 48 42 54 30C60 48 62 64 56 76C52 86 46 92 40 92Z" style={{ ['--len' as string]: 240 }} />
      <circle cx="40" cy="70" r="5" style={{ ['--len' as string]: 40 }} />
    </svg>
  );
}

/** Kolam — dot grid with looping lines. */
export function Kolam({ tone = 'currentColor', className = '', ...p }: P) {
  const dots = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) dots.push(<circle key={`${x}${y}`} cx={20 + x * 20} cy={20 + y * 20} r="1.4" fill={tone} stroke="none" />);
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" stroke={tone} strokeWidth="1" aria-hidden {...p}>
      {dots}
      <path
        d="M60 10 C80 30 80 30 110 60 C80 90 80 90 60 110 C40 90 40 90 10 60 C40 30 40 30 60 10Z M60 30 C70 45 75 50 90 60 C75 70 70 75 60 90 C50 75 45 70 30 60 C45 50 50 45 60 30Z"
        style={{ ['--len' as string]: 700 }}
      />
    </svg>
  );
}

/** Jaali lattice — tiled background. */
export function Jaali({ tone = 'currentColor', className = '', id = 'jaali' }: { tone?: string; className?: string; id?: string }) {
  return (
    <svg className={className} aria-hidden width="100%" height="100%">
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M28 0 L56 28 L28 56 L0 28Z M28 12 L44 28 L28 44 L12 28Z" fill="none" stroke={tone} strokeWidth=".7" />
          <circle cx="28" cy="28" r="2" fill={tone} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Lotus outline. */
export function Lotus({ tone = 'currentColor', className = '', ...p }: P) {
  return (
    <svg viewBox="0 0 120 80" className={className} fill="none" stroke={tone} strokeWidth="1.2" aria-hidden {...p}>
      <path d="M60 70C48 52 48 28 60 8C72 28 72 52 60 70Z" style={{ ['--len' as string]: 170 }} />
      <path d="M60 70C40 64 28 44 30 22C46 30 58 48 60 70Z" style={{ ['--len' as string]: 170 }} />
      <path d="M60 70C80 64 92 44 90 22C74 30 62 48 60 70Z" style={{ ['--len' as string]: 170 }} />
      <path d="M60 70C34 72 14 60 6 44C26 42 46 52 60 70Z" style={{ ['--len' as string]: 170 }} />
      <path d="M60 70C86 72 106 60 114 44C94 42 74 52 60 70Z" style={{ ['--len' as string]: 170 }} />
      <path d="M20 74H100" style={{ ['--len' as string]: 90 }} />
    </svg>
  );
}

/** Peacock (mayil) — simplified outline for borders and empty states. */
export function Peacock({ tone = 'currentColor', className = '', ...p }: P) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" stroke={tone} strokeWidth="1.2" aria-hidden {...p}>
      <path d="M44 96C40 76 46 58 60 50C56 40 58 28 66 22C70 30 70 40 66 48C78 50 86 62 84 78C82 92 66 102 44 96Z" style={{ ['--len' as string]: 330 }} />
      <path d="M66 22C64 16 60 14 56 16M66 22L72 14" style={{ ['--len' as string]: 40 }} />
      <path d="M84 78C104 70 124 74 144 92C120 94 100 92 84 86" style={{ ['--len' as string]: 160 }} />
      <path d="M86 70C110 54 134 54 154 66C130 74 108 76 88 76" style={{ ['--len' as string]: 160 }} />
      <circle cx="126" cy="84" r="5" style={{ ['--len' as string]: 40 }} />
      <circle cx="136" cy="64" r="5" style={{ ['--len' as string]: 40 }} />
      <path d="M50 96L46 112M60 98L62 112" style={{ ['--len' as string]: 40 }} />
    </svg>
  );
}

/** Logo mark: a thread loop forming a stylised "T" inside a temple arch. */
export function LogoMark({ className = '', tone = 'currentColor' }: { className?: string; tone?: string }) {
  return (
    <svg viewBox="0 0 48 56" className={className} fill="none" stroke={tone} strokeWidth="1.6" aria-hidden>
      <path d="M6 54V22C6 11 14 4 24 4C34 4 42 11 42 22V54" />
      <path d="M14 20H34M24 20V46" />
      <path d="M18 46C18 50 30 50 30 46" />
    </svg>
  );
}

/** Text wordmark placeholder — swap for the real logo in Admin → Settings → Logo URL. */
export function Wordmark({ className = '', logoUrl }: { className?: string; logoUrl?: string }) {
  if (logoUrl) return <img src={logoUrl} alt="Tarun Silks" className={className} style={{ height: 32, width: 'auto' }} />;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-6 w-5 text-maroon dark:text-gold md:h-7 md:w-6" />
      <span className="whitespace-nowrap font-serif text-[17px] leading-none tracking-[0.12em] md:text-[22px] md:tracking-[0.18em]">TARUN&nbsp;SILKS</span>
    </span>
  );
}

/** Wraps an ornament so it draws itself when scrolled into view. */
export function Draw({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className={`draw ${className}`}>
      {children}
    </div>
  );
}
