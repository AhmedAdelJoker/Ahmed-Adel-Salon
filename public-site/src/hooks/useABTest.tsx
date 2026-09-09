import { useEffect, useState, useMemo, useCallback } from "react";

/**
 * useABTest — Lightweight A/B testing hook.
 * - Persists variant assignment in a cookie (1 year)
 * - Deterministic based on user ID (if provided) or random
 * - Tracks exposure via trackEvent helper
 * - SSR-safe (no window access during render)
 *
 * Usage:
 *   const { variant, track } = useABTest("hero_title", ["A", "B", "C"]);
 *   if (variant === "A") return <TitleA />;
 */

const COOKIE_NAME = "salon-ab";
const COOKIE_DURATION_DAYS = 365;

function setCookie(name, value, days) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value};expires=${expires};path=/;SameSite=Lax`;
}

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;)\\s*${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function getVariantBucket(userId, experimentKey, variantCount) {
  // Deterministic hash: if userId provided, always same variant
  // Otherwise: pseudo-random based on timestamp + Math.random
  if (userId) {
    let hash = 0;
    const str = `${userId}:${experimentKey}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % variantCount;
  }
  return Math.floor(Math.random() * variantCount);
}

declare global {
  interface Window {
    plausible?: (...args: unknown[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer?: any[];
  }
}

export interface ABTestOptions {
  userId?: string | number;
  forceVariant?: string;
  config?: Record<string, unknown>;
}

export function useABTest(experimentKey: string, variants: string[] = ["A", "B"], options: ABTestOptions = {}) {
  const { userId, forceVariant, config = {} } = options;
  void config;
  const [variant, setVariant] = useState(() => {
    // SSR-safe: default to first variant during SSR
    if (typeof window === "undefined") return variants[0];
    if (forceVariant) return forceVariant;

    // Check if user already has this experiment assigned
    const cookieValue = getCookie(COOKIE_NAME);
    if (cookieValue) {
      try {
        const stored = JSON.parse(cookieValue);
        if (stored[experimentKey]) {
          return stored[experimentKey];
        }
      } catch {
        // ignore parse error
      }
    }

    // Assign new variant
    const idx = getVariantBucket(userId, experimentKey, variants.length);
    const chosen = variants[idx];

    // Persist
    let updated = {};
    if (cookieValue) {
      try {
        updated = JSON.parse(cookieValue);
      } catch {
        // ignore
      }
    }
    updated[experimentKey] = chosen;
    setCookie(COOKIE_NAME, JSON.stringify(updated), COOKIE_DURATION_DAYS);

    return chosen;
  });

  // Track exposure on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (forceVariant) return; // Don't track forced variants (e.g. preview)

    // Track via Plausible if available
    if (typeof window.plausible === "function") {
      window.plausible("experiment_exposure", {
        props: { experiment: experimentKey, variant },
      });
    }

    // Track in dataLayer for GTM
    if (typeof window.dataLayer !== "undefined") {
      window.dataLayer.push({
        event: "experiment_exposure",
        experiment: experimentKey,
        variant,
      });
    }

    // Also log to console for debugging (dev only, stripped from production build)
    if (import.meta.env.DEV) {
      console.debug(`[AB Test] ${experimentKey} → ${variant}`);
    }
  }, [experimentKey, variant, forceVariant]);

  // Track conversion (call from event handlers)
  const track = useCallback(
    (eventName: string, props: Record<string, unknown> = {}) => {
      if (typeof window === "undefined") return;
      const payload = { experiment: experimentKey, variant, ...props };

      if (typeof window.plausible === "function") {
        window.plausible(eventName, { props: payload });
      }
      if (typeof window.dataLayer !== "undefined") {
        window.dataLayer.push({ event: eventName, ...payload });
      }
      if (import.meta.env.DEV) {
        console.log(`[AB Track] ${eventName}:`, payload);
      }
    },
    [experimentKey, variant],
  );

  // Check if current variant matches
  const isVariant = useCallback((name: string) => variant === name, [variant]);

  return useMemo(
    () => ({ variant, track, isVariant, variants }),
    [variant, track, isVariant, variants],
  );
}

/**
 * Get current variant without React (for analytics utilities).
 */
export function getStoredVariant(experimentKey: string): string | null {
  if (typeof document === "undefined") return null;
  const cookieValue = getCookie(COOKIE_NAME);
  if (!cookieValue) return null;
  try {
    return JSON.parse(cookieValue)[experimentKey] || null;
  } catch {
    return null;
  }
}

export default useABTest;
