import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { SocketContext } from "@/context/SocketContext";
import i18n, { applyDocumentDirection } from "@/i18n";

export type ThemeName = "light" | "dark";
export type LanguageCode = "ar" | "en";

export interface Preferences {
  language: LanguageCode;
  theme: ThemeName;
  notifications_enabled: boolean;
}

export type PreferencesUpdate =
  | Partial<Preferences>
  | ((prev: Preferences) => Partial<Preferences>);

export interface PreferencesContextValue {
  preferences: Preferences;
  darkMode: boolean;
  theme: ThemeName;
  loading: boolean;
  saving: boolean;
  error: string;
  setPreferences: (next: PreferencesUpdate) => void;
  loadPreferences: () => Promise<void>;
  updatePreferences: (
    payload: Partial<Preferences>,
  ) => Promise<Preferences | null>;
  resetPreferencesToDefault: () => void;
  setTheme: (theme: ThemeName) => Promise<Preferences | null>;
  toggleTheme: () => Promise<Preferences | null>;
  setLanguage: (language: LanguageCode) => Promise<Preferences | null>;
  toggleLanguage: () => Promise<Preferences | null>;
}

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      detail?: unknown;
    };
  };
}

const DEFAULT_PREFERENCES: Preferences = {
  language: "ar",
  theme: "dark",
  notifications_enabled: true,
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES.theme;
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Reads the explicit theme this device last used, or null when the user has
 * never chosen one. `null` means "follow the system", which is distinct from
 * "chose dark" — see `resolvePreference`.
 */
function getExplicitTheme(): ThemeName | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : null;
}

/**
 * Reads the language this device last used.
 *
 * Returns `null` when the user has never chosen, which is distinct from
 * "chose Arabic". That distinction is what stops the server round-trip from
 * silently reverting a deliberate switch back to the profile default: see
 * `resolveLanguage` below.
 */
function getStoredLanguage(): LanguageCode | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("language");
  return stored === "ar" || stored === "en" ? stored : null;
}

/**
 * Reconciles a device preference with the one on the profile.
 *
 * The device value wins whenever the user has made an explicit choice on this
 * browser, because that is the newer intent — they picked it *after* the
 * profile was last written. The profile only seeds a device that has never
 * been configured, which is what makes a fresh login on a new machine adopt
 * the settings the user already chose elsewhere.
 *
 * Without this, `GET /preferences` returned the server defaults on every load
 * and overwrote the stored values, so both switches reverted on each reload:
 * the locale appeared to work for the length of the session and then snapped
 * back to `rtl`, and the theme flipped to dark regardless of the choice.
 */
function resolvePreference<T extends string>(
  serverValue: T,
  storedValue: T | null,
  allowed: readonly T[],
): T {
  return storedValue && (allowed as readonly string[]).includes(storedValue)
    ? storedValue
    : serverValue;
}

function normalizePreferences(
  data: Partial<Preferences> & Record<string, unknown> = {},
): Preferences {
  return {
    language: data.language === "en" ? "en" : "ar",
    theme: data.theme === "light" ? "light" : "dark",
    notifications_enabled:
      typeof data.notifications_enabled === "boolean"
        ? data.notifications_enabled
        : true,
  };
}

