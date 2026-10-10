/*
 * Service worker.
 *
 * Strategy per resource:
 *   - navigations (HTML): network-first, cache only as an offline fallback.
 *     A cache-first HTML would pin the app to an old build forever and, once
 *     the hashed assets it references are evicted, every reload would render
 *     an empty page.
 *   - hashed build assets: cache-first (immutable by construction).
 *   - /api/*: never cached, never intercepted beyond a graceful offline body.
 *
 * The cache name is derived from the build so a new deploy invalidates the old
 * cache automatically instead of serving stale HTML.
 */

const BUILD_ID = __BUILD_ID__ || "dev";
const CACHE_NAME = `salonpro-${BUILD_ID}`;
const OFFLINE_URL = "/index.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function cachePut(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch {
    /* quota exceeded or opaque response — ignore */
  }
}

async function networkFirstDocument(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === "basic") {
      await cachePut(request, response.clone());
    }
    return response;
  } catch {
    // Offline: fall back to the cached shell, never to `null`.
    const cached = (await cache.match(request)) || (await cache.match(OFFLINE_URL));
    return (
      cached ||
      new Response("<h1>Offline</h1>", {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200 && response.type === "basic") {
    await cachePut(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;

  // API traffic: always live, with a JSON 503 instead of a thrown TypeError.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ detail: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }

  // HTML shell: network-first so a deploy is picked up on the next reload.
  if (request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // Everything else: serve from cache, fall back to the network.
  event.respondWith(
    cacheFirstAsset(request).catch(
      () =>
        new Response("", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }),
    ),
  );
});