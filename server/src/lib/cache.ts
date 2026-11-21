/**
 * Cache-busting on write. Every admin save bumps this version; public GET /api responses send
 * `ETag: W/"v<version>-…"` with `no-cache`, so browsers revalidate and changes show within seconds.
 */
let version = Date.now();
export const bump = () => {
  version = Date.now();
};
export const contentVersion = () => version;
