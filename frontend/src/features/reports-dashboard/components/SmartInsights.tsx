import { Activity, AlertTriangle, Target, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ContentPanel } from "@/components/shared/PremiumUI";
import { formatCurrency } from "@/lib/core/utils";
import { InsightCard } from "@/features/reports-dashboard";
import type { CancellationStats, DailyPoint } from "@/features/reports-dashboard";

export interface SmartInsightsProps {
  newCustomersThisWeek: number | undefined;
  onNavigate: (to: string) => void;
  cancellations?: CancellationStats | null;
  daily?: DailyPoint[] | null;
}

export function SmartInsights({
  newCustomersThisWeek,
  onNavigate,
  cancellations,
  daily,
}: SmartInsightsProps) {
  const { t } = useTranslation("owner");
  const bestDay =
    daily && daily.length > 0
      ? daily.reduce((top, d) => (d.revenue > top.revenue ? d : top), daily[0])
      : null;

  return (
    <ContentPanel className="border-primary/10 bg-primary/5" title={undefined} subtitle={undefined} actions={undefined}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <Target size={20} />
        </div>
        <Badge variant="primary" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
          <Activity size={10} className="ms-1 animate-pulse" /> {t("smartInsights.badge")}
        </Badge>
      </div>
      <div className="space-y-4">
        <InsightCard
          icon={AlertTriangle}
          iconColor="warning"
          title={t("smartInsights.cancellationRateTitle")}
          description={
            cancellations
              ? cancellations.rate != null
                ? t("smartInsights.cancellationRateValue", {
                    count: cancellations.count,
                    total: cancellations.total,
                    rate: cancellations.rate,
                  })
                : t("smartInsights.cancellationRateNoData")
              : t("smartInsights.cancellationRateFailed")
          }
          actionLabel={t("smartInsights.reviewCancelled")}
          onAction={() => onNavigate("/bookings?quickFilter=cancelled")}
        />
        <InsightCard
          icon={TrendingUp}
          iconColor="success"
          title={t("smartInsights.bestDayTitle")}
          description={
            bestDay && bestDay.revenue > 0
              ? t("smartInsights.bestDayValue", {
                  date: bestDay.date,
                  revenue: formatCurrency(bestDay.revenue),
                  appointments: bestDay.appointments,
                })
              : t("smartInsights.bestDayNoData")
          }
          actionLabel={t("smartInsights.viewOperationalReports")}
          onAction={() => onNavigate("/owner/reports")}
        />
        <InsightCard
          icon={Users}
          iconColor="info"
          title={t("smartInsights.newCustomersTitle")}
          description={t("smartInsights.newCustomersBody", {
            count: newCustomersThisWeek ?? 0,
          })}
          actionLabel={t("smartInsights.viewCustomers")}
          onAction={() => onNavigate("/customers")}
        />
      </div>
    </ContentPanel>
  );
}
