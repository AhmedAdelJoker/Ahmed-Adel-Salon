import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getIntlLocale, isRTL } from "@/lib/format/locale";

/**
 * The `Intl` locale for the active language.
 *
 * ## Why this exists
 *
 * Formatting was done by passing the literal `"ar-EG"` at each call site:
 *
 *     new Date(v).toLocaleDateString("ar-EG", {...})
 *
 * Two problems followed from that.
 *
 * **The language switch did nothing.** An English user kept seeing Arabic
 * month names and Arabic-Indic digits, because the string was hardcoded rather
 * than read from the active locale.
 *
 * **Numerals were Arabic-Indic.** `ar-EG` formats numbers as `٢٫٥٠`, while a
 * plain number rendered through React shows `2.50`. Two numbering systems on the
 * same screen. `getIntlLocale()` pins Arabic to Latin digits via
 * `-u-nu-latn`.
 *
 * Both are fixed by routing every call through this hook, which reads the live
 * language from i18next rather than from a literal.
 */
export function useAppLocale() {
  const { i18n } = useTranslation();

  return useMemo(() => {
    const lang = i18n.resolvedLanguage || i18n.language || "ar";
    return {
      lang,
      locale: getIntlLocale(lang),
      rtl: isRTL(lang),
    };
  }, [i18n.resolvedLanguage, i18n.language]);
}

/** Shorthand for the locale string alone. */
export function useIntlLocale(): string {
  return useAppLocale().locale;
}