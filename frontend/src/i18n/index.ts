import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import arCommon from "@/i18n/locales/ar/common.json";
import enCommon from "@/i18n/locales/en/common.json";
import arAppearance from "@/i18n/locales/ar/appearance.json";
import enAppearance from "@/i18n/locales/en/appearance.json";

/**
 * Translation namespaces.
 *
 * A single flat `common` namespace is what the app had for its whole life: 38
 * keys, consumed by one component, while every other screen hardcoded Arabic
 * literals. Namespaces are how a locale stops being a per-page liability —
 * each domain owns its own file, and the parity test in
 * `src/test/i18n.test.ts` fails the build if a locale drifts out of sync.
 */
export const NAMESPACES = ["common", "appearance"] as const;
export type Namespace = (typeof NAMESPACES)[number];

/**
 * Languages the UI is actually written in.
 *
 * `supportedLngs` matters beyond i18next's own filtering: it makes i18next
 * resolve a browser request for `en-GB` down to `en` instead of treating it as
 * an unknown locale and falling all the way back to the default.
 */
export const SUPPORTED_LANGUAGES = ["ar", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "ar";

/** Maps an arbitrary BCP-47 tag onto a language this app ships. */
export function resolveLanguageTag(tag: string | undefined | null): SupportedLanguage {
  const base = (tag ?? "").split("-")[0].toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

/**
 * The device's stored language, or null when the user has never chosen.
 *
 * Null is meaningful: it lets PreferencesContext tell "never configured this
 * browser" apart from "chose Arabic", which is what stops the server profile
 * from reverting a deliberate switch on every load.
 */
function storedLanguage(): string | null {
  try {
    const raw = window.localStorage.getItem("language");
    return raw && (SUPPORTED_LANGUAGES as readonly string[]).includes(raw) ? raw : null;
  } catch {
    return null;
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { common: arCommon, appearance: arAppearance },
      en: { common: enCommon, appearance: enAppearance },
    },
    ns: [...NAMESPACES],
    defaultNS: "common",

    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    load: "currentOnly",

    /**
     * An explicit stored choice always wins.
     *
     * `order` matters: the detector consults the lookup list left to right, so
     * putting `localStorage` first is what makes `detection.order` a fallback
     * rather than a competitor. Without it the browser's `Accept-Language`
     * could win over a language the user deliberately picked, and a guest
     * landing on an English OS would be forced out of the English UI.
     */
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "language",
      caches: ["localStorage"],
    },

    interpolation: {
      escapeValue: false,
    },
  });

/**
 * Keeps `<html dir>` and `<html lang>` in step with the active language.
 *
 * The layout shell is direction-aware — the sidebar, the header and every
 * migrated component use logical properties — so the document direction is
 * load-bearing rather than cosmetic. It has to be correct before the first
 * paint, which is why index.html's bootstrap block also writes `dir`/`lang`
 * from the same localStorage key.
 */
export function applyDocumentDirection(lng?: string): "rtl" | "ltr" {
  const lang = resolveLanguageTag(lng ?? i18n.language ?? storedLanguage() ?? DEFAULT_LANGUAGE);
  const dir = lang === "ar" ? "rtl" : "ltr";

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("dir", dir);
    root.setAttribute("lang", lang);
  }

  return dir;
}

applyDocumentDirection();
i18n.on("languageChanged", (lng) => applyDocumentDirection(lng));

export default i18n;
