import { Wallet, TrendingUp, Users, Scissors } from "lucide-react";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { formatCurrency } from "@/lib/core/utils";

interface DashboardStatsValue {
  todayCommission: number;
  weeklyTotal: number;
  customersCount: number;
  servicesToday: number;
}

interface DashboardStatsProps {
  stats: DashboardStatsValue;
}

export const DashboardStats = ({ stats }: DashboardStatsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <PremiumCard className="p-4 group" delay={0}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-success-soft text-success flex items-center justify-center group-hover:scale-105 transition-transform">
            <Wallet size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
              عمولة اليوم
            </p>
            <p className="text-lg font-black text-main tabular-nums">
              {formatCurrency(stats.todayCommission)}
            </p>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="p-4 group" delay={0.1}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
              إنتاجية الأسبوع
            </p>
            <p className="text-lg font-black text-main tabular-nums">
              {formatCurrency(stats.weeklyTotal)}
            </p>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="p-4 group" delay={0.2}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-info-soft text-info flex items-center justify-center group-hover:scale-105 transition-transform">
            <Users size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
              عملاء اليوم
            </p>
            <p className="text-lg font-black text-main tabular-nums">
              {stats.customersCount}
            </p>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="p-4 group" delay={0.3}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-warning-soft text-warning flex items-center justify-center group-hover:scale-105 transition-transform">
            <Scissors size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
              خدمات اليوم
            </p>
            <p className="text-lg font-black text-main tabular-nums">
              {stats.servicesToday}
            </p>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
};
