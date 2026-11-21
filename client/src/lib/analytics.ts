/**
 * GA4 + Meta Pixel hooks, loaded only after the visitor accepts analytics cookies.
 * IDs come from Admin → Settings (store.gaId, store.metaPixelId).
 */
type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: ((...a: unknown[]) => void) & { q?: unknown[] } };
const w = () => window as W;

export const consent = {
  get: (): 'yes' | 'no' | null => {
    try {
      return localStorage.getItem('ts-consent') as 'yes' | 'no' | null;
    } catch {
      return null;
    }
  },
  set: (v: 'yes' | 'no') => {
    try {
      localStorage.setItem('ts-consent', v);
    } catch {
      /* ignore */
    }
  },
};

let loaded = false;
export function loadAnalytics(gaId: string, pixelId: string) {
  if (loaded || consent.get() !== 'yes') return;
  loaded = true;
  if (gaId) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(s);
    w().dataLayer = w().dataLayer || [];
    w().gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w().dataLayer!.push(arguments);
    };
    w().gtag!('js', new Date());
    w().gtag!('config', gaId, { anonymize_ip: true });
  }
  if (pixelId) {
    const f = function fbq(...a: unknown[]) {
      (f.q = f.q || []).push(a);
    } as ((...a: unknown[]) => void) & { q?: unknown[] };
    w().fbq = f;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    f('init', pixelId);
    f('track', 'PageView');
  }
}

export function track(event: 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase', params: Record<string, unknown> = {}) {
  w().gtag?.('event', event, { currency: 'INR', ...params });
  const fbMap = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase' } as const;
  w().fbq?.('track', fbMap[event], { currency: 'INR', ...params });
}

export function pageview(path: string) {
  w().gtag?.('event', 'page_view', { page_path: path });
  w().fbq?.('track', 'PageView');
}
