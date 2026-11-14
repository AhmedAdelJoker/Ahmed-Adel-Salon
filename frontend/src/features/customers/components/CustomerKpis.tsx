/** Customers CustomerKpis — system-wide figures from GET /customers/stats. */
import { useTranslation } from "react-i18next";
import { TrendingUp, UserCheck, UserPlus, Users, Star } from "lucide-react";
import { formatCurrency } from "@/lib/core/utils";
import CustomerKpi from "@/features/customers/components/CustomerKpi";
import type { CustomerStats } from "@/features/customers/hooks/useCustomersList";

export default function CustomerKpis({
  stats,
}: {
  stats: CustomerStats;
}) {
  const { t } = useTranslation("customers");
  return (
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <CustomerKpi
          label={t("stats.total")}
          value={stats.total || ""}
          icon={Users}
          color="bg-primary"
        />
        <CustomerKpi
          label={t("stats.vip")}
          value={stats.vip_count || ""}
          icon={Star}
          color="bg-warning"
        />
        <CustomerKpi
          label={t("stats.regular")}
          value={stats.regular_count || ""}
          icon={UserCheck}
          color="bg-info"
        />
        <CustomerKpi
          label={t("stats.new")}
          value={stats.new_count || ""}
          icon={UserPlus}
          color="bg-success"
        />
        <CustomerKpi
          label={t("stats.avgSpend")}
          value={formatCurrency(stats.avg_spend) || ""}
          icon={TrendingUp}
          color="bg-danger"
        />
      </div>
  );
}
