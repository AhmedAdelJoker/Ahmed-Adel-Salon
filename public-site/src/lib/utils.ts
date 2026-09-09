import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function safeNumber(value, fallback = 0) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

export function safePositive(value) {
  return Math.max(0, safeNumber(value, 0));
}

export function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function formatCurrency(value, locale = "ar-EG", currency = "EGP") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(safeNumber(value, 0));
}

export function formatNumber(value, locale = "ar-EG") {
  return new Intl.NumberFormat(locale).format(safeNumber(value, 0));
}

export function getInitials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "؟";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Extracts a user-friendly error message from an API error response.
 * Handles Axios error objects and FastAPI/Pydantic validation errors.
 */
export function getApiErrorMessage(error, fallback = "حدث خطأ غير متوقع") {
  if (!error) return fallback;

  // If error is already a string
  if (typeof error === "string") return error;

  const responseData = error.response?.data;
  const detail = responseData?.detail;

  // 1. Handle FastAPI/Pydantic validation errors (often an array)
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.msg || item?.message || JSON.stringify(item);
      })
      .join(" | ");
  }

  // 2. Handle object detail
  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }

  // 3. Use detail if it's a string
  if (typeof detail === "string" && detail.length > 0) {
    return detail;
  }

  // 4. Handle other common error structures
  const message =
    responseData?.message ||
    error.message ||
    (typeof error === "object" ? JSON.stringify(error) : String(error));

  return message || fallback;
}

/**
 * Formats a time string (HH:MM or HH:MM:SS) to 12-hour format with AM/PM in Arabic.
 */
export function formatTime12h(timeStr) {
  if (!timeStr) return "";
  
  // Extract hours and minutes
  const [h, m] = timeStr.split(":");
  let hours = parseInt(h, 10);
  const minutes = m ? m.split(/\D/)[0] : "00";
  
  if (isNaN(hours)) return timeStr;

  const ampm = hours >= 12 ? "م" : "ص";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  return `${hours}:${minutes.padStart(2, "0")} ${ampm}`;
}
