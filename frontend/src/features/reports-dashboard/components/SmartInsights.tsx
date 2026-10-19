import { Activity, AlertTriangle, Target, TrendingUp, Users } from "lucide-react";
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
          <Activity size={10} className="ms-1 animate-pulse" /> رؤى ذكية
        </Badge>
      </div>
      <div className="space-y-4">
        <InsightCard
          icon={AlertTriangle}
          iconColor="warning"
          title="معدل الإلغاء"
          description={
            cancellations
              ? cancellations.rate != null
                ? `أُلغي ${cancellations.count} من ${cancellations.total} حجزًا خلال آخر 14 يومًا (معدل ${cancellations.rate}%).`
                : "لا توجد حجوزات في الفترة الحالية لحساب معدل الإلغاء."
              : "تعذّر حساب معدل الإلغاء الآن."
          }
          actionLabel="مراجعة الحجوزات الملغاة"
          onAction={() => onNavigate("/bookings?quickFilter=cancelled")}
        />
        <InsightCard
          icon={TrendingUp}
          iconColor="success"
          title="أفضل يوم في الفترة"
          description={
            bestDay && bestDay.revenue > 0
              ? `${bestDay.date} — ${formatCurrency(bestDay.revenue)} عبر ${bestDay.appointments} حجزًا.`
              : "لم تُسجَّل مبيعات في الفترة الحالية."
          }
          actionLabel="عرض التقارير التشغيلية"
          onAction={() => onNavigate("/owner/reports")}
        />
        <InsightCard
          icon={Users}
          iconColor="info"
          title="عملاء جدد هذا الأسبوع"
          description={`${newCustomersThisWeek ?? 0} عميلًا جديدًا. راجع قائمة العملاء لمتابعتهم.`}
          actionLabel="عرض العملاء"
          onAction={() => onNavigate("/customers")}
        />
      </div>
    </ContentPanel>
  );
}
