import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";

interface SalonCapacity {
  percentage: number;
  activeCount: number;
  isBusy: boolean;
}

export default function SalonCapacityBanner({
  salonCapacity,
}: {
  salonCapacity: SalonCapacity;
}) {
  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full -ml-32 -mt-32 blur-3xl" />

      <div className="flex items-center gap-4 relative z-10">
        <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <TrendingUp size={24} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm sm:text-base font-black">
              مؤشر إشغال الصالون اليوم
            </h3>
            <Badge
              className={cn(
                "text-[10px] font-black border-none px-2 h-5",
                salonCapacity.isBusy
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-emerald-500 text-white",
              )}
            >
              {salonCapacity.isBusy ? "فترة ذروة" : "نشاط طبيعي"}
            </Badge>
          </div>
          <p className="text-xs text-white/70 font-medium">
            تم حجز{" "}
            <span className="text-indigo-300 font-bold">
              {salonCapacity.activeCount} مواعيد
            </span>{" "}
            اليوم | نسبة الضغط التشغيلي:{" "}
            <span className="text-indigo-300 font-bold">
              {salonCapacity.percentage}%
            </span>
          </p>
        </div>
      </div>

      <div className="w-full md:w-72 space-y-2 relative z-10">
        <div className="flex justify-between items-center text-xs font-bold text-white/80">
          <span>سعة التشغيل</span>
          <span className="text-indigo-400">{salonCapacity.percentage}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden p-0.5">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              salonCapacity.percentage > 80
                ? "bg-rose-500"
                : salonCapacity.percentage > 50
                  ? "bg-amber-500"
                  : "bg-indigo-500",
            )}
            style={{ width: `${salonCapacity.percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
