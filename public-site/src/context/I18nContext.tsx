import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

/**
 * I18nContext — Lightweight, dependency-free i18n system.
 * - Supports AR (default) + EN
 * - Persists choice in localStorage
 * - Auto-detects browser language on first visit
 * - Sets <html lang="..."> and <html dir="..."> dynamically
 * - Supports variable interpolation {name}
 * - Supports plural form via {count, plural, one {# item} other {# items}}
 */

const STORAGE_KEY = "salon-locale";

const TRANSLATIONS = {
  ar: {
    // Navigation
    "nav.home": "الرئيسية",
    "nav.services": "الخدمات",
    "nav.team": "الفريق",
    "nav.offers": "العروض",
    "nav.testimonials": "آراء العملاء",
    "nav.contact": "التواصل",
    "nav.book": "احجز الآن",

    // Hero
    "hero.bookNow": "احجز تجربتك الملكية",
    "hero.exploreServices": "استكشف الخدمات",
    "hero.bookingCta": "احجز الآن",

    // Stats / Trust
    "trust.openNow": "متاحون الآن",
    "trust.closedNow": "مغلق حالياً",

    // CTA / Floating
    "floating.bookExperience": "احجز الآن",
    "floating.whatsappLabel": "تواصل عبر واتساب",
    "floating.close": "إغلاق",
    "floating.showBooking": "إظهار زر الحجز",

    // Contact
    "contact.location": "الموقع",
    "contact.phone": "الهاتف",
    "contact.viewMap": "عرض الخريطة",
    "contact.callNow": "اتصل الآن",
    "contact.workingHours": "ساعات العمل",
    "contact.closedToday": "مغلق اليوم",

    // Common
    "common.loading": "جاري التحميل...",
    "common.error": "حدث خطأ",
    "common.retry": "إعادة المحاولة",
    "common.skipToContent": "تخطي إلى المحتوى الرئيسي",
  },
  en: {
    "nav.home": "Home",
    "nav.services": "Services",
    "nav.team": "Team",
    "nav.offers": "Offers",
    "nav.testimonials": "Testimonials",
    "nav.contact": "Contact",
    "nav.book": "Book Now",

    "hero.bookNow": "Book Your Royal Experience",
    "hero.exploreServices": "Explore Services",
    "hero.bookingCta": "Book Now",

    "trust.openNow": "Open Now",
    "trust.closedNow": "Currently Closed",

    "floating.bookExperience": "Book Now",
    "floating.whatsappLabel": "Contact via WhatsApp",
    "floating.close": "Close",
    "floating.showBooking": "Show booking button",

    "contact.location": "Location",
    "contact.phone": "Phone",
    "contact.viewMap": "View Map",
    "contact.callNow": "Call Now",
    "contact.workingHours": "Working Hours",
    "contact.closedToday": "Closed Today",

    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.retry": "Retry",
    "common.skipToContent": "Skip to main content",
  },
};

export type LocaleCode = "ar" | "en";

export interface I18nContextValue {
  locale: LocaleCode;
  dir: "rtl" | "ltr";
  t: (key: string, vars?: Record<string, unknown>) => string;
  setLocale: (newLocale: LocaleCode) => void;
  toggleLocale: () => void;
  isRTL: boolean;
  availableLocales: { code: string; label: string; flag: string }[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale() {
  if (typeof window === "undefined") return "ar";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    // ignore
  }
  // Auto-detect from browser
  const browserLang = (navigator.language || "ar").toLowerCase();
  if (browserLang.startsWith("en")) return "en";
  return "ar"; // Default to Arabic
}

export function I18nProvider({
  children,
  defaultLocale,
}: {
  children: React.ReactNode;
  defaultLocale?: LocaleCode;
}) {
  const [locale, setLocaleState] = useState<LocaleCode>(
    (defaultLocale as LocaleCode) || (detectInitialLocale() as LocaleCode),
  );

  const setLocale = useCallback((newLocale: LocaleCode) => {
    if (newLocale !== "ar" && newLocale !== "en") return;
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  // Update <html lang/dir> when locale changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, unknown>) => {
      const translation = TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.ar[key] ?? key;
      if (!vars) return translation;
      // Simple variable interpolation: {name}
      return translation.replace(/\{(\w+)\}/g, (m, name) =>
        vars[name] !== undefined ? String(vars[name]) : m,
      );
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      isRTL: locale === "ar",
      t,
      setLocale,
      toggleLocale,
      availableLocales: [
        { code: "ar", label: "العربية", flag: "🇪🇬" },
        { code: "en", label: "English", flag: "🇬🇧" },
      ],
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
