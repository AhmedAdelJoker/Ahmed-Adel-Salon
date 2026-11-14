import { CalendarDays, Scissors, TrendingUp, Users, Wallet } from "lucide-react";

import { CurrencyStatCard, StatCard } from "@/components/shared/DisplayComponents";

interface DashboardStatsValue {
  todayCommission: number;
  weeklyTotal: number;
  customersCount: number;
  servicesToday: number;
  /** Not yet earned this month, on top of what has been paid. */
  pendingCommission?: number;
  /** Advances already taken against this month's earnings. */
  receivedAdvances?: number;
}

interface DashboardStatsProps {
  stats: DashboardStatsValue;
}

/**
 * The barber's four headline numbers.
 *
 * ## Why the markup is gone
 *
 * These four tiles hand-rolled `PremiumCard` + icon + label + `tabular-nums`
 * value, which is exactly what `CurrencyStatCard` / `StatCard` in
 * `DisplayComponents.tsx` already provide (the file's own doc comment calls
 * itself a drop-in replacement). Beyond the duplication, the hand-rolled tiles
 * had no placeholder: a figure that failed to load rendered `0` in the same
 * weight as a real zero, so "the API said nothing" and "the barber earned
 * nothing" looked identical. `StatCard` renders an em dash for empty.
 *
 * ## What was added
 *
 * `pendingCommission` and `receivedAdvances`. The API computed both and the
 * dashboard showed neither, which made the monthly figure unexplainable: a
 * barber whose net pay is lower than their production has no way to see that
 * the difference is unpaid commission minus an advance already taken. Those two
 * numbers are the whole explanation.
 */
export const DashboardStats = ({ stats }: DashboardStatsProps) => {
  const hasPending =
    typeof stats.pendingCommission === "number" || stats.receivedAdvances !== undefined;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <CurrencyStatCard
        label="عمولة اليوم"
        value={stats.todayCommission}
        icon={Wallet}
        variant="success"
      />

      <CurrencyStatCard
        label="إنتاجية الأسبوع"
        value={stats.weeklyTotal}
        icon={TrendingUp}
        variant="primary"
      />

      <StatCard
        label="عملاء اليوم"
        value={stats.customersCount ?? null}
        icon={Users}
        variant="info"
      />

      <StatCard
        label="خدمات اليوم"
        value={stats.servicesToday ?? null}
        icon={Scissors}
        variant="warning"
      />

      {hasPending && (
        <CurrencyStatCard
          label="عمولة غير محصّلة"
          value={stats.pendingCommission ?? null}
          icon={CalendarDays}
          variant="secondary"
          hint={
            typeof stats.receivedAdvances === "number" && stats.receivedAdvances > 0
              ? `سلف مسحوبة: ${stats.receivedAdvances}`
              : undefined
          }
          className="col-span-2 md:col-span-1"
        />
      )}
    </div>
  );
};