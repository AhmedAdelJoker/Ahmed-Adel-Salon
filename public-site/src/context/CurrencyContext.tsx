import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";

/**
 * CurrencyContext — Multi-currency support with auto-detection.
 * - Supports EGP (default), USD, EUR, SAR, AED
 * - Persists in localStorage
 * - Auto-detects from timezone on first visit
 * - Uses Intl.NumberFormat for native formatting
 */

const STORAGE_KEY = "salon-currency";

const CURRENCIES = {
  EGP: { code: "EGP", symbol: "ج.م", locale: "ar-EG", rate: 1, label: "الجنيه المصري" },
  USD: { code: "USD", symbol: "$", locale: "en-US", rate: 0.020, label: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", locale: "de-DE", rate: 0.018, label: "Euro" },
  SAR: { code: "SAR", symbol: "ر.س", locale: "ar-SA", rate: 0.075, label: "الريال السعودي" },
  AED: { code: "AED", symbol: "د.إ", locale: "ar-AE", rate: 0.073, label: "الدرهم الإماراتي" },
};

export interface CurrencyInfo {
  code: string;
  symbol: string;
  locale: string;
  rate: number;
  label: string;
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
  baseCurrency: string;
  availableCurrencies: CurrencyInfo[];
  symbol: string | undefined;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function detectInitialCurrency() {
  if (typeof window === "undefined") return "EGP";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CURRENCIES[stored]) return stored;
  } catch {
    // ignore
  }
  // Auto-detect from timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Riyadh") || tz.includes("Saudi")) return "SAR";
    if (tz.includes("Dubai") || tz.includes("Muscat") || tz.includes("Abu_Dhabi")) return "AED";
    if (tz.startsWith("Europe/")) return "EUR";
    if (/America\/(North|South|Los_Angeles|New_York|Chicago)/.test(tz)) return "USD";
  } catch {
    // ignore
  }
  return "EGP"; // default
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
  const [currency, setCurrencyState] = useState<string>(defaultCurrency || detectInitialCurrency());

  const setCurrency = useCallback((code: string) => {
    if (!CURRENCIES[code]) return;
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }, []);

  // Set custom rates from settings if available
  const getRate = useCallback(
    (code: string) => {
      // Could be wired to API rates in the future
      return CURRENCIES[code as keyof typeof CURRENCIES]?.rate || 1;
    },
    [],
  );

  const convert = useCallback(
    (amountInBase: number | string | null | undefined) => {
      if (amountInBase == null || isNaN(Number(amountInBase))) return 0;
      const fromRate = CURRENCIES[baseCurrency]?.rate || 1;
      const toRate = CURRENCIES[currency]?.rate || 1;
      // Convert: amountInBase * (toRate / fromRate)
      return Number(amountInBase) * (toRate / fromRate);
    },
    [currency, baseCurrency],
  );

  const formatPrice = useCallback(
    (amountInBase: number | string | null | undefined, options: FormatPriceOptions = {}) => {
      const { showSymbol = true, maximumFractionDigits = 0 } = options;
      const converted = convert(amountInBase);
      const cfg = CURRENCIES[currency];
      try {
        return new Intl.NumberFormat(cfg.locale, {
          maximumFractionDigits,
          minimumFractionDigits: 0,
        }).format(Math.round(converted)) + (showSymbol ? ` ${cfg.symbol}` : "");
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
      baseCurrency,
      availableCurrencies: Object.values(CURRENCIES),
      symbol: CURRENCIES[currency]?.symbol,
    }),
    [currency, setCurrency, formatPrice, convert, baseCurrency],
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
