import { Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { CurrencyStatCard, StatCard as StatCardDisplay } from "@/components/shared/DisplayComponents";
import { formatCurrency } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import { formatSignedPct } from "@/features/financial-reports/hooks/useFinancialReports";
import type { FinancialsState } from "@/types/reports";

export interface KpiRowProps {
  financials: FinancialsState;
}

export function KpiRow({ financials }: KpiRowProps) {
  const { t } = useTranslation("owner");
  return (
    <div data-stats-grid="true">
      <CurrencyStatCard
        label={t("finFeat.kpi.revenue")}
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
        hint={t("finFeat.kpi.revenueHint", { count: financials.invoiceCount, avg: formatCurrency(financials.avgTicket) })}
      />
      <CurrencyStatCard
        label={t("finFeat.kpi.expenses")}
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
        hint={t("finFeat.kpi.expensesHint", { count: financials.expenseCount, ratio: financials.expenseRatio.toFixed(1) })}
      />
      <CurrencyStatCard
        label={t("finFeat.kpi.net")}
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
        hint={t("finFeat.kpi.netHint", { margin: financials.margin.toFixed(1) })}
      />
      <StatCardDisplay
        label={t("finFeat.kpi.margin")}
        value={`${financials.margin.toFixed(1)}%`}
        icon={Target}
        variant="warning"
        hint={
          financials.growth.marginDelta === null
            ? financials.netProfit >= 0
              ? t("finFeat.kpi.positiveGain")
              : t("finFeat.kpi.needsReview")
            : t("finFeat.kpi.deltaHint", { delta: formatSignedPct(financials.growth.marginDelta) })
        }
      />
    </div>
  );
}
