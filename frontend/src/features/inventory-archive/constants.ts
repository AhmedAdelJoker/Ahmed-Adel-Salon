import { Gift, Package, Receipt, Wallet } from "lucide-react";

export type LogTypeValue = "all" | "add" | "remove" | "adjust";

export const LOG_TYPE_VALUES = [
  { value: "all", labelKey: "inventoryArchive.allTypes", fallback: "كل الحركات" },
  { value: "add", labelKey: "inventoryArchive.add", fallback: "عمليات التوريد (إضافة)" },
  { value: "remove", labelKey: "inventoryArchive.remove", fallback: "عمليات الصرف (سحب)" },
  { value: "adjust", labelKey: "inventoryArchive.adjust", fallback: "تعديلات المخزون" },
] as const;

/** @deprecated Prefer building options from i18n (inventoryArchive.*). Kept for compatibility. */
export const LOG_TYPE_OPTIONS = LOG_TYPE_VALUES.map((o) => ({ value: o.value, label: o.fallback }));

export const LOG_TYPE_META: Record<
  string,
  { label: string; labelKey?: string; badgeVariant: "success" | "danger" | "info"; iconBg: string }
> = {
  add: { label: "توريد", labelKey: "inventoryArchive.add", badgeVariant: "success", iconBg: "bg-success-soft text-success" },
  remove: { label: "صرف", labelKey: "inventoryArchive.remove", badgeVariant: "danger", iconBg: "bg-danger-soft text-danger" },
  adjust: { label: "تعديل", labelKey: "inventoryArchive.adjust", badgeVariant: "info", iconBg: "bg-info-soft text-info" },
};

export function getLogTypeMeta(type: string, labels?: Partial<Record<string, string>>) {
  const base = LOG_TYPE_META[type] ?? {
    label: "حركة",
    labelKey: "inventoryArchive.type",
    badgeVariant: "info" as const,
    iconBg: "bg-info-soft text-info",
  };
  return { ...base, label: labels?.[type] ?? base.label };
}

export const ARCHIVE_SYSTEM_LINK_DEFS = [
  { href: "/inventory", icon: Package, iconBg: "bg-primary text-white", labelKey: "inventoryArchive.goInventory", descKey: "inventoryArchive.goInventoryDesc", label: "إدارة المستودع", desc: "الأصناف النشطة والتوريد اليومي" },
  { href: "/inventory/bundles", icon: Gift, iconBg: "bg-success text-white", labelKey: "inventoryArchive.goBundles", descKey: "inventoryArchive.goBundlesDesc", label: "حزم المنتجات", desc: "العروض والمجموعات المربوطة بالمخزون" },
  { href: "/expenses", icon: Wallet, iconBg: "bg-warning text-white", labelKey: "inventoryArchive.goExpenses", descKey: "inventoryArchive.goExpensesDesc", label: "المصروفات", desc: "مشتريات المخزون المسجلة كمصروف" },
  { href: "/invoices", icon: Receipt, iconBg: "bg-info text-white", labelKey: "inventoryArchive.goInvoices", descKey: "inventoryArchive.goInvoicesDesc", label: "الفواتير", desc: "مصدر حركة الصرف من المبيعات" },
] as const;

/** @deprecated Prefer building links from i18n. Kept for compatibility. */
export const ARCHIVE_SYSTEM_LINKS = ARCHIVE_SYSTEM_LINK_DEFS.map(({ label, desc, href, icon, iconBg }) => ({ label, desc, href, icon, iconBg }));
