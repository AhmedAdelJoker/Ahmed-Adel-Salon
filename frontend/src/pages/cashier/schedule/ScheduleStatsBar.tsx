import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/shared/PremiumUI";
import {
  CalendarDays,
  Clock3,
  Scissors,
  Sparkles,
  Users,
  Ban,
} from "lucide-react";

const ScheduleStatsBar = memo(({ stats }: any) => {
  const { t } = useTranslation("schedule");
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 relative z-10">
      <StatCard
        label={t("stats.today")}
        value={stats.total}
        icon={CalendarDays}
        variant="primary"
        delay={0}
       trend={undefined} trendValue={undefined} />
      <StatCard
        label={t("stats.waiting")}
        value={stats.confirmed}
        icon={Clock3}
        variant="warning"
        delay={0.05}
       trend={undefined} trendValue={undefined} />
      <StatCard
        label={t("stats.inProgress")}
        value={stats.inProgress}
        icon={Scissors}
        variant="info"
        delay={0.1}
       trend={undefined} trendValue={undefined} />
      <StatCard
        label={t("stats.reception")}
        value={stats.reception}
        icon={Sparkles}
        variant="success"
        delay={0.15}
       trend={undefined} trendValue={undefined} />
      <StatCard
        label={t("stats.done")}
        value={stats.done}
        icon={Users}
        variant="secondary"
        delay={0.2}
       trend={undefined} trendValue={undefined} />
      <StatCard
        label={t("stats.cancelled")}
        value={stats.cancelled}
        icon={Ban}
        variant="danger"
        delay={0.25}
       trend={undefined} trendValue={undefined} />
    </div>
  );
});

ScheduleStatsBar.displayName = "ScheduleStatsBar";

export default ScheduleStatsBar;
