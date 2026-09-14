export const CATEGORIES = [
  "رواتب", "إيجار", "مشتريات", "كهرباء", "مياه", "إنترنت", "صيانة", "تسويق", "ضيافة", "سلف", "أخرى",
];

export const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "wallet", label: "محفظة" },
];

export const CATEGORY_COLORS: Record<string, string> = {
  رواتب: "#6366f1",
  إيجار: "#f59e0b",
  مشتريات: "#10b981",
  كهرباء: "#3b82f6",
  مياه: "#06b6d4",
  إنترنت: "#8b5cf6",
  صيانة: "#ef4444",
  تسويق: "#ec4899",
  ضيافة: "#f97316",
  سلف: "#14b8a6",
  أخرى: "#6b7280",
};
