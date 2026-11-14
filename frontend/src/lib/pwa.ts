/**
 * Service-worker registration.
 *
 * The worker only registers in production builds served over http(s).
 * In dev (or inside Electron's file:// origin) registration is skipped so a
 * stale worker can never shadow the dev server or the local bundle.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // A failed registration must never break the app.
      console.warn("[sw] registration failed:", error);
    });
  });
}

/** Removes every cached asset and unregisters all workers. */
export async function purgeServiceWorkerCaches(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch {
    /* best effort */
  }
}