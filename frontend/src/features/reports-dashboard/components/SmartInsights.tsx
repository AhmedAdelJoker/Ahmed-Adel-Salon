import { Activity, AlertTriangle, Target, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContentPanel } from "@/components/shared/PremiumUI";
import { InsightCard } from "@/features/reports-dashboard";

export interface SmartInsightsProps {
  newCustomersThisWeek: number | undefined;
  onNavigate: (to: string) => void;
}

export function SmartInsights({ newCustomersThisWeek, onNavigate }: SmartInsightsProps) {
  return (
    <ContentPanel className="border-primary/10 bg-primary/5" title={undefined} subtitle={undefined} actions={undefined}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <Target size={20} />
        </div>
        <Badge variant="primary" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
          <Activity size={10} className="ml-1 animate-pulse" /> رؤى ذكية
        </Badge>
      </div>
      <div className="space-y-4">
        <InsightCard
          icon={AlertTriangle}
          iconColor="warning"
          title="معدل الإلغاء مرتفع"
          description="معدل الحجوزات الملغاة وصل ١٥٪ هذا الأسبوع. يُنصح بتفعيل التأكيد التلقائي قبل ٣ ساعات."
          actionLabel="إعداد التذكيرات"
          onAction={() => onNavigate("/owner/settings?tab=reminders")}
        />
        <InsightCard
          icon={TrendingUp}
          iconColor="success"
          title="فرصة نمو المسائية"
          description="الفترة المسائية (٦-١٠ م) تحقق ٤٠٪ من الإيرادات بسعة ٦٠٪ فقط. فرصة لزيادة الحجوزات."
          actionLabel="عرض جدول المواعيد"
          onAction={() => onNavigate("/schedule?range=evening")}
        />
        <InsightCard
          icon={Users}
          iconColor="info"
          title="عملاء جدد هذا الأسبوع"
          description={`${newCustomersThisWeek ?? 12} عميل جديد. معدل الاحتفاظ ٦٨٪ - أعلى من المتوسط.`}
          actionLabel="عرض العملاء"
          onAction={() => onNavigate("/customers")}
        />
      </div>
    </ContentPanel>
  );
}
