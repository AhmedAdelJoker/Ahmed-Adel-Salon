import { Activity, Clock, Globe, Sparkles, X } from "lucide-react";
import { StatCard } from "@/components/shared/PremiumUI";

interface StatsShape {
  total: number;
  online: number;
  waiting: number;
  reception: number;
  cancelled: number;
}

export default function BookingsStatsGrid({
  stats,
  setActiveTab,
  setQuickFilter,
}: {
  stats: StatsShape;
  setActiveTab: (v: string) => void;
  setQuickFilter: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveTab("الكل");
          setQuickFilter("all");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveTab("الكل");
            setQuickFilter("all");
          }
        }}
        className="cursor-pointer transition-transform hover:scale-[1.02]"
      >
        <StatCard
          label="إجمالي المواعيد"
          value={stats.total}
          icon={Activity}
          variant="primary"
          trend={undefined}
          trendValue={undefined}
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveTab("أونلاين");
          setQuickFilter("all");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveTab("أونلاين");
            setQuickFilter("all");
          }
        }}
        className="cursor-pointer transition-transform hover:scale-[1.02]"
      >
        <StatCard
          label="حجوزات أونلاين"
          value={stats.online}
          icon={Globe}
          variant="info"
          trend={undefined}
          trendValue={undefined}
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveTab("بانتظار الخدمة");
          setQuickFilter("all");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveTab("بانتظار الخدمة");
            setQuickFilter("all");
          }
        }}
        className="cursor-pointer transition-transform hover:scale-[1.02]"
      >
        <StatCard
          label="بانتظار الخدمة"
          value={stats.waiting}
          icon={Clock}
          variant="warning"
          trend={undefined}
          trendValue={undefined}
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveTab("عند الاستقبال");
          setQuickFilter("all");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveTab("عند الاستقبال");
            setQuickFilter("all");
          }
        }}
        className="cursor-pointer transition-transform hover:scale-[1.02]"
      >
        <StatCard
          label="عند الاستقبال"
          value={stats.reception}
          icon={Sparkles}
          variant="success"
          trend={undefined}
          trendValue={undefined}
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveTab("الملغاة");
          setQuickFilter("all");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveTab("الملغاة");
            setQuickFilter("all");
          }
        }}
        className="cursor-pointer transition-transform hover:scale-[1.02]"
      >
        <StatCard
          label="حجوزات ملغاة"
          value={stats.cancelled}
          icon={X}
          variant="danger"
          trend={undefined}
          trendValue={undefined}
        />
      </div>
    </div>
  );
}
