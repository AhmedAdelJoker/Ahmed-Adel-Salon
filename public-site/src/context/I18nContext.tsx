import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_META,
  LOCALES,
  formatNumber,
  formatPrice,
  formatTime12h,
  isRTL,
  translate,
  type LocaleCode,
} from "../lib/i18n";

export type { LocaleCode };
export { LOCALES, LOCALE_META };

/**
 * I18nContext — thin React binding over lib/i18n.
 *
 * All copy lives in the catalogue; this file only owns *state*: which locale is
 * active, where it is persisted, and keeping `<html lang>`/`<html dir>` in sync.
 *
 * The previous version embedded its own 38-key dictionary here, and no page
 * ever called `useI18n().t` — the language switcher changed `dir` from rtl to
 * ltr while every string on the page stayed Arabic, so an English visitor got a
 * mirrored, half-broken Arabic layout. The dictionary now lives in one file
 * that a test can compare key-by-key, and the pages actually consume it.
 */

const STORAGE_KEY = "salon-locale";

export interface I18nContextValue {
  locale: LocaleCode;
  dir: "rtl" | "ltr";
  isRTL: boolean;
  t: (key: string, vars?: Record<string, unknown>) => string;
  setLocale: (locale: LocaleCode) => void;
  toggleLocale: () => void;
  number: (value: number | string | null | undefined) => string;
  price: (value: number | string | null | undefined) => string;
  time12: (value: string | null | undefined) => string;
  availableLocales: (typeof LOCALE_META)[LocaleCode][];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): LocaleCode {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    // ignore
  }
  // Arabic is the product's primary language, so an unrecognised browser
  // language falls back to it rather than to the browser's setting.
  return DEFAULT_LOCALE;
}

export function I18nProvider({
  children,
  defaultLocale,
}: {
  children: React.ReactNode;
  defaultLocale?: LocaleCode;
}) {
  const [locale, setLocaleState] = useState<LocaleCode>(
    () => defaultLocale ?? detectInitialLocale(),
  );

  const setLocale = useCallback((next: LocaleCode) => {
    if (next !== "ar" && next !== "en") return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  /**
   * `<html lang>` and `<html dir>` are the single source of truth for
   * direction. No page sets `dir` itself any more — that is what previously
   * produced a hardcoded rtl container inside an ltr document.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRTL(locale) ? "rtl" : "ltr";
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, unknown>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: isRTL(locale) ? "rtl" : "ltr",
      isRTL: isRTL(locale),
      t,
      setLocale,
      toggleLocale,
      number: (v) => formatNumber(v, locale),
      price: (v) => formatPrice(v, locale),
      time12: (v) => formatTime12h(v, locale),
      availableLocales: LOCALES.map((code) => LOCALE_META[code]),
    }),
    [locale, t, setLocale, toggleLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export default I18nContext;
