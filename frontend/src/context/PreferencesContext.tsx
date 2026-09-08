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
  }));
  const [loading, setLoading] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    return !storedTheme; // Only load if we don't have basic theme info
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const darkMode = preferences.theme === "dark";

  function setPreferences(next: PreferencesUpdate): void {
    setPreferencesState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const merged = normalizePreferences({ ...prev, ...value });
      applyTheme(merged.theme);
      return merged;
    });
  }

  async function loadPreferences() {
    const token = localStorage.getItem("token");
    if (!token || !isAuthenticated) {
      const localPreferences = {
        ...DEFAULT_PREFERENCES,
        theme: getStoredTheme(),
      };
      setPreferencesState(localPreferences);
      applyTheme(localPreferences.theme);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get("/preferences");
      const nextPreferences = normalizePreferences(response.data || {});
      setPreferencesState(nextPreferences);
      applyTheme(nextPreferences.theme);
    } catch (err) {
      console.error("Load preferences error:", err);
      const apiErr = err as ApiErrorShape;
      const localPreferences = {
        ...DEFAULT_PREFERENCES,
        theme: getStoredTheme(),
      };
      setPreferencesState(localPreferences);
      applyTheme(localPreferences.theme);
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
    const nextPreferences: Preferences = { ...preferences, language: nextLanguage };
    setPreferences(nextPreferences);
    return updatePreferences(nextPreferences);
  }

  async function toggleLanguage() {
    return setLanguage(preferences.language === "ar" ? "en" : "ar");
  }

  useEffect(() => {
    if (!socket) return;

    applyTheme(preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    if (authLoading) return;
    loadPreferences();
     
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
