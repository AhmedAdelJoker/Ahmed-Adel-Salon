import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Appearance — the device-local half of theming.
 *
 * Scope split, and it is deliberate:
 *
 *   PreferencesContext  owns `theme` (light/dark) and persists it to the
 *                       user profile, because a preference that follows the
 *                       person should follow them across devices.
 *
 *   AppearanceProvider  owns accent / density / motion / contrast and keeps
 *                       them in localStorage only, because these describe the
 *                       *device*, not the person. A cashier on a 13" laptop
 *                       wants `compact`; the owner reviewing the same
 *                       dashboard on a 32" display wants `spacious`. Syncing
 *                       that would make one of them wrong on every login.
 *
 * Every value here drives an attribute on <html>, which is the only thing
 * src/styles/tokens.css reacts to. Changing the accent therefore re-themes
 * the entire app — including the ~365 components still on the v1 token names
 * — with zero component-level work.
 */

export const ACCENTS = ["indigo", "violet", "cyan", "emerald", "gold"] as const;
export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export const MOTIONS = ["reduced", "normal", "rich"] as const;

export type Accent = (typeof ACCENTS)[number];
export type Density = (typeof DENSITIES)[number];
export type Motion = (typeof MOTIONS)[number];

export interface AppearanceState {
  accent: Accent;
  density: Density;
  motion: Motion;
  /** Strengthens every line token. Independent of accent and theme. */
  highContrast: boolean;
}

export interface AppearanceContextValue extends AppearanceState {
  setAccent: (accent: Accent) => void;
  setDensity: (density: Density) => void;
  setMotion: (motion: Motion) => void;
  setHighContrast: (enabled: boolean) => void;
  reset: () => void;
  /** True when the visitor asked the OS to minimise animation. */
  prefersReducedMotion: boolean;
  /** Perceived luminance of the current canvas, 0 (black) → 1 (white). */
  canvasLuminance: number;
}

const STORAGE_KEYS = {
  accent: "accent",
  density: "density",
  motion: "motion",
  highContrast: "highContrast",
} as const;

const DEFAULTS: AppearanceState = {
  accent: "indigo",
  density: "comfortable",
  motion: "normal",
  highContrast: false,
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/** Reads one persisted value, validating it against the allowed set. */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  } catch {
    // Private browsing / storage disabled — the default is always safe.
    return fallback;
  }
}

function readStoredFlag(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked — the attribute still applies for this session */
  }
}

/**
 * Reads a resolved custom property off <html>.
 *
 * The canvas colour and the browser-chrome colour are CSS literals, because a
 * `<meta name="theme-color">` cannot resolve `var()`. Reading them back through
 * the cascade is what stops this module from becoming a third copy of the
 * palette: the values live in tokens.css, and the only thing duplicated here is
 * the *name*.
 *
 * The fallback is deliberately not a colour value. It only applies before the
 * stylesheet has loaded, where there is genuinely no colour to report, and
 * `transparent` is the truthful answer. Hardcoding a hex here would reinstate
 * exactly the third copy this function exists to prevent — and the design-token
 * guard would (correctly) fail on it.
 */
function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Relative luminance per WCAG 2.x, from a `rgb()` / `rgba()` string.
 *
 * Used to decide whether chart ink and other derived colours should go light or
 * dark on a given surface. Recomputing it from the live token is more robust
 * than branching on `theme === "dark"`, which breaks the moment a third surface
 * level (or a high-contrast override) is introduced.
 */
function luminanceOf(rgb: string): number {
  const channels = rgb.match(/[\d.]+/g);
  if (!channels || channels.length < 3) return 1;
  const [r, g, b] = channels.slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppearanceState>(() => ({
    accent: readStored(STORAGE_KEYS.accent, ACCENTS, DEFAULTS.accent),
    density: readStored(STORAGE_KEYS.density, DENSITIES, DEFAULTS.density),
    motion: readStored(STORAGE_KEYS.motion, MOTIONS, DEFAULTS.motion),
    highContrast: readStoredFlag(STORAGE_KEYS.highContrast, DEFAULTS.highContrast),
  }));

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const [canvasLuminance, setCanvasLuminance] = useState(() => 1);

  /** Recomputes everything derived from the resolved canvas colour. */
  const syncDerivedColours = useCallback(() => {
    const root = document.documentElement;
    const chrome = readToken("--chrome-color", "transparent");

    // Keep the mobile browser chrome in step with the canvas.
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", chrome);

    // `getComputedStyle` resolves the canvas to an rgb() string even though the
    // token is authored as a hex literal.
    const canvas = getComputedStyle(root).backgroundColor;
    setCanvasLuminance(luminanceOf(canvas));
  }, []);

  useEffect(() => {
    syncDerivedColours();
  }, [syncDerivedColours]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // An OS-level reduced-motion request wins over the stored preference: a user
  // who asks their OS for less animation should never be overridden by a
  // setting they chose on a different machine.
  const effectiveMotion: Motion = prefersReducedMotion ? "reduced" : state.motion;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = state.accent;
    root.dataset.density = state.density;
    root.dataset.motion = effectiveMotion;
    if (state.highContrast) {
      root.dataset.contrast = "high";
    } else {
      delete root.dataset.contrast;
    }
    // The density and contrast overrides repaint the canvas, so the derived
    // values have to be recomputed after the attributes land.
    syncDerivedColours();
  }, [state.accent, state.density, state.highContrast, effectiveMotion, syncDerivedColours]);

  // PreferencesContext owns `theme`, so this provider has to watch the document
  // rather than React state to learn that the canvas flipped.
  useEffect(() => {
    const observer = new MutationObserver(syncDerivedColours);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-contrast"],
    });
    return () => observer.disconnect();
  }, [syncDerivedColours]);

  const setAccent = useCallback((accent: Accent) => {
    writeStored(STORAGE_KEYS.accent, accent);
    setState((prev) => ({ ...prev, accent }));
  }, []);

  const setDensity = useCallback((density: Density) => {
    writeStored(STORAGE_KEYS.density, density);
    setState((prev) => ({ ...prev, density }));
  }, []);

  const setMotion = useCallback((motion: Motion) => {
    writeStored(STORAGE_KEYS.motion, motion);
    setState((prev) => ({ ...prev, motion }));
  }, []);

  const setHighContrast = useCallback((highContrast: boolean) => {
    writeStored(STORAGE_KEYS.highContrast, String(highContrast));
    setState((prev) => ({ ...prev, highContrast }));
  }, []);

  const reset = useCallback(() => {
    for (const key of Object.values(STORAGE_KEYS)) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    setState(DEFAULTS);
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      ...state,
      motion: effectiveMotion,
      setAccent,
      setDensity,
      setMotion,
      setHighContrast,
      reset,
      prefersReducedMotion,
      canvasLuminance,
    }),
    [
      state,
      effectiveMotion,
      setAccent,
      setDensity,
      setMotion,
      setHighContrast,
      reset,
      prefersReducedMotion,
      canvasLuminance,
    ],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used inside <AppearanceProvider>");
  }
  return context;
}

/** True when a `<AppearanceProvider>` is above this point in the tree. */
export function useOptionalAppearance(): AppearanceContextValue | null {
  return useContext(AppearanceContext);
}
