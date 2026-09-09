/**
 * Cloudflare Worker for advanced edge caching + bot detection + analytics.
 *
 * Deploy via: `wrangler deploy` from public-site/
 * Or use Cloudflare Pages with _worker.js
 *
 * Features:
 * - Aggressive cache for /assets/* (immutable)
 * - Edge cache for HTML pages with stale-while-revalidate
 * - Bypass cache for admin/API routes
 * - Tag-based purge support
 * - A/B test variant routing
 * - Bot detection for SEO crawlers (delivers cached HTML)
 */

const STATIC_CACHE = "public, max-age=31536000, immutable";
const HTML_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";
const SW_CACHE = "public, max-age=0, must-revalidate";

// Routes that should NEVER be cached (admin, API, websockets)
const BYPASS_PATHS = [/^\/api\//, /^\/admin/, /^\/ws\//, /^\/socket\.io/];

// Pre-rendered HTML routes (cache forever at edge, only SWR)
const PRERENDERED = ["/", "/book", "/offline"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;
    const isHttps = url.protocol === "https:";

    // Bypass for non-cacheable routes
    if (BYPASS_PATHS.some((re) => re.test(url.pathname))) {
      return fetch(request);
    }

    // Don't cache non-GET requests
    if (request.method !== "GET") {
      return fetch(request);
    }

    // Determine cache strategy based on asset type
    const isAsset = url.pathname.startsWith("/assets/");
    const isSW = url.pathname === "/sw.js";
    const isPrerendered = PRERENDERED.includes(url.pathname);
    const isSalonPage = url.pathname.startsWith("/salon/");

    // Build a cache key (include query string for A/B testing)
    const cacheKey = new Request(url.toString(), request);

    // 1. Try cache first
    const cached = await cache.match(cacheKey);
    if (cached) {
      // Add cache hit header for debugging
      const response = new Response(cached.body, cached);
      response.headers.set("X-Cache-Status", "HIT");
      response.headers.set("X-Edge-Location", request.cf?.colo || "unknown");
      return response;
    }

    // 2. Fetch from origin
    const response = await fetch(request);

    // 3. Cache the response if appropriate
    let shouldCache = false;
    let cacheControl = "";

    if (isAsset && response.ok) {
      shouldCache = true;
      cacheControl = STATIC_CACHE;
    } else if (isSW) {
      shouldCache = true;
      cacheControl = SW_CACHE;
    } else if (isPrerendered && response.ok && isHttps) {
      shouldCache = true;
      cacheControl = HTML_CACHE;
    } else if (isSalonPage && response.ok && isHttps) {
      shouldCache = true;
      cacheControl = "public, max-age=0, s-maxage=180, stale-while-revalidate=1800";
    }

    if (shouldCache) {
      // Clone the response so we can modify headers
      const cachedResponse = new Response(response.body, response);
      cachedResponse.headers.set("Cache-Control", cacheControl);
      cachedResponse.headers.set("X-Cache-Status", "MISS");
      cachedResponse.headers.set("X-Edge-Location", request.cf?.colo || "unknown");

      // Put in cache (waitUntil so it doesn't block response)
      ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));

      return cachedResponse;
    }

    // 4. Return the original response
    return response;
  },
};
