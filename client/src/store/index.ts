import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiError, del, get, post, put } from '@/lib/api';
import type { Boot, LineOptions } from '@/lib/types';
import { setUiSounds, startAmbience, stopAmbience } from '@/lib/sound';

/* ---------------- Bootstrap (store info, menu, homepage) ---------------- */
type BootState = { boot: Boot | null; error: string | null; load: () => Promise<void> };
export const useBoot = create<BootState>((set) => ({
  boot: null,
  error: null,
  load: async () => {
    // While the server finishes first-start setup it answers 503 "setting_up": wait and retry quietly.
    for (let attempt = 0; attempt < 24; attempt++) {
      try {
        set({ boot: await get<Boot>('/bootstrap'), error: null });
        return;
      } catch (e) {
        const err = e as ApiError;
        if (err.code === 'setting_up' || err.status === 502 || err.status === 503) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        set({ error: err.message });
        return;
      }
    }
    set({ error: 'The store is taking longer than usual to start. Please try again in a minute.' });
  },
}));

/* ---------------- Bag ---------------- */
export type BagItem = {
  key: string; // productId:colourId:optionsHash
  productId: string;
  colourId: string;
  qty: number;
  options?: LineOptions;
  // display snapshot (prices are always re-quoted by the server)
  name: string;
  slug: string;
  colourName: string;
  image: string | null;
  price: number;
};

const keyOf = (productId: string, colourId: string, options?: LineOptions) =>
  `${productId}:${colourId}:${options?.fallPico ? 'fp' : ''}${options?.stitching ? 'st' : ''}`;

type BagState = {
  items: BagItem[];
  open: boolean;
  cartId: string | null;
  email: string | null;
  add: (i: Omit<BagItem, 'key' | 'qty'> & { qty?: number }) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setOpen: (o: boolean) => void;
  setEmail: (e: string) => void;
  count: () => number;
};

let syncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const s = useBag.getState();
    if (!s.email && !useAuth.getState().user) return;
    try {
      const r = await post<{ cartId: string }>('/cart/sync', {
        cartId: s.cartId ?? undefined,
        email: s.email ?? undefined,
        items: s.items.map(({ productId, colourId, qty }) => ({ productId, colourId, qty })),
      });
      useBag.setState({ cartId: r.cartId });
    } catch {
      /* best effort */
    }
  }, 2500);
}

export const useBag = create<BagState>()(
  persist(
    (set, getS) => ({
      items: [],
      open: false,
      cartId: null,
      email: null,
      add: (i) => {
        const key = keyOf(i.productId, i.colourId, i.options);
        const items = [...getS().items];
        const hit = items.find((x) => x.key === key);
        if (hit) hit.qty = Math.min(10, hit.qty + (i.qty ?? 1));
        else items.unshift({ ...i, key, qty: i.qty ?? 1 });
        set({ items });
        scheduleSync();
      },
      setQty: (key, qty) => {
        set({ items: getS().items.map((x) => (x.key === key ? { ...x, qty: Math.max(1, Math.min(10, qty)) } : x)) });
        scheduleSync();
      },
      remove: (key) => {
        set({ items: getS().items.filter((x) => x.key !== key) });
        scheduleSync();
      },
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
      setEmail: (email) => {
        set({ email });
        scheduleSync();
      },
      count: () => getS().items.reduce((s, i) => s + i.qty, 0),
    }),
    { name: 'ts-bag', partialize: (s) => ({ items: s.items, cartId: s.cartId, email: s.email }) },
  ),
);

/* ---------------- Wishlist (local for guests, synced when signed in) ---------------- */
type WishState = { ids: string[]; toggle: (id: string) => boolean; has: (id: string) => boolean; merge: () => Promise<void> };
export const useWish = create<WishState>()(
  persist(
    (set, getS) => ({
      ids: [],
      has: (id) => getS().ids.includes(id),
      toggle: (id) => {
        const on = !getS().ids.includes(id);
        set({ ids: on ? [id, ...getS().ids] : getS().ids.filter((x) => x !== id) });
        if (useAuth.getState().user) void (on ? put(`/account/wishlist/${id}`) : del(`/account/wishlist/${id}`)).catch(() => {});
        return on;
      },
      merge: async () => {
        try {
          const r = await post<{ ids: string[] }>('/account/wishlist/merge', { ids: getS().ids });
          set({ ids: r.ids });
        } catch {
          /* ignore */
        }
      },
    }),
    { name: 'ts-wish' },
  ),
);

/* ---------------- Recently viewed ---------------- */
type RecentState = { ids: string[]; push: (id: string) => void };
export const useRecent = create<RecentState>()(
  persist((set, getS) => ({ ids: [], push: (id) => set({ ids: [id, ...getS().ids.filter((x) => x !== id)].slice(0, 12) }) }), { name: 'ts-recent' }),
);

/* ---------------- UI: theme, sound, overlays, toasts ---------------- */
export type Theme = 'light' | 'dark' | 'auto';
type Toast = { id: number; text: string; tone?: 'ok' | 'error' };
type UIState = {
  theme: Theme;
  sound: boolean;
  searchOpen: boolean;
  menuOpen: boolean;
  toasts: Toast[];
  setTheme: (t: Theme) => void;
  toggleDark: () => void;
  setSound: (on: boolean) => void;
  setSearch: (o: boolean) => void;
  setMenu: (o: boolean) => void;
  toast: (text: string, tone?: 'ok' | 'error') => void;
};

export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('ts-theme', t);
  } catch {
    /* private mode */
  }
}

export const useUI = create<UIState>((set, getS) => ({
  theme: ((): Theme => {
    try {
      return (localStorage.getItem('ts-theme') as Theme) || 'auto';
    } catch {
      return 'auto';
    }
  })(),
  sound: false,
  searchOpen: false,
  menuOpen: false,
  toasts: [],
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleDark: () => {
    const isDark = document.documentElement.classList.contains('dark');
    getS().setTheme(isDark ? 'light' : 'dark');
  },
  setSound: (sound) => {
    setUiSounds(sound);
    if (sound) startAmbience();
    else stopAmbience();
    set({ sound });
  },
  setSearch: (searchOpen) => set({ searchOpen }),
  setMenu: (menuOpen) => set({ menuOpen }),
  toast: (text, tone = 'ok') => {
    const id = Date.now() + Math.random();
    set({ toasts: [...getS().toasts, { id, text, tone }] });
    setTimeout(() => set({ toasts: getS().toasts.filter((t) => t.id !== id) }), 3800);
  },
}));

/* ---------------- Auth ---------------- */
export type User = { id: string; email: string | null; phone: string | null; name: string | null; isAdmin: boolean };
type AuthState = { user: User | null; ready: boolean; set: (u: User | null) => void; setReady: () => void };
export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  set: (user) => set({ user }),
  setReady: () => set({ ready: true }),
}));
