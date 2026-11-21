export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;
export const setTokenGetter = (fn: TokenGetter) => {
  getToken = fn;
};

export const currentToken = () => getToken();

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = await getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers, body });
  } catch {
    throw new ApiError(0, 'You seem to be offline. Check your connection and try again.', 'offline');
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, e?.message ?? 'Something went wrong. Please try again.', e?.code ?? 'error', e?.details);
  }
  return data as T;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} });
export const put = <T,>(path: string, json?: unknown) => api<T>(path, { method: 'PUT', json: json ?? {} });
export const patch = <T,>(path: string, json?: unknown) => api<T>(path, { method: 'PATCH', json: json ?? {} });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });

/** Tiny SWR-style cache so going back to a page is instant. */
const cache = new Map<string, { at: number; data: unknown }>();
export async function cached<T>(path: string, maxAgeMs = 60_000): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data as T;
  const data = await get<T>(path);
  cache.set(path, { at: Date.now(), data });
  return data;
}
export const peek = <T,>(path: string) => cache.get(path)?.data as T | undefined;
export const clearCache = () => cache.clear();
