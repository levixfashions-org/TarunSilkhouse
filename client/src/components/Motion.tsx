import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { isTouch } from '@/lib/device';

/**
 * Lenis inertia scrolling wired into GSAP ScrollTrigger. Loaded after first paint and only on
 * storefront pages (checkout/admin stay native for form usability).
 */
export function SmoothScroll() {
  const { pathname } = useLocation();
  const active = !/^\/(admin|checkout|account)/.test(pathname);
  useEffect(() => {
    if (!active) return;
    let destroy: (() => void) | null = null;
    let cancelled = false;
    void Promise.all([import('lenis'), import('gsap'), import('gsap/ScrollTrigger')]).then(([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ duration: 1.1, easing: (t: number) => 1 - Math.pow(1 - t, 4), touchMultiplier: 1.4, syncTouch: false });
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      (window as unknown as { __lenis?: unknown }).__lenis = lenis;
      destroy = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
        (window as unknown as { __lenis?: unknown }).__lenis = undefined;
      };
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [active]);

  // Scroll to top on navigation (unless returning via back button with a hash)
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Soft gold ring that follows the pointer, growing into "View" over products. Desktop only. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isTouch()) return;
    const el = ref.current!;
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let cx = x;
    let cy = y;
    let raf = 0;
    const loop = () => {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const t = e.target as HTMLElement;
      const view = t.closest('[data-cursor="view"]');
      el.classList.toggle('is-view', !!view);
      el.textContent = view ? (view.getAttribute('data-cursor-label') ?? 'View') : '';
      el.style.opacity = t.closest('input,textarea,select,[data-cursor="hide"]') ? '0' : '1';
    };
    window.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
    };
  }, []);
  return <div ref={ref} className="cursor-ring" aria-hidden />;
}
