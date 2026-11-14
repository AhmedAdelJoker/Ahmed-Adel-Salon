/** Reception KPI cards (moved from ReceptionBoard page). */
import {
  CalendarDays,
  CheckCheck,
  Clock,
  Scissors,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/core/utils";
import KpiCard from "@/features/reception/components/KpiCard";
import { useTranslation } from "react-i18next";

export default function ReceptionKpis({ kpis }: { kpis: any }) {
  const { t } = useTranslation("reception");
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
      <KpiCard
        label={t("board.kpi_total")}
        value={kpis.total}
        icon={CalendarDays}
        className="text-primary bg-primary/10"
      />
      <KpiCard
        label={t("board.kpi_waiting")}
        value={kpis.waiting}
        icon={Clock}
        className="text-amber-600 dark:text-amber-400 bg-amber-500/10"
      />
      <KpiCard
        label={t("board.kpi_in_service")}
        value={kpis.inService}
        icon={Scissors}
        className="text-indigo-600 dark:text-indigo-400 bg-indigo-500/10"
      />
      <KpiCard
        label={t("board.kpi_cashier")}
        value={kpis.cashier}
        icon={Wallet}
        className="text-sky-600 dark:text-sky-400 bg-sky-500/10"
      />
      <KpiCard
        label={t("board.kpi_done")}
        value={kpis.done}
        icon={CheckCheck}
        className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
      />
      <KpiCard
        label={t("board.kpi_revenue")}
        value={formatCurrency(kpis.revenue)}
        icon={TrendingUp}
        className="text-success bg-success/10"
      />
    </div>
  );
}
