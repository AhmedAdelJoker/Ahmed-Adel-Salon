import {
  Wallet,
  Users,
  Package,
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  ShieldCheck,
  TrendingDown,
  Receipt,
  DollarSign,
  FileText,
  Building2,
} from "lucide-react";

export const CATEGORIES = [
  "رواتب", "إيجار", "مشتريات", "كهرباء", "مياه", "إنترنت", "صيانة", "تسويق", "ضيافة", "سلف", "أخرى",
];

export const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "wallet", label: "محفظة" },
];

/**
 * Category accent colours.
 *
 * These drive pie slices, chips and table accents. They were the raw Tailwind
 * palette, so on the dark surface they read as unrelated colours next to the
 * gold brand. The chart tokens keep the categories distinguishable while
 * following the theme in both modes.
 *
 * They are CSS custom properties, so anything that needs a translucent variant
 * must use `color-mix()` rather than appending an alpha suffix.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  رواتب: "var(--chart-2)",
  إيجار: "var(--chart-4)",
  مشتريات: "var(--chart-3)",
  كهرباء: "var(--chart-6)",
  مياه: "var(--chart-8)",
  إنترنت: "var(--chart-5)",
  صيانة: "var(--chart-7)",
  تسويق: "var(--chart-1)",
  ضيافة: "var(--warning)",
  سلف: "var(--info)",
  أخرى: "var(--text-muted)",
};

export const CATEGORY_ICONS: Record<string, typeof Users> = {
  رواتب: Users,
  إيجار: Building2,
  مشتريات: Package,
  كهرباء: TrendingUp,
  مياه: PieIcon,
  إنترنت: BarChart3,
  صيانة: ShieldCheck,
  تسويق: TrendingDown,
  ضيافة: Receipt,
  سلف: DollarSign,
  أخرى: FileText,
};

export const SYSTEM_LINKS: Array<{
  label: string;
  icon: typeof Users;
  desc: string;
  color: string;
  href: string;
}> = [
  { label: "المخزون", icon: Package, desc: "مشتريات المخزون تُنشئ مصروف تلقائي", color: "bg-emerald-500", href: "/inventory" },
  { label: "الرواتب", icon: Users, desc: "صرف الرواتب يُنشئ مصروف رواتب", color: "bg-indigo-500", href: "/owner/payroll" },
  { label: "الصندوق", icon: Wallet, desc: "كل مصروف يخصم من رصيد الكاش", color: "bg-amber-500", href: "/owner/cashbox" },
  { label: "الفواتير", icon: Receipt, desc: "الإيرادات - المصروفات = صافي الربح", color: "bg-sky-500", href: "/invoices" },
];
