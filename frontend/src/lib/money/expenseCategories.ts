/**
 * Canonical Arabic labels for expense categories.
 *
 * Mirrors `backend/app/utils/expense_labels.py` so the UI can display (and
 * merge) legacy English category values without touching stored data.
 * The backend also returns `label_ar` per category — prefer that when
 * present and use this map as a client-side fallback.
 */

export const EXPENSE_CATEGORY_AR: Record<string, string> = {
  salaries: "رواتب",
  salary: "رواتب",
  payroll: "رواتب",
  wages: "رواتب",
  rent: "إيجار",
  rents: "إيجار",
  purchases: "مشتريات",
  supplies: "مشتريات",
  products: "مشتريات",
  stock: "مشتريات",
  inventory: "مشتريات",
  tools: "أدوات",
  equipment: "أدوات",
  electricity: "كهرباء",
  electric: "كهرباء",
  power: "كهرباء",
  water: "مياه",
  internet: "إنترنت",
  wifi: "إنترنت",
  maintenance: "صيانة",
  repair: "صيانة",
  repairs: "صيانة",
  marketing: "تسويق",
  ads: "تسويق",
  advertising: "تسويق",
  hospitality: "ضيافة",
  advance: "سلف",
  advances: "سلف",
  loan: "سلف",
  loans: "سلف",
  utilities: "مرافق",
  other: "أخرى",
  others: "أخرى",
  general: "أخرى",
  misc: "أخرى",
  miscellaneous: "أخرى",
};

const ARABIC_RE = /[؀-ۿ]/;

export function expenseCategoryLabel(name: unknown): string {
  if (name === null || name === undefined) return "أخرى";
  const text = String(name).trim();
  if (!text) return "أخرى";
  if (ARABIC_RE.test(text)) return text;
  return EXPENSE_CATEGORY_AR[text.toLowerCase()] ?? text;
}
