import { Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { ChartCard, CurrencyStatCard, StatCard as StatCardDisplay } from "@/components/shared/DisplayComponents";
import { formatCurrency } from "@/lib/core/utils";
import { formatSignedPct } from "@/features/financial-reports/hooks/useFinancialReports";
import type { FinancialsState } from "@/types/reports";

export interface KpiRowProps {
  financials: FinancialsState;
}

export function KpiRow({ financials }: KpiRowProps) {
  return (
    <div data-stats-grid="true">
      <CurrencyStatCard
        label="إجمالي الإيرادات"
        value={financials.revenue}
        icon={TrendingUp}
        variant="success"
        trend={
          financials.growth.revenue === null
            ? undefined
            : financials.growth.revenue >= 0
              ? "positive"
              : "negative"
        }
        trendValue={
          financials.growth.revenue === null ? undefined : formatSignedPct(financials.growth.revenue)
        }
        hint={`${financials.invoiceCount} فاتورة • متوسط ${formatCurrency(financials.avgTicket)}`}
      />
      <CurrencyStatCard
        label="إجمالي المصروفات"
        value={financials.expenses}
        icon={TrendingDown}
        variant="danger"
        trend={
          financials.growth.expenses === null
            ? undefined
            : financials.growth.expenses > 0
              ? "negative"
              : "positive"
        }
        trendValue={
          financials.growth.expenses === null ? undefined : formatSignedPct(financials.growth.expenses)
        }
        hint={`${financials.expenseCount} بند • ${financials.expenseRatio.toFixed(1)}% من الإيراد`}
      />
      <CurrencyStatCard
        label="صافي الربح"
        value={financials.netProfit}
        icon={Wallet}
        trend={
          financials.growth.net === null
            ? financials.netProfit >= 0
              ? "positive"
              : "negative"
            : financials.growth.net >= 0
              ? "positive"
              : "negative"
        }
        trendValue={financials.growth.net === null ? undefined : formatSignedPct(financials.growth.net)}
        variant="primary"
        hint={`هامش ${financials.margin.toFixed(1)}%`}
      />
      <StatCardDisplay
        label="هامش الربح"
        value={`${financials.margin.toFixed(1)}%`}
        icon={Target}
        variant="warning"
        hint={
          financials.growth.marginDelta === null
            ? financials.netProfit >= 0
              ? "أداء موجب"
              : "يحتاج مراجعة"
            : `Δ ${formatSignedPct(financials.growth.marginDelta)} نقطة مئوية عن الفترة السابقة`
        }
      />
    </div>
  );
}
