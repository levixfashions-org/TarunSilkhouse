/**
 * Decides whether the WebGL scenes may run. Low-end Android, older iPhones, battery saver,
 * data saver and missing WebGL all fall back to a still/poster or video.
 */
type Nav = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
  getBattery?: () => Promise<{ level: number; charging: boolean }>;
};

let verdict: Promise<'high' | 'low'> | null = null;

export function gpuTier(): Promise<'high' | 'low'> {
  verdict ??= (async () => {
    if (typeof window === 'undefined') return 'low';
    const n = navigator as Nav;
    if (new URLSearchParams(location.search).has('nogl')) return 'low';
    if (new URLSearchParams(location.search).has('forcegl')) return 'high'; // testing aid
    if (n.connection?.saveData) return 'low';
    if (n.connection?.effectiveType && /(^|-)2g|slow/.test(n.connection.effectiveType)) return 'low';
    if ((n.deviceMemory ?? 8) <= 3) return 'low';
    if ((n.hardwareConcurrency ?? 8) <= 4 && /Android/i.test(n.userAgent)) return 'low';

    // Old iPhones (iOS < 15) struggle with float textures + high DPR.
    const ios = n.userAgent.match(/OS (\d+)_\d+.*like Mac OS X/);
    if (ios && Number(ios[1]) < 15) return 'low';

    try {
      const c = document.createElement('canvas');
      const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
      if (!gl) return 'low';
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (/SwiftShader|llvmpipe|Software|Mali-4|Mali-T6|Adreno \(TM\) [1-4]\d\d|PowerVR SGX/i.test(renderer)) return 'low';
    } catch {
      return 'low';
    }

    try {
      const b = await n.getBattery?.();
      if (b && !b.charging && b.level < 0.2) return 'low'; // likely in battery saver
    } catch {
      /* not supported (Safari, Firefox) */
    }
    return 'high';
  })();
  return verdict;
}

export const isTouch = () => typeof window !== 'undefined' && matchMedia('(hover: none), (pointer: coarse)').matches;
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const reducedMotion = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
