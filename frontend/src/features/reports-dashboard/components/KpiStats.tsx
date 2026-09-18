import { StatCard } from "@/components/shared/PremiumUI";
import { KPI_CONFIG } from "@/features/reports-dashboard/constants";
import type { DashboardStats } from "@/features/reports-dashboard/constants";
import { formatStatValue, getTrendVariant } from "@/features/reports-dashboard/utils";

export interface KpiStatsProps {
  stats: DashboardStats;
}

export function KpiStats({ stats }: KpiStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPI_CONFIG.map((kpi, idx) => {
          const value = stats[kpi.key] ?? 0;
          const rawTrend = stats[kpi.trendKey];
          const isValidTrend = typeof rawTrend === 'number' && isFinite(rawTrend) && rawTrend !== 0;
          const trendVariant = isValidTrend ? getTrendVariant(rawTrend) : undefined;
          const cardProps = {
            label: kpi.label,
            value: formatStatValue(kpi.key, value),
            icon: kpi.icon,
            variant: kpi.variant,
            delay: idx * 0.04,
            trend: trendVariant,
            trendValue: isValidTrend ? `${Math.abs(rawTrend ?? 0)}%` : undefined,
          };
          return <StatCard key={kpi.key} {...cardProps} />;
        })}
      </div>
  );
}
