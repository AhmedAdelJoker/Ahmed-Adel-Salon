import { useEffect, useRef } from "react";

/**
 * Polls `onTick` on a fixed interval, with the standard tab-visibility and
 * document-hidden guards so a background tab does not keep hammering the API.
 *
 * Returns nothing. Pass a stable callback (useCallback) to avoid resetting the
 * interval on every render.
 */
export function useAutoRefresh(
  onTick: () => void,
  intervalMs = 30_000,
  options: { enabled?: boolean; refreshWhenHidden?: boolean } = {},
): void {
  const { enabled = true, refreshWhenHidden = false } = options;

  // Keep the latest callback without re-creating the interval.
  const savedCallback = useRef(onTick);
  useEffect(() => {
    savedCallback.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (!refreshWhenHidden && typeof document !== "undefined" && document.hidden) {
        return;
      }
      savedCallback.current();
    };

    const id = window.setInterval(run, intervalMs);

    // Refresh as soon as the tab becomes visible again (after being hidden).
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled, refreshWhenHidden]);
}