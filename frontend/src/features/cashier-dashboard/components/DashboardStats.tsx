import {
  CalendarDays,
  Clock,
  Coins,
  Receipt,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";
import { StatCard } from "@/components/shared/PremiumUI";
import { formatCurrency } from "@/lib/core/utils";
import type { CashierSummary } from "@/features/cashier-dashboard/types";

export interface DashboardStatsProps {
  summary: CashierSummary | null | undefined;
}

export function DashboardStats({ summary }: DashboardStatsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="مبيعات اليوم"
          value={formatCurrency(summary?.today_sales || 0)}
          icon={TrendingUp}
          variant="success"
          delay={0}
          trend={undefined} trendValue={undefined} />
        <StatCard
          label="مصاريف اليوم"
          value={formatCurrency(summary?.today_expenses || 0)}
          icon={Coins}
          variant="danger"
          delay={0.05}
          trend={undefined} trendValue={undefined} />
        <StatCard
          label="الموظفون الحاضرون"
          value={summary?.present_employees_count || 0}
          icon={UserCheck}
          variant="primary"
          delay={0.1}
          trend={undefined} trendValue={undefined} />
        <StatCard
          label="بانتظار الخدمة"
          value={summary?.waiting_customers || 0}
          icon={Clock}
          variant="warning"
          delay={0.15}
          trend={undefined} trendValue={undefined} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="الحجوزات"
          value={summary?.today_appointments || 0}
          icon={CalendarDays}
          variant="info"
          delay={0}
          trend={undefined} trendValue={undefined} />
        <StatCard
          label="الفواتير"
          value={summary?.invoices_count || 0}
          icon={Receipt}
          variant="secondary"
          delay={0.05}
          trend={undefined} trendValue={undefined} />
        <StatCard
          label="إلغاءات اليوم"
          value={summary?.todayCancellationsCount || 0}
          icon={X}
          variant="danger"
          delay={0.1}
          trend={undefined} trendValue={undefined} />
        <StatCard
          label="معدل الإلغاء"
          value={`${summary?.cancellationRate || 0}%`}
          icon={TrendingUp}
          variant="warning"
          delay={0.15}
          trend={undefined} trendValue={undefined} />
      </div>
    </>
  );
}
