import { Gift, Package, Receipt, Wallet } from "lucide-react";

export const LOG_TYPE_OPTIONS = [
  { value: "all", label: "كل الحركات" },
  { value: "add", label: "عمليات التوريد (إضافة)" },
  { value: "remove", label: "عمليات الصرف (سحب)" },
  { value: "adjust", label: "تعديلات المخزون" },
] as const;

export const LOG_TYPE_META: Record<
  string,
  { label: string; badgeVariant: "success" | "danger" | "info"; iconBg: string }
> = {
  add: {
    label: "توريد",
    badgeVariant: "success",
    iconBg: "bg-success-soft text-success",
  },
  remove: {
    label: "صرف",
    badgeVariant: "danger",
    iconBg: "bg-danger-soft text-danger",
  },
  adjust: {
    label: "تعديل",
    badgeVariant: "info",
    iconBg: "bg-info-soft text-info",
  },
};

export function getLogTypeMeta(type: string) {
  return (
    LOG_TYPE_META[type] ?? {
      label: "حركة",
      badgeVariant: "info" as const,
      iconBg: "bg-info-soft text-info",
    }
  );
}

export const ARCHIVE_SYSTEM_LINKS = [
  {
    label: "إدارة المستودع",
    desc: "الأصناف النشطة والتوريد اليومي",
    href: "/inventory",
    icon: Package,
    iconBg: "bg-primary text-white",
  },
  {
    label: "حزم المنتجات",
    desc: "العروض والمجموعات المربوطة بالمخزون",
    href: "/inventory/bundles",
    icon: Gift,
    iconBg: "bg-success text-white",
  },
  {
    label: "المصروفات",
    desc: "مشتريات المخزون المسجلة كمصروف",
    href: "/expenses",
    icon: Wallet,
    iconBg: "bg-warning text-white",
  },
  {
    label: "الفواتير",
    desc: "مصدر حركة الصرف من المبيعات",
    href: "/invoices",
    icon: Receipt,
    iconBg: "bg-info text-white",
  },
];
