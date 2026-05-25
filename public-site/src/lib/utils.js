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
