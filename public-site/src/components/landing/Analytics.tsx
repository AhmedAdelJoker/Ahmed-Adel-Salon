import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Analytics — Privacy-friendly analytics integration.
 *
 * Plausible (default): GDPR-compliant, cookie-free, lightweight (<1KB)
 * Microsoft Clarity: free heatmaps + session recordings
 *
 * Set environment variables:
 * - VITE_PLAUSIBLE_DOMAIN (e.g. "salon-pro.com")
 * - VITE_CLARITY_PROJECT_ID (e.g. "abc123xyz")
 *
 * Both are no-op if env vars are missing.
 */
type AnalyticsWindow = {
  plausible?: (...args: unknown[]) => void;
  clarity?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;

export default function Analytics() {
  const location = useLocation();

  // Inject Plausible once
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

  // Inject Microsoft Clarity once
  useEffect(() => {
    if (!CLARITY_PROJECT_ID) return;
    if (document.getElementById("clarity-script")) return;

    // Clarity inline script
    const script = document.createElement("script");
    script.id = "clarity-script";
    script.innerHTML = `
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
    `;
    document.head.appendChild(script);
  }, []);

  // Track SPA page views
  useEffect(() => {
    if (!PLAUSIBLE_DOMAIN) return;
    const w = window as unknown as AnalyticsWindow;
    if (typeof w.plausible !== "function") return;
    w.plausible("pageview");
  }, [location.pathname]);

  return null;
}

/**
 * Track a custom event (call from anywhere).
 * Usage: trackEvent("booking_started", { service: "haircut" });
 */
export function trackEvent(name: string, props: Record<string, unknown> = {}) {
  if (typeof window !== "undefined") {
    const w = window as unknown as AnalyticsWindow;
    if (typeof w.plausible === "function") {
      w.plausible(name, { props });
    }
    // Custom event store for non-Plausible setups (could be wired to Clarity/Gtag)
    if (w.clarity) {
      w.clarity("set", name, JSON.stringify(props));
    }
  }
}
