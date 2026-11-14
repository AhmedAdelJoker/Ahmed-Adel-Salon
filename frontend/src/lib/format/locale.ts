/**
 * The `Intl` locale for each supported language.
 *
 * ## Why Arabic carries `-u-nu-latn`
 *
 * Plain `ar-EG` makes `Intl.NumberFormat` emit **Arabic-Indic** digits, so a
 * price rendered through it came out `٢٫٥٠` while a count rendered through
 * plain React came out `2`. Two numbering systems on one screen is worse than
 * either alone, and prices, times and phone numbers are transcribed digit for
 * digit by whoever reads them.
 *
 * The `-u-nu-latn` extension pins Arabic to Latin digits. Arabic is the
 * product's primary language, so this does **not** make the UI Latin — it only
 * governs numerals, which is the same decision the public site and the cashier
 * screens already made.
 */
export const LOCALE_MAP = {
  ar: {
    locale: "ar-EG-u-nu-latn",
    currency: "EGP",
    dayjsLocale: "ar",
    rtl: true,
  },
  en: { locale: "en-US", currency: "USD", dayjsLocale: "en", rtl: false },
  fr: { locale: "fr-FR", currency: "EUR", dayjsLocale: "fr", rtl: false },
  es: { locale: "es-ES", currency: "EUR", dayjsLocale: "es", rtl: false },
  tr: { locale: "tr-TR", currency: "TRY", dayjsLocale: "tr", rtl: false },
  de: { locale: "de-DE", currency: "EUR", dayjsLocale: "de", rtl: false },
  it: { locale: "it-IT", currency: "EUR", dayjsLocale: "it", rtl: false },
  pt: { locale: "pt-BR", currency: "BRL", dayjsLocale: "pt-br", rtl: false },
  ru: { locale: "ru-RU", currency: "RUB", dayjsLocale: "ru", rtl: false },
  "zh-CN": {
    locale: "zh-CN",
    currency: "CNY",
    dayjsLocale: "zh-cn",
    rtl: false,
  },
  ur: { locale: "ur-PK", currency: "PKR", dayjsLocale: "ur", rtl: true },
};

export const RTL_LANGUAGES = ["ar", "he", "fa", "ur"];

export function getLocaleConfig(lang = "ar") {
  return LOCALE_MAP[lang] || LOCALE_MAP.ar;
}

export function isRTL(lang = "ar") {
  return RTL_LANGUAGES.includes(lang);
}

export function getDayjsLocale(lang = "ar") {
  return LOCALE_MAP[lang]?.dayjsLocale || "ar";
}

export function getCurrencyCode(lang = "ar") {
  return LOCALE_MAP[lang]?.currency || "EGP";
}

export function getIntlLocale(lang = "ar") {
  return LOCALE_MAP[lang]?.locale || LOCALE_MAP.ar.locale;
}
