import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Analytics — Plausible only, cookie-free and GDPR-friendly.
 *
 * Set VITE_PLAUSIBLE_DOMAIN to enable; without it this component does nothing.
 *
 * Microsoft Clarity used to be integrated here as well. It has been removed
 * deliberately: Clarity records session replay video, which on this site means
 * capturing every character a visitor types into the booking form — name,
 * phone number, email. Shipping that to a third party with no consent banner
 * in front of it is a GDPR exposure, and it was also the reason the Content
 * Security Policy had to carry a Clarity allowance.
 *
 * If session replay is ever genuinely needed, it must be:
 *   1. gated behind an explicit opt-in the visitor gives before the script
 *      loads (not a cookie banner they can dismiss),
 *   2. configured inside Clarity to mask form fields, and
 *   3. re-added to `connect-src` / `script-src` in netlify.toml, vercel.json
 *      and public/_headers — which the contracts test keeps in sync.
 */
type AnalyticsWindow = {
  plausible?: (...args: unknown[]) => void;
};

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;

export default function Analytics() {
  const location = useLocation();

  // Inject Plausible once. `defer` keeps it off the critical path.
  useEffect(() => {
    if (!PLAUSIBLE_DOMAIN) return;
    if (document.getElementById("plausible-script")) return;

    const script = document.createElement("script");
    script.id = "plausible-script";
    script.defer = true;
    script.dataset.domain = PLAUSIBLE_DOMAIN;
    script.src = "https://plausible.io/js/script.js";
    document.head.appendChild(script);
  }, []);

  /**
   * Track SPA page views.
   *
   * The previous version called `plausible("pageview")` from an effect keyed on
   * location.pathname. On the first render the deferred Plausible script had
   * not executed yet, so `window.plausible` was undefined, the effect returned
   * early, and — because the pathname never changed again — the very first
   * page view was never recorded at all. Polling until the global appears
   * fixes that without needing the library's manual API.
   */
  useEffect(() => {
    if (!PLAUSIBLE_DOMAIN) return undefined;

    let cancelled = false;
    const w = window as unknown as AnalyticsWindow;

    const attempt = (remaining: number) => {
      if (cancelled) return;
      if (typeof w.plausible === "function") {
        w.plausible("pageview");
        return;
      }
      if (remaining <= 0) return;
      window.setTimeout(() => attempt(remaining - 1), 250);
    };

    attempt(20);
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return null;
}

/**
 * Track a custom event.
 *
 * Usage: trackEvent("booking_started", { service: "haircut" })
 *
 * No Clarity equivalent is provided any more — see the note at the top of this
 * file for why session-replay analytics does not belong on a form like this.
 */
export function trackEvent(name: string, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnalyticsWindow;
  if (typeof w.plausible === "function") {
    w.plausible(name, { props });
  }
}
