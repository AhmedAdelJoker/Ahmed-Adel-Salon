import { Clock, Receipt, ShoppingBag, BarChart3 } from "lucide-react";

export const DAILY_SUMMARY_LINKS = [
  {
    label: "الورديات",
    desc: "فتح وإغلاق ورديات نقاط البيع",
    href: "/pos",
    icon: Clock,
    iconBg: "bg-primary text-white",
  },
  {
    label: "الفواتير",
    desc: "مصدر إيرادات اليوم",
    href: "/invoices",
    icon: Receipt,
    iconBg: "bg-success text-white",
  },
  {
    label: "المصروفات",
    desc: "مراجعة واعتماد مصروفات اليوم",
    href: "/expenses",
    icon: ShoppingBag,
    iconBg: "bg-warning text-white",
  },
  {
    label: "التقارير المالية",
    desc: "تحليل أعمق للإيرادات والمصروفات",
    href: "/owner/financial",
    icon: BarChart3,
    iconBg: "bg-info text-white",
  },
];
