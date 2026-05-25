import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { SocketContext } from "./SocketContext";

const DEFAULT_PREFERENCES = {
  language: "ar",
  theme: "dark",
  notifications_enabled: true,
};

const PreferencesContext = createContext(null);

function getStoredTheme() {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES.theme;
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function normalizePreferences(data = {}) {
  return {
    language: data.language === "en" ? "en" : "ar",
    theme: data.theme === "light" ? "light" : "dark",
    notifications_enabled:
      typeof data.notifications_enabled === "boolean"
        ? data.notifications_enabled
        : true,
  };
}

function applyTheme(theme) {
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

export function PreferencesProvider({ children }) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const socket = useContext(SocketContext);

  const [preferences, setPreferencesState] = useState(() => ({
    ...DEFAULT_PREFERENCES,
    theme: getStoredTheme(),
  }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const darkMode = preferences.theme === "dark";

  function setPreferences(next) {
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
      const localPreferences = {
        ...DEFAULT_PREFERENCES,
        theme: getStoredTheme(),
      };
      setPreferencesState(localPreferences);
      applyTheme(localPreferences.theme);
      if (err?.response?.status !== 401) {
        setError("تعذر تحميل التفضيلات");
      }
    } finally {
      setLoading(false);
    }
  }

  async function updatePreferences(payload) {
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
      setError(
        err?.response?.status === 401
          ? "يجب تسجيل الدخول أولًا"
          : err?.response?.data?.detail || "تعذر حفظ التفضيلات",
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

  async function setTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";
    const nextPreferences = { ...preferences, theme: nextTheme };
    setPreferences(nextPreferences);
    return updatePreferences(nextPreferences);
  }

  async function toggleTheme() {
    return setTheme(preferences.theme === "light" ? "dark" : "light");
  }

  async function setLanguage(language) {
    const nextLanguage = language === "en" ? "en" : "ar";
    const nextPreferences = { ...preferences, language: nextLanguage };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, user?.id]);

  const value = useMemo(
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
    <PreferencesContext.Provider value={value || ""}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
