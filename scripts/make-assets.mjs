/**
 * Generates favicon, PWA icons, the hero poster (fallback for the WebGL silk) and the default
 * share image from the placeholder logo mark. Re-run after you change the logo:
 *   node scripts/make-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.resolve('server/package.json'));
const sharp = require('sharp');
const out = path.resolve('client/public');
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });

const mark = (stroke, w = 1.6) =>
  `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">
     <path d="M6 54V22C6 11 14 4 24 4C34 4 42 11 42 22V54"/><path d="M14 20H34M24 20V46"/><path d="M18 46C18 50 30 50 30 46"/></g>`;

const icon = (size, pad, bg = '#6B1F2A', fg = '#E6C27A') => {
  const inner = size - pad * 2;
  const scale = inner / 56;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bg}"/>
    <g transform="translate(${(size - 48 * scale) / 2} ${pad}) scale(${scale})">${mark(fg, 2.2)}</g></svg>`;
};

fs.writeFileSync(
  path.join(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6B1F2A"/><g transform="translate(14 6) scale(.75)">${mark('#E6C27A', 3)}</g></svg>`,
);
await sharp(Buffer.from(icon(192, 30))).png().toFile(path.join(out, 'icons/icon-192.png'));
await sharp(Buffer.from(icon(512, 80))).png().toFile(path.join(out, 'icons/icon-512.png'));
await sharp(Buffer.from(icon(512, 130))).png().toFile(path.join(out, 'icons/maskable-512.png'));
await sharp(Buffer.from(icon(180, 28))).png().toFile(path.join(out, 'icons/apple-touch-icon.png'));

// Hero poster: rippling maroon silk with a zari band — shown instantly and on devices that skip WebGL.
const W = 1920, H = 1080;
const folds = Array.from({ length: 14 }, (_, i) => {
  const x = -100 + i * 160;
  return `<path d="M${x} -50 C ${x + 120} 300, ${x - 80} 700, ${x + 60} ${H + 50}" stroke="url(#fold)" stroke-width="90" fill="none" opacity=".55"/>
          <path d="M${x + 40} -50 C ${x + 160} 300, ${x - 40} 700, ${x + 100} ${H + 50}" stroke="#FFE7C2" stroke-width="6" fill="none" opacity=".09"/>`;
}).join('');
const teeth = Array.from({ length: 49 }, (_, i) => `<path d="M${i * 40} ${H - 150} l20 -24 l20 24z" fill="#C99A45"/>`).join('');
const poster = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx=".35" cy=".3" r="1"><stop offset="0" stop-color="#8E2A3A"/><stop offset=".55" stop-color="#5A1622"/><stop offset="1" stop-color="#1B0A0E"/></radialGradient>
    <linearGradient id="fold" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#FFD9A8" stop-opacity=".25"/></linearGradient>
    <pattern id="b" width="90" height="80" patternUnits="userSpaceOnUse"><path d="M45 22c8 8 8 20 0 26c-8-6-8-18 0-26z" fill="#C99A45" opacity=".55"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H - 200}" fill="url(#b)" opacity=".5"/>
  ${folds}
  <rect y="${H - 200}" width="${W}" height="200" fill="#2A0B12" opacity=".85"/>
  <rect y="${H - 196}" width="${W}" height="4" fill="#C99A45"/>
  ${teeth}
  <rect y="${H - 120}" width="${W}" height="3" fill="#C99A45" opacity=".8"/>
  <rect width="${W}" height="${H}" fill="#1B0A0E" opacity=".25"/>
</svg>`;
await sharp(Buffer.from(poster)).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(out, 'hero-poster.jpg'));

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#FBF7F0"/>
  <rect x="0" y="560" width="1200" height="70" fill="#6B1F2A"/>
  <g transform="translate(560 120) scale(1.7)">${mark('#6B1F2A', 1.6)}</g>
  <text x="600" y="330" font-family="Georgia, serif" font-size="64" letter-spacing="14" text-anchor="middle" fill="#1B1612">TARUN SILKS</text>
  <text x="600" y="400" font-family="Georgia, serif" font-style="italic" font-size="40" text-anchor="middle" fill="#B8893B">Six yards of poetry</text>
</svg>`;
await sharp(Buffer.from(og)).jpeg({ quality: 85 }).toFile(path.join(out, 'og-default.jpg'));
console.log('Assets written to client/public');
