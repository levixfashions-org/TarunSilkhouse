/* Tarun Silks service worker.
 * - HTML: network-first (fresh content, offline fallback to the cached shell)
 * - Hashed /assets/*: cache-first (immutable)
 * - Uploaded images: stale-while-revalidate
 * - NEVER intercepts video, audio or Range requests (that breaks video playback on iPhone Safari)
 * - Never touches /api, /admin or payment pages
 */
const VERSION = 'ts-__BUILD_ID__';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const IMAGES = `${VERSION}-images`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/favicon.svg'])).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return; // iPhone video
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.destination === 'video' || req.destination === 'audio') return;
  if (/\.(mp4|webm|mov|m4v|mp3|m4a|ogg|wav)$/i.test(url.pathname)) return;
  if (/^\/(api|admin|checkout|order)\b/.test(url.pathname)) return;
  if (url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } }))),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (url.pathname.startsWith('/uploads/') && /\.(webp|jpg|jpeg|png|avif)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(IMAGES).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
  }
});
