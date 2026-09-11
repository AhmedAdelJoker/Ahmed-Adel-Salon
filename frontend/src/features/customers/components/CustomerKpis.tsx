/** Customers CustomerKpis (moved from Customers page, no logic changes). */
import { Star, TrendingUp, UserPlus, Users } from "lucide-react";
import { formatCurrency } from "@/lib/core/utils";
import CustomerKpi from "@/features/customers/components/CustomerKpi";

export default function CustomerKpis({
  totalCount,
  customers,
}: {
  totalCount: number;
  customers: any[];
}) {
  return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <CustomerKpi
          label="إجمالي المنظومة"
          value={totalCount || ""}
          icon={Users}
          color="bg-[#6D28D9]"
        />
        <CustomerKpi
          label="نخبة VIP"
          value={
            customers.filter(
              (customer) =>
                Number(customer.visits_count || customer.visits || 0) > 10,
            ).length || ""
          }
          icon={Star}
          color="bg-amber-500"
        />
        <CustomerKpi
          label="العملاء الجدد"
          value={
            customers.filter(
              (customer) =>
                Number(customer.visits_count || customer.visits || 0) <= 1,
            ).length || ""
          }
          icon={UserPlus}
          color="bg-emerald-600"
        />
        <CustomerKpi
          label="متوسط الإنفاق"
          value={
            formatCurrency(
              customers.length > 0
                ? customers.reduce(
                    (sum, c) =>
                      sum +
                      Number(
                        c.lifetime_spend || c.total_spend || c.totalSpend || 0,
                      ),
                    0,
                  ) / customers.length
                : 0,
            ) || ""
          }
          icon={TrendingUp}
          color="bg-blue-600"
        />
      </div>
  );
}