function applyTheme(theme: ThemeName): void {
  if (typeof document === "undefined") return;

  const safeTheme = theme === "light" ? "light" : "dark";
  const root = document.documentElement;

  root.setAttribute("data-theme", safeTheme);
  root.classList.toggle("dark", safeTheme === "dark");
  root.classList.toggle("light", safeTheme === "light");
  root.style.colorScheme = safeTheme;

  document.body?.setAttribute("data-theme", safeTheme);
  document.body?.classList.toggle("dark", safeTheme === "dark");
  document.body?.classList.toggle("light", safeTheme === "light");

  localStorage.setItem("theme", safeTheme);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const socket = useContext(SocketContext);

  const [preferences, setPreferencesState] = useState<Preferences>(() => ({
    ...DEFAULT_PREFERENCES,
    theme: getStoredTheme(),
    // Applied before the first paint so an English user never sees a frame of
    // RTL Arabic layout flipping to LTR once preferences resolve.
    language: getStoredLanguage() ?? DEFAULT_PREFERENCES.language,
  }));
  const [loading, setLoading] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    return !storedTheme; // Only load if we don't have basic theme info
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const darkMode = preferences.theme === "dark";

  // The document direction has to track the initial language too, not just
  // later updates: the i18n module's boot hook runs before this provider
  // mounts, and it only knows about localStorage.
  useEffect(() => {
    applyDocumentDirection(preferences.language);
  }, [preferences.language]);

  function setPreferences(next: PreferencesUpdate): void {
    setPreferencesState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const merged = normalizePreferences({ ...prev, ...value });
      applyTheme(merged.theme);
      applyDocumentDirection(merged.language);
      return merged;
    });
  }

  async function loadPreferences() {
    const token = localStorage.getItem("token");
    const storedLanguage = getStoredLanguage();
    if (!token || !isAuthenticated) {
      const localPreferences = {
        ...DEFAULT_PREFERENCES,
        theme: getStoredTheme(),
        language: storedLanguage ?? DEFAULT_PREFERENCES.language,
      };
      setPreferencesState(localPreferences);
      applyTheme(localPreferences.theme);
      applyDocumentDirection(localPreferences.language);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get("/preferences");
      const serverPreferences = normalizePreferences(response.data || {});
      const nextPreferences: Preferences = {
        ...serverPreferences,
        // A deliberate choice made in this browser outranks the profile.
        language: resolvePreference(
          serverPreferences.language,
          storedLanguage,
          ["ar", "en"],
        ) as LanguageCode,
        theme: resolvePreference(
          serverPreferences.theme,
          getExplicitTheme(),
          ["light", "dark"],
        ) as ThemeName,
      };
      // Persist the resolved values so the bootstrap block, i18next's detector
      // and the next boot all agree with the profile instead of re-deriving it.
      localStorage.setItem("language", nextPreferences.language);
      localStorage.setItem("theme", nextPreferences.theme);
      setPreferencesState(nextPreferences);
      applyTheme(nextPreferences.theme);
      applyDocumentDirection(nextPreferences.language);
    } catch (err) {
      console.error("Load preferences error:", err);
      const apiErr = err as ApiErrorShape;
      const localPreferences = {
        ...DEFAULT_PREFERENCES,
        theme: getStoredTheme(),
        language: storedLanguage ?? DEFAULT_PREFERENCES.language,
      };
      setPreferencesState(localPreferences);
      applyTheme(localPreferences.theme);
      applyDocumentDirection(localPreferences.language);
      if (apiErr?.response?.status !== 401) {
        setError("تعذر تحميل التفضيلات");
      }
    } finally {
      setLoading(false);
    }
  }

  async function updatePreferences(
    payload: Partial<Preferences>,
  ): Promise<Preferences | null> {
    const token = localStorage.getItem("token");
    if (!token || !isAuthenticated) {
      setPreferences(payload);
      return normalizePreferences({ ...preferences, ...payload });
    }

    setSaving(true);
    setError("");

    try {
      const response = await api.put("/preferences", payload);
      const nextPreferences = normalizePreferences(response.data || {});
      setPreferencesState(nextPreferences);
      applyTheme(nextPreferences.theme);
      return nextPreferences;
    } catch (err) {
      console.error("Update preferences error:", err);
      const apiErr = err as ApiErrorShape;
      setError(
        apiErr?.response?.status === 401
          ? "يجب تسجيل الدخول أولًا"
          : (apiErr?.response?.data?.detail as string) || "تعذر حفظ التفضيلات",
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  function resetPreferencesToDefault() {
    const nextPreferences = { ...DEFAULT_PREFERENCES, theme: getStoredTheme() };
    setPreferencesState(nextPreferences);
    applyTheme(nextPreferences.theme);
  }

  async function setTheme(theme: ThemeName): Promise<Preferences | null> {
    const nextTheme: ThemeName = theme === "light" ? "light" : "dark";
    const nextPreferences: Preferences = { ...preferences, theme: nextTheme };
    setPreferences(nextPreferences);
    return updatePreferences(nextPreferences);
  }

  async function toggleTheme() {
    return setTheme(preferences.theme === "light" ? "dark" : "light");
  }

  async function setLanguage(
    language: LanguageCode,
  ): Promise<Preferences | null> {
    const nextLanguage: LanguageCode = language === "en" ? "en" : "ar";
    // Apply immediately (i18next + <html> dir/lang + persisted choice) so the
    // UI actually switches even before / without the server round-trip.
    try {
      localStorage.setItem("language", nextLanguage);
    } catch {
      /* storage unavailable (private mode) — non-fatal */
    }
    applyDocumentDirection(nextLanguage);
    void i18n.changeLanguage(nextLanguage).catch(() => undefined);
    const nextPreferences: Preferences = { ...preferences, language: nextLanguage };
    setPreferences(nextPreferences);
    return updatePreferences(nextPreferences);
  }

  async function toggleLanguage() {
    return setLanguage(preferences.language === "ar" ? "en" : "ar");
  }

  // Appearance must never depend on the realtime connection. Gating this on
  // the socket meant a dropped or still-connecting websocket left the document
  // showing whatever the previous render had, which is how a user ends up
  // staring at a light dashboard after choosing dark.
  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  // Keep i18next + <html> dir/lang aligned with prefs (covers server-loaded
  // language on login / other devices).
  useEffect(() => {
    applyDocumentDirection(preferences.language);
    if ((i18n.language || "").split("-")[0] !== preferences.language) {
      void i18n.changeLanguage(preferences.language).catch(() => undefined);
    }
  }, [preferences.language]);

  useEffect(() => {
    if (authLoading) return;
    void loadPreferences();
  }, [authLoading, isAuthenticated, user?.id]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      darkMode,
      theme: preferences.theme,
      loading,
      saving,
      error,
      setPreferences,
      loadPreferences,
      updatePreferences,
      resetPreferencesToDefault,
      setTheme,
      toggleTheme,
      setLanguage,
      toggleLanguage,
    }),
    [preferences, darkMode, loading, saving, error],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
