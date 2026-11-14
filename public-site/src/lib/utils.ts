import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * `clsx` is handed the array as a single argument rather than spread; it
 * flattens arrays internally, so the result is identical and it avoids the
 * argument-count ceiling on components with many conditional classes.
 */
export function cn(...inputs: unknown[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Map the salon's display currency to its ISO 4217 code.
 *
 * `settings.currency` is what a visitor reads on the page — "ج.م", "ر.س", "$".
 * Structured data wants the other thing: `priceCurrency` has to be a three-letter
 * code, and publishing the display string there is a validation error that gets
 * the price dropped rather than merely formatted oddly.
 *
 * An unknown value returns `undefined` so the caller omits the field, rather than
 * defaulting to "EGP" and billing a dirham salon in pounds in its own markup.
 */
const CURRENCY_CODES: Record<string, string> = {
  "ج.م": "EGP",
  "د.ج": "EGP",
  EGP: "EGP",
  "ر.س": "SAR",
  SAR: "SAR",
  "د.إ": "AED",
  AED: "AED",
  "د.ك": "KWD",
  KWD: "KWD",
  "ر.ق": "QAR",
  QAR: "QAR",
  "د.ب": "BHD",
  BHD: "BHD",
  "ر.ع": "OMR",
  OMR: "OMR",
  "د.ت": "TND",
  TND: "TND",
  "£": "GBP",
  GBP: "GBP",
  "$": "USD",
  USD: "USD",
  "€": "EUR",
  EUR: "EUR",
};

export function toCurrencyCode(
  currency: string | null | undefined,
): string | undefined {
  if (!currency) return undefined;
  const trimmed = currency.trim();
  if (!trimmed) return undefined;
  return CURRENCY_CODES[trimmed] ?? CURRENCY_CODES[trimmed.toUpperCase()];
}

/**
 * Reduce an API failure to one human-readable line.
 *
 * Handles FastAPI/Pydantic validation errors, which arrive as an array of
 * `{loc, msg, type}` objects. Returning the raw object is not an option: React
 * throws when it tries to render one, which would blank the page instead of
 * showing the visitor a message.
 */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  const responseData = (error as { response?: { data?: Record<string, unknown> } }).response?.data;
  const detail = responseData?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const record = item as { msg?: unknown; message?: unknown };
        return String(record.msg ?? record.message ?? "");
      })
      .filter(Boolean)
      .join(" | ");
  }

  if (detail && typeof detail === "object") {
    const record = detail as { msg?: unknown; message?: unknown };
    const message = record.msg ?? record.message;
    if (typeof message === "string") return message;
  }

  if (typeof detail === "string" && detail.length > 0) return detail;

  const message = responseData?.message ?? (error as { message?: unknown }).message;
  if (typeof message === "string" && message.length > 0) return message;

  return fallback;
}

/**
 * Format a monetary value with the salon currency label.
 * Mirrors the frontend implementation so the public booking summary
 * renders the same "250.00 ج.م" shape everywhere.
 */
export function formatCurrency(value: unknown, currencyLabel = "ج.م"): string {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safe));
  const sign = safe < 0 ? "-" : "";
  return `${sign}${formatted} ${currencyLabel}`;
}

/**
 * Formats a time string (HH:MM or HH:MM:SS) to 12-hour format with ص/م.
 * Used by the public booking slot picker.
 */
export function formatTime12h(timeStr: string | null | undefined): string {
  if (!timeStr) return "";

  const [h, m] = String(timeStr).split(":");
  const hours = parseInt(h, 10);
  const minutes = m ? m.split(/\D/)[0] : "00";

  if (Number.isNaN(hours)) return String(timeStr);

  const ampm = hours >= 12 ? "م" : "ص";
  const h12 = hours % 12 || 12;

  return `${h12}:${String(minutes).padStart(2, "0")} ${ampm}`;
}
