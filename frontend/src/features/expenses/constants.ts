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
