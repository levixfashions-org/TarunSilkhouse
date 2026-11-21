import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Keep memory low on small hosting plans: no image cache, one image thread.
sharp.cache(false);
sharp.concurrency(1);
import { env } from '../env.ts';
import { badRequest } from './errors.ts';

/**
 * Where image bytes live. Today: local disk under UPLOAD_DIR, served at /uploads with a 1-year cache.
 * To move to S3 / Cloudflare R2 later, write another class with the same two methods
 * and swap it in `storage` below — nothing else in the app touches the filesystem.
 */
export interface ImageStorage {
  put(key: string, data: Buffer, contentType: string): Promise<string>; // returns public URL
  remove(key: string): Promise<void>;
}

class DiskStorage implements ImageStorage {
  constructor(private root: string, private publicBase = '/uploads') {}
  async put(key: string, data: Buffer) {
    const file = path.join(this.root, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return `${this.publicBase}/${key}`;
  }
  async remove(key: string) {
    await fs.rm(path.join(this.root, key), { force: true });
  }
}

export const uploadRoot = path.resolve(env.UPLOAD_DIR);
export const storage: ImageStorage = new DiskStorage(uploadRoot);

const SIZES = { thumb: 600, main: 1600, zoom: 2600 } as const;

/** Detect real file type from magic bytes — never trust the browser's mimetype or extension. */
export function sniffImage(buf: Buffer): 'jpeg' | 'png' | 'webp' | 'avif' | 'heic' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'avif';
    if (['heic', 'heix', 'mif1', 'msf1', 'hevc'].includes(brand)) return 'heic';
  }
  return null;
}

export type StoredImage = {
  key: string;
  original: string;
  thumb: string;
  main: string;
  zoom: string;
  width: number;
  height: number;
  bytes: number;
  savedBytes: number;
  mime: string;
};

/**
 * Saves the original plus 3 WebP sizes (and JPEG fallbacks with the same name + .jpg).
 * `keepOriginalQuality` (hero banners) raises WebP quality to 92.
 */
export async function storeImage(buf: Buffer, opts: { keepOriginalQuality?: boolean } = {}): Promise<StoredImage> {
  const kind = sniffImage(buf);
  if (!kind) throw badRequest('Only JPEG, PNG, WebP or AVIF images are allowed', 'bad_image');
  if (kind === 'heic') throw badRequest('HEIC photos are not supported — please export as JPEG from your phone', 'bad_image');

  const meta = await sharp(buf, { failOn: 'error' }).rotate().metadata();
  if (!meta.width || !meta.height) throw badRequest('Could not read this image', 'bad_image');
  if (meta.width * meta.height > 80_000_000) throw badRequest('Image is too large (max 80 megapixels)', 'bad_image');

  const d = new Date();
  const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomBytes(8).toString('hex')}`;
  const ext = kind === 'jpeg' ? 'jpg' : kind;
  const original = await storage.put(`${key}/original.${ext}`, buf, `image/${kind}`);
  const q = opts.keepOriginalQuality ? 92 : 80;

  const out: Record<string, string> = {};
  let outBytes = 0;
  for (const [name, width] of Object.entries(SIZES)) {
    const pipeline = sharp(buf).rotate().resize({ width, withoutEnlargement: true });
    const webp = await pipeline.clone().webp({ quality: q, effort: 4 }).toBuffer();
    const jpg = await pipeline.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer();
    out[name] = await storage.put(`${key}/${name}.webp`, webp, 'image/webp');
    await storage.put(`${key}/${name}.jpg`, jpg, 'image/jpeg');
    if (name === 'main') outBytes = webp.length;
  }
  return {
    key,
    original,
    thumb: out.thumb,
    main: out.main,
    zoom: out.zoom,
    width: meta.width,
    height: meta.height,
    bytes: buf.length,
    savedBytes: Math.max(0, buf.length - outBytes),
    mime: `image/${kind}`,
  };
}
