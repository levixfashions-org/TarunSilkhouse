import { useEffect, useState } from 'react';
import { isStandalone } from '@/lib/device';

/**
 * Branded intro: a gold thread weaves into the logo mark (2.4 s). Built from separate layered
 * elements with CSS transitions (no SMIL / clipPath tricks), so iPhone Safari renders it reliably.
 * Shown on the first visit and when opened as the installed app; never on reload, back,
 * or when returning from a payment redirect. Skippable with a tap or any key.
 */
function shouldShow(pathname: string) {
  try {
    if (/^\/(order|checkout|admin|account)/.test(pathname)) return false;
    if (sessionStorage.getItem('ts-intro-session')) return false;
    if (isStandalone()) return true;
    return !localStorage.getItem('ts-intro-seen');
  } catch {
    return false;
  }
}

export function Intro() {
  const [show, setShow] = useState(() => shouldShow(location.pathname));
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem('ts-intro-session', '1');
      localStorage.setItem('ts-intro-seen', '1');
    } catch {
      /* ignore */
    }
    const t1 = setTimeout(() => setStage(1), 60);
    const t2 = setTimeout(() => setStage(2), 1300);
    const t3 = setTimeout(() => setStage(3), 2300);
    const t4 = setTimeout(() => setShow(false), 3000);
    const skip = () => {
      setStage(3);
      setTimeout(() => setShow(false), 500);
    };
    window.addEventListener('keydown', skip, { once: true });
    return () => {
      [t1, t2, t3, t4].forEach(clearTimeout);
      window.removeEventListener('keydown', skip);
    };
  }, [show]);
  if (!show) return null;

  const t = 'transition-all duration-1200 ease-silk';
  return (
    <div
      className={`fixed left-0 top-0 z-[200] flex h-full w-full cursor-pointer items-center justify-center bg-[#1B1612] ${t} ${stage === 3 ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      onClick={() => {
        setStage(3);
        setTimeout(() => setShow(false), 500);
      }}
      role="presentation"
    >
      <div className="relative h-[132px] w-[112px]">
        {/* the arch: two separate halves drawn as bordered boxes so they animate without SVG masks */}
        <div
          className={`absolute bottom-0 left-0 h-[132px] w-[56px] rounded-tl-[56px] border-l-[1.5px] border-t-[1.5px] border-[#B8893B] ${t}`}
          style={{ transform: stage >= 1 ? 'none' : 'translateY(24px)', opacity: stage >= 1 ? 1 : 0 }}
        />
        <div
          className={`absolute bottom-0 right-0 h-[132px] w-[56px] rounded-tr-[56px] border-r-[1.5px] border-t-[1.5px] border-[#B8893B] ${t}`}
          style={{ transform: stage >= 1 ? 'none' : 'translateY(24px)', opacity: stage >= 1 ? 1 : 0, transitionDelay: '120ms' }}
        />
        {/* the weft thread sweeps across */}
        <div className={`absolute left-[22px] top-[46px] h-[1.5px] bg-[#B8893B] ${t}`} style={{ width: stage >= 1 ? 68 : 0, transitionDelay: '350ms' }} />
        {/* the warp thread drops */}
        <div className={`absolute left-[55px] top-[46px] w-[1.5px] bg-[#B8893B] ${t}`} style={{ height: stage >= 1 ? 58 : 0, transitionDelay: '600ms' }} />
        <div
          className={`absolute left-[40px] top-[102px] h-[12px] w-[32px] rounded-b-full border-b-[1.5px] border-l-[1.5px] border-r-[1.5px] border-[#B8893B] ${t}`}
          style={{ opacity: stage >= 1 ? 1 : 0, transitionDelay: '850ms' }}
        />
        {/* zari shimmer sweeping over the mark */}
        <div
          className="absolute left-[-40px] top-0 h-full w-[40px] bg-gradient-to-r from-transparent via-[#F5DFA8]/50 to-transparent"
          style={{ transform: stage >= 2 ? 'translateX(190px)' : 'none', transition: 'transform 1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>
      <div
        className={`absolute bottom-[22%] left-0 w-full text-center font-serif text-[26px] tracking-[0.32em] text-[#FBF7F0] ${t}`}
        style={{ opacity: stage >= 2 ? 1 : 0, transform: stage >= 2 ? 'none' : 'translateY(12px)' }}
      >
        TARUN SILKS
      </div>
      <button className="absolute bottom-8 right-6 rounded-full px-4 py-2 text-[13px] text-[#FBF7F0]/60 hover:text-[#FBF7F0]" aria-label="Skip intro">
        Skip
      </button>
    </div>
  );
}
