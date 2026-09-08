import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function safeNumber(value: unknown, fallback = 0): number {
  const number = Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : fallback;
}

// Alias used by some reports that previously defined a local asNumber.
export const asNumber = safeNumber;

export function safePositive(value: unknown): number {
  return Math.max(0, safeNumber(value, 0));
}

export function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Format a number as currency in a clean, RTL-safe way.
 *
 * We deliberately do NOT use `style: "currency"` because browsers
 * emit weird bidi markers (‏) and reorder the symbol in a way that
 * breaks visual alignment in RTL layouts. Instead we format the
 * number with `ar-EG-u-nu-latn` (Latin digits) and append a fixed
 * Arabic currency label. This guarantees:
 *   - no stray bidi characters inside the value cell
 *   - symbol is always in the SAME position relative to the number
 *   - safe to use inside flex / grid / dir="rtl" containers
 */
export function formatCurrency(
  value: unknown,
  _locale = "ar-EG-u-nu-latn",
  currencyCode = "EGP",
): string {
  const num = safeNumber(value, 0);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));
  const sign = num < 0 ? "-" : "";
  const label = currencyCode === "EGP" ? "ج.م" : currencyCode;
  return `${sign}${formatted} ${label}`;
}

export function formatNumber(
  value: unknown,
  _locale = "ar-EG-u-nu-latn",
): string {
  void _locale;
  return new Intl.NumberFormat("en-US").format(safeNumber(value, 0));
}

/**
 * Format a date string safely for display. Accepts:
 *   - ISO strings ("2026-09-01T11:43:00Z")
 *   - date-only strings ("2026-09-01")
 *   - Date objects
 * Returns a stable "DD/MM/YYYY" string with Latin digits so it
 * renders identically in RTL and LTR. Avoids the broken
 * "١٩٩٩/-٦/-١" pattern from `toLocaleDateString("ar-EG")`.
 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format a date with short month name, e.g. "01 Sep 2026".
 * Used in lists where we want a compact but readable date.
 */
export function formatDateShort(
  value: string | number | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} ${mm} ${yyyy}`;
}

/**
 * Format a date+time stamp, e.g. "01/09/2026 11:43".
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = formatDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

export function getInitials(name = ""): string {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "؟";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

interface ValidationIssue {
  msg?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Extracts a user-friendly error message from an API error response.
 * Handles Axios error objects and FastAPI/Pydantic validation errors.
 */
export function getApiErrorMessage(
   
  error: any,
  fallback = "حدث خطأ غير متوقع",
): string {
  if (!error) return fallback;

  // If error is already a string
  if (typeof error === "string") return error;

  const responseData = error.response?.data as
    | { detail?: unknown; message?: unknown }
    | undefined;
  const detail = responseData?.detail;

  // 1. Handle FastAPI/Pydantic validation errors (often an array)
  if (Array.isArray(detail)) {
    return (detail as Array<string | ValidationIssue>)
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.msg || item?.message || JSON.stringify(item);
      })
      .join(" | ");
  }

  // 2. Handle object detail
  if (detail && typeof detail === "object") {
    const obj = detail as ValidationIssue;
    return obj.msg || obj.message || JSON.stringify(detail);
  }

  // 3. Use detail if it's a string
  if (typeof detail === "string" && detail.length > 0) {
    return detail;
  }

  // 4. Handle other common error structures
  const message =
    (responseData?.message as string | undefined) ||
    error.message ||
    (typeof error === "object" ? JSON.stringify(error) : String(error));

  return message || fallback;
}

/**
 * Formats a time string (HH:MM or HH:MM:SS) to 12-hour format with AM/PM in Arabic.
 */
export function formatTime12h(timeStr: string | null | undefined): string {
  if (!timeStr) return "";

  // Extract hours and minutes
  const [h, m] = timeStr.split(":");
  const hours = parseInt(h, 10);
  const minutes = m ? m.split(/\D/)[0] : "00";

  if (Number.isNaN(hours)) return timeStr;

  const ampm = hours >= 12 ? "م" : "ص";
  const h12 = hours % 12 || 12; // the hour '0' should be '12'

  return `${h12}:${minutes.padStart(2, "0")} ${ampm}`;
}

/**
 * Parses a 12-hour format string back to 24-hour HH:MM.
 */
export function parseTime12h(time12h: string | null | undefined): string {
  if (!time12h) return "";

  const match = time12h.match(/(\d+):(\d+)\s*(ص|م)/);
  if (!match) return time12h;

  const [, h, m, ampm] = match;
  let hours = parseInt(h, 10);
  const minutes = m.padStart(2, "0");

  if (ampm === "م" && hours < 12) hours += 12;
  if (ampm === "ص" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}
