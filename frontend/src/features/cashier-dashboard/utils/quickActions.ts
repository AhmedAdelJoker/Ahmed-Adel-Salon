import { Boxes, Coins, PlusCircle, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface QuickAction {
  title: string;
  desc: string;
  icon: LucideIcon;
  link: string;
  variant: string;
}

export const quickActions: QuickAction[] = [
  {
    title: "نقطة البيع",
    desc: "فتح واجهة الكاشير",
    icon: Zap,
    link: "/pos",
    variant: "primary",
  },
  {
    title: "حجز جديد",
    desc: "تسجيل موعد",
    icon: PlusCircle,
    link: "/bookings",
    variant: "info",
  },
  {
    title: "العملاء",
    desc: "إدارة البيانات",
    icon: Users,
    link: "/customers",
    variant: "success",
  },
  {
    title: "المخزن",
    desc: "متابعة المنتجات",
    icon: Boxes,
    link: "/inventory",
    variant: "warning",
  },
  {
    title: "المصروفات",
    desc: "تسجيل نثريات",
    icon: Coins,
    link: "/expenses",
    variant: "danger",
  },
];
