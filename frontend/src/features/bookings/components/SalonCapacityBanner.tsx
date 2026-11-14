import { TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  // Clamping keeps the bar and ARIA values sane even if the backend sends a
  // percentage that temporarily exceeds 100.
  const percentage = Math.min(
    100,
    Math.max(0, Math.round(salonCapacity.percentage || 0)),
  );
  const count = salonCapacity.activeCount || 0;
  const { t } = useTranslation("bookings");
  // Correct Arabic pluralization instead of the fixed "مواعيد".
  const countLabel =
    count === 0
      ? t("capacity.zeroCount")
      : count === 1
        ? t("capacity.oneCount")
        : count === 2
          ? t("capacity.twoCount")
          : count <= 10
            ? t("capacity.manyCount", { count })
            : t("capacity.manyAboveTen", { count });

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
              {t("capacity.title")}
            </h3>
            <Badge
              className={cn(
                "text-[10px] font-black border-none px-2 h-5",
                salonCapacity.isBusy
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-emerald-500 text-white",
              )}
            >
              {salonCapacity.isBusy
                ? t("capacity.busy")
                : t("capacity.normal")}
            </Badge>
          </div>
          <p className="text-xs text-white/70 font-medium">
            {count === 0
              ? t("capacity.zeroCount")
              : t("capacity.bookedToday", { label: countLabel })}
            {" | "}
            {t("capacity.pressure", { percent: percentage })}
          </p>
        </div>
      </div>

      <div className="w-full md:w-72 space-y-2 relative z-10">
        <div className="flex justify-between items-center text-xs font-bold text-white/80">
          <span>{t("capacity.capacityLabel")}</span>
          <span className="text-indigo-400"><span dir="ltr">{percentage}%</span></span>
        </div>
        <div
          role="progressbar"
          aria-label={t("capacity.capacityAria")}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden p-0.5"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              percentage > 80
                ? "bg-rose-500"
                : percentage > 50
                  ? "bg-amber-500"
                  : "bg-indigo-500",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

