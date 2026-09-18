import React from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

interface EmployeeCardStatsProps {
  rec: any;
  lateMinutes: number;
  onDetailsClick: () => void;
}

export function EmployeeCardStats({
  rec,
  lateMinutes,
  onDetailsClick,
}: EmployeeCardStatsProps) {
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "--:--";
    return new Date(timestamp).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-xl bg-soft p-2.5 sm:p-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-muted sm:text-[9px]">
            توقيت القيد
          </p>
          <span className="mt-0.5 block text-xs font-black tabular-nums text-main sm:text-sm">
            {formatTime(rec.created_at)}
          </span>
        </div>
        <div className="rounded-xl bg-soft p-2.5 sm:p-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-muted sm:text-[9px]">
            ساعات العمل
          </p>
          <span className="mt-0.5 block text-xs font-black tabular-nums text-main sm:text-sm">
            {(Number(rec.stats?.totalHours) || 0).toFixed(1)} ساعة
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
        <p
          className={cn(
            "text-[10px] font-black uppercase sm:text-xs",
            lateMinutes > 0 ? "text-danger" : "text-emerald-600",
          )}
        >
          {lateMinutes > 0 ? `تأخير: ${lateMinutes} دقيقة` : "انضباط ممتاز"}
        </p>
        <Button
          variant="ghost"
          className="h-8 rounded-lg px-3 text-[10px] font-black sm:h-9 sm:px-4 sm:text-[11px]"
          onClick={onDetailsClick}
        >
          <Eye size={12} className="ml-1" /> التفاصيل
        </Button>
      </div>
    </>
  );
}

export default EmployeeCardStats;
