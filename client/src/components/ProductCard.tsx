import { AnimatePresence, motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inr, pctOff } from '@/lib/format';
import type { Card } from '@/lib/types';
import { buzz, pluck } from '@/lib/sound';
import { useUI, useWish } from '@/store';
import { Framed } from './ui';

/** Fly a thumbnail from `from` into the bag icon in the header. */
export function flyToBag(from: HTMLElement | null, imgUrl: string | null) {
  const target = document.getElementById('bag-icon');
  if (!from || !target || !imgUrl) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const el = document.createElement('img');
  el.src = imgUrl.split('#')[0].replace(/main\.webp$/, 'thumb.webp');
  Object.assign(el.style, {
    position: 'fixed',
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    objectFit: 'cover',
    borderRadius: '18px',
    zIndex: '120',
    pointerEvents: 'none',
  } as CSSStyleDeclaration);
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = el.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.3 - 80}px) scale(.45)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.06)`, opacity: 0.4 },
    ],
    { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  );
  anim.onfinish = () => el.remove();
  buzz(20);
  pluck(784);
}

/** Heart that blooms into petals when wishlisted. */
export function WishHeart({ id, className = '' }: { id: string; className?: string }) {
  const on = useWish((s) => s.ids.includes(id));
  const toggle = useWish((s) => s.toggle);
  const toast = useUI((s) => s.toast);
  const [burst, setBurst] = useState(0);
  return (
    <button
      type="button"
      aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = toggle(id);
        if (now) {
          setBurst((b) => b + 1);
          pluck(988);
          toast('Saved to your wishlist');
        }
      }}
      className={`${className.includes('absolute') ? '' : 'relative'} flex h-11 w-11 items-center justify-center rounded-full bg-ivory/85 backdrop-blur ${className}`}
    >
      <motion.span animate={on ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.5 }}>
        <Heart size={18} strokeWidth={1.6} className={on ? 'fill-maroon text-maroon' : 'text-ink'} />
      </motion.span>
      <AnimatePresence>
        {burst > 0 && (
          <motion.span key={burst} className="pointer-events-none absolute left-1/2 top-1/2" initial="a" animate="b" exit={{ opacity: 0 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const ang = (i / 7) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  className="absolute h-2.5 w-1.5 rounded-full bg-maroon"
                  style={{ rotate: (ang * 180) / Math.PI + 90, marginLeft: -3, marginTop: -5 }}
                  variants={{ a: { x: 0, y: 0, opacity: 1, scale: 0.4 }, b: { x: Math.cos(ang) * 26, y: Math.sin(ang) * 26, opacity: 0, scale: 1 } }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              );
            })}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export function ProductCard({ p, priority = false, sizes }: { p: Card; priority?: boolean; sizes?: string }) {
  const [idx, setIdx] = useState(0);
  const [colour, setColour] = useState<string | null>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const imgs = colour ? p.images.filter((i) => i.colourId === colour).concat(p.images.filter((i) => i.colourId !== colour)) : p.images;
  const shown = imgs[idx] ?? imgs[0];
  const off = pctOff(p.price, p.mrp);

  // 3D tilt with a moving highlight (desktop pointers only)
  const onMove = (e: RPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const el = tiltRef.current!;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 6}deg) rotateY(${(px - 0.5) * 8}deg)`;
    el.style.setProperty('--hx', `${px * 100}%`);
    el.style.setProperty('--hy', `${py * 100}%`);
    if (imgs.length > 1) setIdx(px > 0.5 ? 1 : 0);
  };
  const onLeave = () => {
    const el = tiltRef.current!;
    el.style.transform = '';
    setIdx(0);
  };

  // Shared-element feel: view transition from card image to product hero where supported.
  const open = (e: React.MouseEvent) => {
    const d = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (!d.startViewTransition || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const img = tiltRef.current?.querySelector('img');
    if (img) (img.style as CSSStyleDeclaration & { viewTransitionName: string }).viewTransitionName = 'product-hero';
    d.startViewTransition(() => nav(`/products/${p.slug}${colour ? `?colour=${colour}` : ''}`));
  };

  return (
    <article className="group relative">
      <Link to={`/products/${p.slug}${colour ? `?colour=${colour}` : ''}`} onClick={open} data-cursor="view" className="block">
        <div
          ref={tiltRef}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className="arch arch-line transition-transform duration-600 ease-silk will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* swipeable photos on touch */}
          <div
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto md:overflow-hidden"
            onScroll={(e) => {
              const t = e.currentTarget;
              setIdx(Math.round(t.scrollLeft / t.clientWidth));
            }}
          >
            {(matchMedia('(hover: none)').matches ? imgs.slice(0, 4) : [shown]).map((im, i) => (
              <div key={`${im?.url}-${i}`} className="w-full shrink-0 snap-center">
                <Framed url={im?.url} alt={im?.alt ?? p.name} priority={priority && i === 0} sizes={sizes} imgClassName="group-hover:scale-[1.03]" />
              </div>
            ))}
          </div>
          <span
            className="pointer-events-none absolute left-0 top-0 h-full w-full opacity-0 transition-opacity duration-600 group-hover:opacity-100"
            style={{ background: 'radial-gradient(circle at var(--hx,50%) var(--hy,50%), rgba(255,240,210,.28), transparent 45%)' }}
          />
          <div className="absolute left-1/2 top-[16%] z-[4] flex -translate-x-1/2 flex-col items-center gap-1.5">
            {p.soldOut ? (
              <span className="rounded-full bg-ink px-3 py-1 text-[12px] text-ivory">Sold out</span>
            ) : p.lowStock ? (
              <span className="rounded-full bg-ivory/90 px-3 py-1 text-[12px] text-maroon">Only {p.lowStock} left</span>
            ) : p.isNew ? (
              <span className="rounded-full bg-ivory/90 px-3 py-1 text-[12px]">New</span>
            ) : null}
            {p.handloomMark && <span className="rounded-full bg-gold/95 px-3 py-1 text-[12px] text-[#1B1612]">Handloom</span>}
          </div>
          {imgs.length > 1 && (
            <div className="absolute bottom-4 left-0 z-[4] flex w-full justify-center gap-1 md:hidden">
              {imgs.slice(0, 4).map((_, i) => (
                <span key={i} className={`h-1 rounded-full bg-ivory transition-all ${i === idx ? 'w-4' : 'w-1 opacity-60'}`} />
              ))}
            </div>
          )}
        </div>
      </Link>
      <WishHeart id={p.id} className="absolute right-2.5 top-2.5" />
      <div className="mt-3 flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{p.fabric}</p>
          <h3 className="line-clamp-2 font-serif text-[1.25rem] leading-snug md:truncate md:text-[1.3rem]">
            <Link to={`/products/${p.slug}`}>{p.name}</Link>
          </h3>
        </div>
        <div className="flex shrink-0 items-baseline gap-2 md:block md:text-right">
          <p className="text-[15px] font-medium">{inr(p.price)}</p>
          {off > 0 && (
            <p className="text-[12px] text-muted">
              <s>{inr(p.mrp)}</s> <span className="text-sage">{off}% off</span>
            </p>
          )}
        </div>
      </div>
      {p.colours.length > 1 && (
        <div className="mt-2 flex items-center gap-1.5" role="group" aria-label="Colours">
          {p.colours.slice(0, 6).map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={colour === c.id}
              onMouseEnter={() => setColour(c.id)}
              onClick={() => {
                setColour(c.id);
                setIdx(0);
              }}
              className={`h-4 w-4 rounded-full border transition-transform ${colour === c.id ? 'scale-125 border-ink' : 'border-ink/15'} ${c.inStock ? '' : 'opacity-40'}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div>
      <div className="arch frame skeleton" />
      <div className="skeleton mt-3 h-4 w-1/3 rounded" />
      <div className="skeleton mt-2 h-5 w-2/3 rounded" />
    </div>
  );
}
