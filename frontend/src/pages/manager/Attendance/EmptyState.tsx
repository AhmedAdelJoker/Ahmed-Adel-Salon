import React from "react";
import { UserCheck, Search } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { TrendingUp } from "lucide-react";

const emptyStates = {
  pulse: {
    icon: UserCheck,
    title: "بانتظار تسجيل أول حضور",
    description: "سيظهر الحضور الحي هنا فور تسجيل أول قيد اليوم",
  },
  monthly: {
    icon: TrendingUp,
    title: "لا توجد بيانات للشهر الحالي",
    description: "ستظهر الإحصائيات الشهرية عند تسجيل الحضور",
  },
  archive: {
    icon: History,
    title: "لا توجد سجلات تطابق البحث",
    description: "جرّب تعديل معايير البحث أو نطاق التاريخ",
  },
  default: { icon: Search, title: "لا توجد بيانات", description: "" },
};

const EmptyState = ({ view = "default", className }) => {
  const state = emptyStates[view] || emptyStates.default;
  const Icon = state.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center sm:py-20",
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-soft sm:h-16 sm:w-16">
        <Icon size={24} className="text-muted sm:hidden" />
        <Icon size={28} className="hidden text-muted sm:block" />
      </div>
      <p className="text-sm font-black text-main sm:text-lg">{state.title}</p>
      {state.description && (
        <p className="mt-1 text-xs font-bold text-muted sm:text-sm">
          {state.description}
        </p>
      )}
    </div>
  );
};

export default EmptyState;
