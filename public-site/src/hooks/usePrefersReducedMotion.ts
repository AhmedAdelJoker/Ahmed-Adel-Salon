import { useEffect, useState } from "react";

/**
 * Tracks `prefers-reduced-motion: reduce`.
 *
 * Returns `false` during server rendering and on the first client render so
 * markup is identical on both sides, then updates after mount. Anything that
 * would otherwise animate with JavaScript — parallax, confetti, blur
 * transitions — should gate on this rather than on a media query alone,
 * because a CSS reset cannot stop a JS-driven animation loop.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}
