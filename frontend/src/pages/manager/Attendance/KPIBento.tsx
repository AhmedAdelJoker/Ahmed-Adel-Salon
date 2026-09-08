import React from "react";
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Clock, Coffee } from "lucide-react";

const KPIBento = ({ todayRecords, lateEmployees }) => {
  const dynamicStats = React.useMemo(
    () => [
      {
        label: "حضور اليوم",
        value: todayRecords?.length || 0,
        Icon: UserCheck,
        color: "text-primary",
        bg: "bg-primary-soft",
      },
      {
        label: "المتأخرين",
        value: lateEmployees?.length || 0,
        Icon: Clock,
        color: "text-danger",
        bg: "bg-danger-soft",
      },
      {
        label: "في استراحة",
        value: todayRecords?.filter((r) => r?.status === "break").length || 0,
        Icon: Coffee,
        color: "text-warning",
        bg: "bg-warning-soft",
      },
    ],
    [todayRecords, lateEmployees],
  );

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
      {dynamicStats.map((s, i) => (
        <PremiumCard key={i} className="group p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={cn(
                "hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 sm:flex",
                s.bg,
              )}
            >
              <s.Icon size={18} className={s.color} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                {s.label}
              </p>
              <h4 className="text-xl font-black text-main tabular-nums sm:text-2xl lg:text-3xl">
                {s.value}
              </h4>
            </div>
          </div>
        </PremiumCard>
      ))}
    </div>
  );
};

export default KPIBento;
