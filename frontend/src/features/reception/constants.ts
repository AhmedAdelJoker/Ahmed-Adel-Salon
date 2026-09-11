/** Reception feature: board columns (moved from ReceptionBoard page). */
import { Clock, Scissors, Sparkles, Wallet } from "lucide-react";

export const COLUMNS = [
  {
    key: "waiting",
    title: "قائمة الانتظار",
    desc: "بانتظار دورهم أو تأكيد حضورهم",
    icon: Clock,
    statuses: ["waiting", "pending", "confirmed"],
    targetStatus: "waiting",
    theme: {
      text: "text-amber-600 dark:text-amber-400",
      headerBg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-200 dark:border-amber-500/20",
      iconBg:
        "bg-white text-amber-500 dark:bg-white/5 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20",
      count: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
      dot: "bg-amber-500",
      dropRing: "ring-amber-500/40",
    },
  },
  {
    key: "in_service",
    title: "قيد الخدمة",
    desc: "عملاء يتلقون خدماتهم حالياً",
    icon: Scissors,
    statuses: ["in_progress"],
    targetStatus: "in_progress",
    theme: {
      text: "text-indigo-600 dark:text-indigo-400",
      headerBg: "bg-indigo-50 dark:bg-indigo-500/10",
      border: "border-indigo-200 dark:border-indigo-500/20",
      iconBg:
        "bg-white text-indigo-500 dark:bg-white/5 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20",
      count: "bg-indigo-500 text-white shadow-sm shadow-indigo-500/30",
      dot: "bg-indigo-500",
      dropRing: "ring-indigo-500/40",
    },
  },
  {
    key: "review",
    title: "المراجعة المالية",
    desc: "بانتظار مراجعة الفاتورة النهائية",
    icon: Sparkles,
    statuses: ["completed"],
    targetStatus: "completed",
    theme: {
      text: "text-emerald-600 dark:text-emerald-400",
      headerBg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-200 dark:border-emerald-500/20",
      iconBg:
        "bg-white text-emerald-500 dark:bg-white/5 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20",
      count: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
      dot: "bg-emerald-500",
      dropRing: "ring-emerald-500/40",
    },
  },
  {
    key: "cashier",
    title: "صندوق الدفع",
    desc: "بانتظار العميل عند الكاشير",
    icon: Wallet,
    statuses: ["ready_for_payment"],
    targetStatus: "ready_for_payment",
    theme: {
      text: "text-sky-600 dark:text-sky-400",
      headerBg: "bg-sky-50 dark:bg-sky-500/10",
      border: "border-sky-200 dark:border-sky-500/20",
      iconBg:
        "bg-white text-sky-500 dark:bg-white/5 dark:text-sky-400 border border-sky-200/60 dark:border-sky-500/20",
      count: "bg-sky-500 text-white shadow-sm shadow-sky-500/30",
      dot: "bg-sky-500",
      dropRing: "ring-sky-500/40",
    },
  },
];
