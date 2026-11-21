import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { frameStyle, parseFrame, srcSet, variant } from '@/lib/image';
import { useReveal } from '@/lib/hooks';
import { useUI } from '@/store';

export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * An image locked into a 4:5 frame that honours the admin's #lx framing.
 * Serves WebP with a JPEG fallback and the right size via srcset. Skeleton until loaded — no layout jumps.
 */
export function Framed({
  url,
  alt,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  priority = false,
  className = '',
  ratio = 125,
  imgClassName = '',
  style,
  vtName,
}: {
  url: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  ratio?: number; // padding-bottom % (125 = 4:5)
  imgClassName?: string;
  style?: React.CSSProperties;
  vtName?: string;
}) {
  const { src, frame } = parseFrame(url);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, [src]);
  return (
    <div className={`frame ${className}`} style={{ paddingBottom: `${ratio}%`, ...style }}>
      {!loaded && <div className="frame-fill skeleton" />}
      {src && (
        <picture>
          {srcSet(src) && <source type="image/webp" srcSet={srcSet(src)} sizes={sizes} />}
          <img
            ref={ref}
            src={variant(src, 'main', srcSet(src) ? 'jpg' : 'webp')}
            srcSet={srcSet(src, 'jpg')}
            sizes={sizes}
            alt={alt}
            width={800}
            height={1000}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            // eslint-disable-next-line react/no-unknown-property
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setLoaded(true)}
            className={`absolute left-0 top-0 h-full w-full object-cover transition-[opacity,transform] duration-900 ease-silk ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
            style={{ ...frameStyle(frame), viewTransitionName: vtName } as React.CSSProperties}
          />
        </picture>
      )}
    </div>
  );
}

/** Huge serif heading revealed line by line with a mask. Pass lines as an array. */
export function Reveal({ lines, as: Tag = 'h2', className = '', italicLast = false }: { lines: string[]; as?: 'h1' | 'h2' | 'h3'; className?: string; italicLast?: boolean }) {
  const ref = useReveal<HTMLHeadingElement>(0.3);
  return (
    <Tag ref={ref} className={className}>
      {lines.map((l, i) => (
        <span key={i} className="mask-line">
          <span className={italicLast && i === lines.length - 1 && lines.length > 1 ? 'italic' : ''}>{l}</span>
        </span>
      ))}
    </Tag>
  );
}

/** Button/link that leans toward the pointer (desktop only). */
export function Magnetic({ children, strength = 0.35, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(hover: none)').matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const leave = () => {
      el.style.transform = 'translate3d(0,0,0)';
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [strength]);
  return (
    <span ref={ref} className={`inline-block transition-transform duration-600 ease-silk ${className}`}>
      {children}
    </span>
  );
}

/** Spring bottom sheet on mobile, side panel on desktop. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  side = 'right',
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'right' | 'left' | 'bottom';
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [open, onClose]);
  const mobileBottom = side === 'bottom';
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed left-0 top-0 z-[80] h-full w-full" role="dialog" aria-modal="true" aria-label={title} data-lenis-prevent>
          <motion.div className="absolute left-0 top-0 h-full w-full bg-ink/40 backdrop-blur-[2px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} />
          <motion.aside
            className={
              mobileBottom
                ? 'absolute bottom-0 left-0 flex max-h-[88vh] w-full flex-col rounded-t-sheet bg-ivory shadow-2xl'
                : `absolute top-0 flex h-full w-full ${wide ? 'max-w-[560px]' : 'max-w-[440px]'} flex-col bg-ivory shadow-2xl ${side === 'right' ? 'right-0' : 'left-0'}`
            }
            initial={mobileBottom ? { y: '100%' } : { x: side === 'right' ? '100%' : '-100%' }}
            animate={mobileBottom ? { y: 0 } : { x: 0 }}
            exit={mobileBottom ? { y: '100%' } : { x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          >
            {mobileBottom && <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line" />}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-serif text-2xl">{title}</h2>
              <button onClick={onClose} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-blush" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
            {footer && <div className="safe-bottom border-t border-line bg-paper px-5 py-4">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-[calc(var(--tabbar-h)+16px)] left-0 z-[95] flex w-full flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.5, ease: EASE }}
            className={`pointer-events-auto rounded-full px-5 py-3 text-[14px] shadow-lg ${t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-ivory'}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Safe rich text from the server (already sanitized there; DOMPurify again as belt and braces). */
export function RichText({ html, className = '' }: { html: string; className?: string }) {
  const [clean, setClean] = useState('');
  useEffect(() => {
    let alive = true;
    void import('dompurify').then(({ default: DOMPurify }) => alive && setClean(DOMPurify.sanitize(html)));
    return () => {
      alive = false;
    };
  }, [html]);
  return <div className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} aria-hidden />;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <svg viewBox="0 0 120 80" className="mb-6 h-16 w-24 text-gold" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
        <path d="M60 70C48 52 48 28 60 8C72 28 72 52 60 70Z M60 70C40 64 28 44 30 22C46 30 58 48 60 70Z M60 70C80 64 92 44 90 22C74 30 62 48 60 70Z M20 74H100" />
      </svg>
      <h2 className="font-serif text-d-4">{title}</h2>
      {body && <p className="mt-3 text-muted">{body}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
