/**
 * Image URLs may carry admin framing as a hash: "/uploads/…/main.webp#lx=40,30,1.2"
 * x,y = focal point in % (object-position), zoom ≥ 1 (scale around the focal point).
 * Every <Framed> image on the site honours it, so the Adjust tool works everywhere.
 */
export type Frame = { x: number; y: number; zoom: number };

export function parseFrame(url: string | null | undefined): { src: string; frame: Frame } {
  if (!url) return { src: '', frame: { x: 50, y: 50, zoom: 1 } };
  const [src, hash = ''] = url.split('#');
  const m = hash.match(/lx=([\d.]+),([\d.]+),([\d.]+)/);
  const frame = m ? { x: clamp(+m[1], 0, 100), y: clamp(+m[2], 0, 100), zoom: clamp(+m[3], 1, 4) } : { x: 50, y: 50, zoom: 1 };
  return { src, frame };
}

export const withFrame = (src: string, f: Frame) => `${src.split('#')[0]}#lx=${f.x.toFixed(1)},${f.y.toFixed(1)},${f.zoom.toFixed(2)}`;

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, Number.isFinite(n) ? n : a));

/** Our uploads have thumb/main/zoom siblings in WebP + JPEG. */
const isOurs = (src: string) => /\/uploads\/.+\/(thumb|main|zoom)\.(webp|jpg)$/.test(src);

export function variant(src: string, size: 'thumb' | 'main' | 'zoom', fmt: 'webp' | 'jpg' = 'webp') {
  if (!isOurs(src)) return src;
  return src.replace(/(thumb|main|zoom)\.(webp|jpg)$/, `${size}.${fmt}`);
}

export function srcSet(src: string, fmt: 'webp' | 'jpg' = 'webp') {
  if (!isOurs(src)) return undefined;
  return `${variant(src, 'thumb', fmt)} 600w, ${variant(src, 'main', fmt)} 1600w, ${variant(src, 'zoom', fmt)} 2600w`;
}

export const frameStyle = (f: Frame): React.CSSProperties => ({
  objectPosition: `${f.x}% ${f.y}%`,
  transform: f.zoom !== 1 ? `scale(${f.zoom})` : undefined,
  transformOrigin: `${f.x}% ${f.y}%`,
});
