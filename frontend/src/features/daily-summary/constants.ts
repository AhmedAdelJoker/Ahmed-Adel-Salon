import { Clock, Receipt, ShoppingBag, BarChart3 } from "lucide-react";

export const DAILY_SUMMARY_LINKS = [
  {
    label: "dailyFeature.links.shifts",
    desc: "dailyFeature.links.shiftsDesc",
    href: "/pos",
    icon: Clock,
    iconBg: "bg-primary text-white",
  },
  {
    label: "dailyFeature.links.invoices",
    desc: "dailyFeature.links.invoicesDesc",
    href: "/invoices",
    icon: Receipt,
    iconBg: "bg-success text-white",
  },
  {
    label: "dailyFeature.links.expenses",
    desc: "dailyFeature.links.expensesDesc",
    href: "/expenses",
    icon: ShoppingBag,
    iconBg: "bg-warning text-white",
  },
  {
    label: "dailyFeature.links.financial",
    desc: "dailyFeature.links.financialDesc",
    href: "/owner/financial",
    icon: BarChart3,
    iconBg: "bg-info text-white",
  },
];
