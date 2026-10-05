/** Customers CustomerKpis — system-wide figures from GET /customers/stats. */
import { Star, TrendingUp, UserPlus, Users } from "lucide-react";
import { formatCurrency } from "@/lib/core/utils";
import CustomerKpi from "@/features/customers/components/CustomerKpi";
import type { CustomerStats } from "@/features/customers/hooks/useCustomersList";

export default function CustomerKpis({
  stats,
}: {
  stats: CustomerStats;
}) {
  return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <CustomerKpi
          label="إجمالي المنظومة"
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
          label="العملاء الجدد"
          value={stats.new_count || ""}
          icon={UserPlus}
          color="bg-success"
        />
        <CustomerKpi
          label="متوسط الإنفاق"
          value={formatCurrency(stats.avg_spend) || ""}
          icon={TrendingUp}
          color="bg-info"
        />
      </div>
  );
}
