// Salon Pro service worker.
//
// Strategy:
// - Navigations: network-first, falling back to the cached copy and then to
//   the pre-rendered /offline document.
// - Static assets (hashed): cache-first with a background refresh.
// - Everything else: straight to the network.
//
// Two bugs this file previously had and no longer does:
//  1. Navigation responses were cached without checking `response.ok`, so a
//     502 or 504 HTML error page could be stored and then served to every
//     later visitor while offline.
//  2. On an asset miss with no cached copy, the fetch handler's promise
//     resolved to `undefined`. `respondWith(undefined)` rejects, which surfaced
//     as an opaque network error instead of a clean failure.

const CACHE_VERSION = "salon-pro-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

/** Keep the runtime cache bounded so a long session cannot grow without limit. */
const MAX_RUNTIME_ENTRIES = 60;

const OFFLINE_URL = "/offline";
const PRECACHE_URLS = ["/", OFFLINE_URL, "/manifest.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => console.warn("[sw] precache incomplete:", error)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Answer every probe so DevTools and extensions never see a dead channel. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.ports && event.ports[0]) {
    try {
      event.ports[0].postMessage({ type: "ACK" });
    } catch {
      // The channel is already gone; nothing to recover.
    }
  }
});

/** Trim the oldest entries once the runtime cache exceeds its budget. */
async function trimCache(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= MAX_RUNTIME_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache range requests: a partial 206 body is not a reusable asset.
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // Only a real success is worth remembering.
          if (response && response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response(
            "<!doctype html><meta charset=\"utf-8\"><title>Offline</title><p>You are offline.</p>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  const destination = request.destination;
  const isStatic =
    destination === "style" ||
    destination === "script" ||
    destination === "image" ||
    destination === "font";

  if (!isStatic) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then(async (response) => {
          // Opaque and error responses must not enter the cache.
          if (response && response.ok && response.type !== "opaque") {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
            trimCache(RUNTIME_CACHE).catch(() => undefined);
          }
          return response;
        })
        .catch(() => undefined);

      if (cached) {
        // Revalidate in the background; the visitor gets the cached copy now.
        network.catch(() => undefined);
        return cached;
      }

      const response = await network;
      if (response) return response;

      return new Response("", {
        status: 504,
        statusText: "Gateway Timeout",
      });
    })(),
  );
});
