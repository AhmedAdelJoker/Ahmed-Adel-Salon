import { PAYMENT_LABELS } from "@/features/financial-reports/constants";
import type { TFunction } from "i18next";

export function shortLabel(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

/** Localized payment-method label. Unknown raw values pass through unchanged. */
export function paymentLabel(key: string, t: TFunction): string {
  if (!key) return String(t("finFeat.pay.unspecified"));
  const k = String(key).trim().toLowerCase();
  return PAYMENT_LABELS[k] ? String(t(PAYMENT_LABELS[k])) : String(key);
}

export function dayKeyOf(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : "";
}

export function compactTick(v: number): string {
  const n = Number(v);
  const num = Number.isFinite(n) ? n : 0;
  if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(num));
}

/** Arabic display label -> canonical group key (mirrors lib/money/expenseCategories). */
const GROUP_BY_AR_LABEL: Record<string, string> = {
  "رواتب": "salaries",
  "إيجار": "rent",
  "مشتريات": "purchases",
  "أدوات": "tools",
  "كهرباء": "power",
  "مياه": "water",
  "إنترنت": "internet",
  "صيانة": "maintenance",
  "تسويق": "marketing",
  "ضيافة": "hospitality",
  "سلف": "advance",
  "مرافق": "utilities",
  "أخرى": "other",
};

/** English alias -> canonical group key (mirrors EXPENSE_CATEGORY_AR). */
const GROUP_BY_EN_ALIAS: Record<string, string> = {
  salaries: "salaries",
  salary: "salaries",
  payroll: "salaries",
  wages: "salaries",
  rent: "rent",
  rents: "rent",
  purchases: "purchases",
  supplies: "purchases",
  products: "purchases",
  stock: "purchases",
  inventory: "purchases",
  tools: "tools",
  equipment: "tools",
  electricity: "power",
  electric: "power",
  power: "power",
  water: "water",
  internet: "internet",
  wifi: "internet",
  maintenance: "maintenance",
  repair: "maintenance",
  repairs: "maintenance",
  marketing: "marketing",
  ads: "marketing",
  advertising: "marketing",
  hospitality: "hospitality",
  advance: "advance",
  advances: "advance",
  loan: "advance",
  loans: "advance",
  utilities: "utilities",
  other: "other",
  others: "other",
  general: "other",
  misc: "other",
  miscellaneous: "other",
};

/** Canonical group key for a raw category value (Arabic label or English alias), or "" when custom. */
export function categoryKeyOf(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  return GROUP_BY_AR_LABEL[text] ?? GROUP_BY_EN_ALIAS[text.toLowerCase()] ?? "";
}

/** Localized display label for a raw expense-category value (custom texts pass through). */
export function expenseCatLabelFor(raw: unknown, t: TFunction): string {
  const group = categoryKeyOf(raw);
  if (group) return String(t(`finFeat.cat.${group}`));
  const text = String(raw ?? "").trim();
  if (!text || text === "\u0639\u0627\u0645") return String(t("finFeat.row.genericCategory"));
  return text;
}
