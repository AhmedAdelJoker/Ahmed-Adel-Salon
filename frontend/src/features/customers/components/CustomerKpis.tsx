/** Customers CustomerKpis — system-wide figures from GET /customers/stats. */
import { TrendingUp, UserCheck, UserPlus, Users, Star } from "lucide-react";
import { formatCurrency } from "@/lib/core/utils";
import CustomerKpi from "@/features/customers/components/CustomerKpi";
import type { CustomerStats } from "@/features/customers/hooks/useCustomersList";

export default function CustomerKpis({
  stats,
}: {
  stats: CustomerStats;
}) {
  return (
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <CustomerKpi
          label="إجمالي العملاء"
          value={stats.total || ""}
          icon={Users}
          color="bg-primary"
        />
        <CustomerKpi
          label="نخبة VIP"
          value={stats.vip_count || ""}
          icon={Star}
          color="bg-warning"
        />
        <CustomerKpi
          label="عملاء منتظمون"
          value={stats.regular_count || ""}
          icon={UserCheck}
          color="bg-info"
        />
        <CustomerKpi
          label="عملاء جدد"
          value={stats.new_count || ""}
          icon={UserPlus}
          color="bg-success"
        />
        <CustomerKpi
          label="متوسط الإنفاق"
          value={formatCurrency(stats.avg_spend) || ""}
          icon={TrendingUp}
          color="bg-danger"
        />
      </div>
  );
}
