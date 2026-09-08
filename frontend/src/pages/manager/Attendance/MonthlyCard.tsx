import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/core/utils";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Clock, DollarSign, TrendingUp } from "lucide-react";

const aiConfig = {
  excellent: {
    label: "ممتاز",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  good: { label: "جيد", color: "text-warning", bgColor: "bg-warning/10" },
  poor: { label: "ضعيف", color: "text-danger", bgColor: "bg-danger/10" },
};

const MonthlyCard = ({ emp, employees, onPayrollClick }) => {
  const employee = employees?.find((e) => String(e.id) === String(emp.id));
  const empName = emp.full_name || employee?.full_name || "موظف غير معروف";
  const empImage = employee?.profile_image_url;
  const ai = emp.ai || { label: "ضعيف", color: "text-danger" };
  const aiInfo = aiConfig[ai.label] || {
    label: "ضعيف",
    color: "text-danger",
    bgColor: "bg-danger/10",
  };

  const metrics = [
    {
      label: "إجمالي الساعات",
      value: `${Number(emp.stats?.totalHours) || 0}`,
      unit: "ساعة",
      icon: Clock,
      color: "text-primary",
    },
    {
      label: "صافي المستحق",
      value: `${formatCurrency(emp.payroll?.netSalary || 0)}`,
      icon: DollarSign,
      color: "text-success",
    },
    { label: "أداء AI", value: ai.label, icon: ShieldCheck, color: ai.color },
    {
      label: "ساعات إضافية",
      value: `${Number(emp.stats?.overtime) || 0}`,
      unit: "ساعة",
      icon: TrendingUp,
      color: "text-emerald-600",
    },
  ];

  return (
    <motion.div
      layout
      key={emp.id}
      className="group relative rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:border-primary/30 hover:shadow-premium sm:rounded-2xl sm:p-5"
    >
      <div className="flex items-center gap-3">
        <EmployeeAvatar imageUrl={empImage} name={empName} size="lg" />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-base font-black text-main sm:text-lg"
            title={empName}
          >
            {empName}
          </h3>
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted sm:text-[10px]">
            ملخص الأداء الشهري
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="rounded-xl bg-soft p-2.5 sm:p-3">
            <p className="text-[8px] font-bold uppercase tracking-wider text-muted sm:text-[9px]">
              {m.label}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <m.icon size={14} className={cn("shrink-0", m.color)} />
              <h4
                className="truncate text-sm font-black sm:text-base"
                style={{ color: m.color }}
              >
                {m.value}{" "}
                {m.unit && (
                  <span className="text-[10px] font-bold text-muted">
                    {m.unit}
                  </span>
                )}
              </h4>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() => onPayrollClick?.(emp)}
        className="mt-3 h-9 w-full rounded-xl text-[10px] font-black uppercase sm:h-10 sm:text-[11px]"
      >
        تحويل إلى مسير الرواتب
      </Button>
    </motion.div>
  );
};

export default MonthlyCard;
