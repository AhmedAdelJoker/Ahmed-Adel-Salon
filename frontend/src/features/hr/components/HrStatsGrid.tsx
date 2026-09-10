import { CheckCircle2, Scissors, UserPlus, Users } from "lucide-react";
import { StatCard } from "@/components/shared/PremiumUI";
import type { HrStats } from "@/features/hr/types";

export default function HrStatsGrid({ stats }: { stats: HrStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="إجمالي الكادر"
        value={stats.total}
        icon={Users}
        variant="secondary"
        delay={0}
      />
      <StatCard
        label="نشط حالياً"
        value={stats.active}
        icon={CheckCircle2}
        variant="success"
        delay={0.05}
      />
      <StatCard
        label="خبراء الحلاقة"
        value={stats.barbers}
        icon={Scissors}
        variant="warning"
        delay={0.1}
      />
      <StatCard
        label="فريق الدعم"
        value={stats.assistants}
        icon={UserPlus}
        variant="primary"
        delay={0.15}
      />
    </div>
  );
}
