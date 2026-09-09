// Salon Pro Service Worker
// Strategy:
// - Navigation requests: Network-first, fallback to /offline page
// - Static assets: Stale-while-revalidate
// - API GET requests: Network-first, fallback to cache
// - Always respond to message events (even if we have nothing to say)
//   to avoid "message channel closed" errors.

const CACHE_VERSION = "salon-pro-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = ["/", "/offline", "/manifest.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// Always acknowledge message events to prevent "message channel closed" errors.
// This is critical for Chrome DevTools / extensions that probe the SW.
self.addEventListener("message", (event) => {
  // If the client sent {type: "SKIP_WAITING"}, activate immediately
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // Always reply, even with an empty ack, so the channel doesn't close mid-response
  if (event.ports && event.ports[0]) {
    try {
      event.ports[0].postMessage({ type: "ACK" });
    } catch {
      // ignore
    }
  }
  // If no port, we still need to do something synchronous to keep the channel alive
  // (browsers expect either a sync return or an async response)
  if (event.waitUntil) {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET
  if (request.method !== "GET") return;

  // Skip cross-origin
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline")),
        ),
    );
    return;
  }

  // Static assets — stale-while-revalidate
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
  }
});
