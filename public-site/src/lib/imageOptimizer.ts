/**
 * Image optimizer helpers — for Unsplash + custom asset URLs.
 * - For Unsplash: adds format=auto + width params to leverage their CDN optimization.
 * - For other URLs: returns as-is.
 */

import { staticURL } from "../services/api";

const UNSPLASH_HOSTS = ["images.unsplash.com", "plus.unsplash.com"];

function isUnsplash(url) {
  if (!url) return false;
  return UNSPLASH_HOSTS.some((host) => String(url).includes(host));
}

/**
 * Build an optimized Unsplash URL with width + auto format.
 */
export function optimizeImage(url, { width = 1200, quality = 80 } = {}) {
  if (!url) return url;
  if (!isUnsplash(url)) return url;

  // Strip existing query params and rebuild
  const base = url.split("?")[0];
  return `${base}?w=${width}&q=${quality}&auto=format&fit=crop`;
}

/**
 * Build a srcSet string for responsive images.
 * Returns null for non-Unsplash URLs.
 */
export function buildSrcSet(url, widths = [480, 768, 1024, 1440, 1920]) {
  if (!url || !isUnsplash(url)) return null;
  return widths
    .map((w) => `${optimizeImage(url, { width: w })} ${w}w`)
    .join(", ");
}

/**
 * buildSizes attribute for responsive images.
 */
export function buildSizes(customSizes) {
  if (customSizes) return customSizes;
  return "(max-width: 640px) 100vw, (max-width: 1024px) 75vw, 50vw";
}

const ABSOLUTE_URL = /^(https?:)?\/\//i;
const DATA_URL = /^(data|blob):/i;

/**
 * Turn a stored asset path into a URL the browser can load.
 *
 * Tenant records store media as a bare path ("/uploads/logo.png"), while
 * defaults and CDN entries are already absolute. The origin comes from the same
 * `VITE_API_URL` the api client itself uses, so a split-origin deployment
 * resolves media against the API host and never guesses one — an earlier
 * version hard-coded `http://localhost:8000` here and shipped broken images to
 * production. Empty means "same origin as the page", which is the default.
 */
export function resolveAssetUrl(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value);
  if (ABSOLUTE_URL.test(raw) || DATA_URL.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return staticURL ? `${staticURL.replace(/\/$/, "")}${path}` : path;
}
