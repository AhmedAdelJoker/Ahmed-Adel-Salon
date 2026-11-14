/**
 * site.ts — the browser-side view of site.config.json.
 *
 * The canonical origin is resolved once here so no component ever has to
 * guess between window.location, an env var and a hard-coded domain. That
 * guesswork is what previously let index.html advertise barberluxe.pro while
 * robots.txt and sitemap.xml advertised salon-pro.com.
 */

import siteConfig from "../../site.config.json";

const envOrigin = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
const configuredOrigin = (siteConfig.siteUrl || "").trim();

/** Origin without a trailing slash. */
export const SITE_URL = (envOrigin || configuredOrigin).replace(/\/+$/, "");

export const BRAND = siteConfig.brand;
export const LOCALE = siteConfig.locale;
export const THEME = siteConfig.theme;
export const ASSETS = siteConfig.assets;
export const ROUTES = siteConfig.routes;

export const OG_IMAGE_URL = `${SITE_URL}${ASSETS.ogImage}`;
export const OG_IMAGE_ALT = `${BRAND.name} — ${BRAND.tagline}`;

/** Turn a site-relative path into an absolute canonical URL. */
export function absoluteUrl(pathname: string): string {
  if (!pathname) return `${SITE_URL}/`;
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}

/**
 * The canonical URL for the page currently being viewed.
 *
 * `/` and its legacy aliases (`/shop`, `/booking`) are the same document, so
 * they all canonicalise to the site root. `/salon/:slug` and `/book` keep
 * their own path.
 */
export function canonicalForPath(pathname: string): string {
  const clean = pathname.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  if (clean === "/" || clean === "/shop" || clean === "/booking") {
    return absoluteUrl("/");
  }
  return absoluteUrl(clean);
}

export function pageTitle(override?: string): string {
  const title = (override || "").trim() || BRAND.defaultTitle;
  if (title === BRAND.defaultTitle) return title;
  return BRAND.titleTemplate.replace("%s", title);
}
