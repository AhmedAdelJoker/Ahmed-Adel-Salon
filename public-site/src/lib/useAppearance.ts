import { useCallback, useEffect, useState } from "react";

import type { Appearance } from "./theme";

/**
 * The visitor's appearance preference.
 *
 * ## Why this is a hook and not `localStorage` at the point of use
 *
 * `ThemeToggle` and the two pages both need it, and they were both reading
 * storage independently. When the toggle changed the value nothing told the
 * page, so the page kept rendering the palette it had resolved at mount — the
 * control moved and nothing else did.
 *
 * This holds the preference in React state and re-broadcasts it, so
 * `resolveTheme()` is re-run on both the toggle and the page.
 */

const STORAGE_KEY = "theme";

export const APPEARANCE_EVENT = "salon:appearance";

function isAppearance(value: unknown): value is Appearance {
  return value === "light" || value === "dark" || value === "system";
}

function readStored(): Appearance {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isAppearance(stored) ? stored : "system";
  } catch {
    // Safari private mode throws on access.
    return "system";
  }
}

export function useAppearance(): [Appearance, (next: Appearance) => void] {
  const [appearance, setAppearance] = useState<Appearance>(readStored);

  /** Keep every subscriber in step when the toggle changes the value. */
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<Appearance>).detail;
      if (isAppearance(next)) setAppearance(next);
    };
    window.addEventListener(APPEARANCE_EVENT, sync);
    return () => window.removeEventListener(APPEARANCE_EVENT, sync);
  }, []);

  const update = useCallback((next: Appearance) => {
    setAppearance(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* a full or blocked store must not break the page */
    }
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_EVENT, { detail: next }),
    );
  }, []);

  return [appearance, update];
}
