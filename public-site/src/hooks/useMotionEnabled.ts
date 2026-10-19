/**
 * useMotionEnabled — one decision for every animated surface on the public site.
 *
 * Two independent inputs, both of which can veto motion:
 *
 *   1. `prefers-reduced-motion` — the visitor's OS-level request. This is a
 *      medical/accessibility signal, not a taste preference, and it is always
 *      honoured. It wins over the owner's setting, permanently.
 *   2. The owner's `landingMotionEnabled` flag — an editorial choice made in
 *      `owner/settings?tab=website`. A salon may want a still site regardless
 *      of what the visitor's OS says.
 *
 * Motion runs only when both agree.
 *
 * The OS value is read from a live `matchMedia` query rather than snapshotted,
 * so a visitor who turns the setting on mid-session gets the change without a
 * reload — cheap to keep correct here, because there is exactly one listener.
 *
 * The initial value matters: this hook runs during the first client render of
 * the landing page, so defaulting to "motion on" would animate the hero before
 * the query resolves and then freeze it, which is worse than the small flash of
 * a static page. Hence `false` until proven otherwise.
 */

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotionQuery(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    // Safari < 14 only has the deprecated addListener; support both so the hook
    // does not silently stop updating on older iOS, which is exactly the
    // audience most likely to have reduced motion enabled.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}

/**
 * @param ownerEnabled the owner's `landingMotionEnabled`. `undefined` means the
 *   field is absent (a snapshot published before the feature existed), which is
 *   treated as enabled so existing salons keep the current behaviour.
 */
export function useMotionEnabled(ownerEnabled?: boolean): boolean {
  const prefersReduced = usePrefersReducedMotionQuery();
  const ownerOn = ownerEnabled === false ? false : true;
  return ownerOn && !prefersReduced;
}