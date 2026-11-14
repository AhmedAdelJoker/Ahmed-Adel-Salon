import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import { useI18n, type LocaleCode } from "./I18nContext";

/**
 * CurrencyContext — currency *display* preferences for the public site.
 *
 * Exchange rates are supplied by the deployment, never invented here. The
 * previous version shipped hard-coded rates (EGP→USD "0.020", EUR "0.018",
 * AED "0.073") with a "could be wired to API rates in the future" comment.
 * Those numbers were made up, went stale the day they were written, and
 * `formatPrice` would have displayed confidently wrong converted prices to
 * visitors.
 *
 * Provide real rates at build time, e.g.
 *   VITE_CURRENCY_RATES={"USD":0.0209,"EUR":0.0192}
 * Without that variable every rate is 1 and amounts are shown unchanged in
 * the target currency's locale — no invented arithmetic.
 */

const STORAGE_KEY = "salon-currency";

/**
 * Currency names carry both languages. The switcher renders them directly, so
 * an Arabic-only label meant an English visitor saw "الجنيه المصري" in an
 * otherwise English dropdown. Symbols are locale-neutral and stay single.
 */
const CURRENCIES = {
  EGP: { code: "EGP", symbol: "ج.م", locale: "ar-EG", ar: "الجنيه المصري", en: "Egyptian Pound" },
  USD: { code: "USD", symbol: "$", locale: "en-US", ar: "دولار أمريكي", en: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", locale: "de-DE", ar: "يورو", en: "Euro" },
  SAR: { code: "SAR", symbol: "ر.س", locale: "ar-SA", ar: "ريال سعودي", en: "Saudi Riyal" },
  AED: { code: "AED", symbol: "د.إ", locale: "ar-AE", ar: "درهم إماراتي", en: "UAE Dirham" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export interface CurrencyInfo {
  code: string;
  symbol: string;
  locale: string;
  ar: string;
  en: string;
}

export interface FormatPriceOptions {
  showSymbol?: boolean;
  maximumFractionDigits?: number;
}

export interface CurrencyContextValue {
  currency: string;
  setCurrency: (code: string) => void;
  formatPrice: (amountInBase: number | string | null | undefined, options?: FormatPriceOptions) => string;
  convert: (amountInBase: number | string | null | undefined) => number;
  /** True only when the deployment actually supplied conversion rates. */
  hasRates: boolean;
  baseCurrency: string;
  availableCurrencies: CurrencyInfo[];
  /** Active UI locale, so the switcher can label currencies in it. */
  locale: LocaleCode;
  symbol: string | undefined;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readConfiguredRates(): Partial<Record<CurrencyCode, number>> {
  const raw = (import.meta.env.VITE_CURRENCY_RATES as string | undefined)?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rates: Partial<Record<CurrencyCode, number>> = {};
    for (const [code, value] of Object.entries(parsed)) {
      const numeric = Number(value);
      if (code in CURRENCIES && Number.isFinite(numeric) && numeric > 0) {
        rates[code as CurrencyCode] = numeric;
      }
    }
    return rates;
  } catch {
    // A malformed value must not take the page down; fall back to no rates.
    return {};
  }
}

function detectInitialCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "EGP";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in CURRENCIES) return stored as CurrencyCode;
  } catch {
    // ignore
  }
  return "EGP";
}

export function CurrencyProvider({
  children,
  defaultCurrency,
  baseCurrency = "EGP",
}: {
  children: ReactNode;
  defaultCurrency?: string;
  baseCurrency?: string;
}) {
  const { locale } = useI18n();
  const [currency, setCurrencyState] = useState<CurrencyCode>(
    () => (defaultCurrency as CurrencyCode) || detectInitialCurrency(),
  );
  const rates = useMemo(readConfiguredRates, []);

  const setCurrency = useCallback((code: string) => {
    if (!(code in CURRENCIES)) return;
    setCurrencyState(code as CurrencyCode);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }, []);

  const convert = useCallback(
    (amountInBase: number | string | null | undefined) => {
      const amount = Number(amountInBase);
      if (amountInBase == null || !Number.isFinite(amount)) return 0;
      const from = rates[baseCurrency as CurrencyCode] ?? 1;
      const to = rates[currency] ?? 1;
      return amount * (to / from);
    },
    [currency, baseCurrency, rates],
  );

  const formatPrice = useCallback(
    (amountInBase: number | string | null | undefined, options: FormatPriceOptions = {}) => {
      const { showSymbol = true, maximumFractionDigits = 0 } = options;
      const converted = convert(amountInBase);
      const cfg = CURRENCIES[currency];
      try {
        const formatted = new Intl.NumberFormat(cfg.locale, {
          maximumFractionDigits,
          minimumFractionDigits: 0,
        }).format(Math.round(converted));
        return showSymbol ? `${formatted} ${cfg.symbol}` : formatted;
      } catch {
        return `${Math.round(converted)} ${cfg.symbol}`;
      }
    },
    [currency, convert],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      formatPrice,
      convert,
      hasRates: Object.keys(rates).length > 0,
      baseCurrency,
      availableCurrencies: Object.values(CURRENCIES) as CurrencyInfo[],
      locale,
      symbol: CURRENCIES[currency]?.symbol,
    }),
    [currency, setCurrency, formatPrice, convert, baseCurrency, rates, locale],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}

export default CurrencyContext;
