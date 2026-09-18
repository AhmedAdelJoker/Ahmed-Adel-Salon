import { Activity, LayoutDashboard, Loader2, ShieldCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";
import {
  PageHeader,
  PremiumCard,
  SkeletonCard,
} from "@/components/shared/PremiumUI";
import { KPI_CONFIG, PERIODS } from "@/features/reports-dashboard/constants";
import { useReportsDashboard } from "@/features/reports-dashboard/hooks/useReportsDashboard";
import { KpiStats } from "@/features/reports-dashboard/components/KpiStats";
import { RevenueChart } from "@/features/reports-dashboard/components/RevenueChart";
import { ServiceDistribution } from "@/features/reports-dashboard/components/ServiceDistribution";
import { SmartInsights } from "@/features/reports-dashboard/components/SmartInsights";
import { QuickActions } from "@/features/reports-dashboard/components/QuickActions";

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const {
    stats,
    weeklyData,
    serviceDistribution,
    loading,
    period,
    chartType,
    isDemo,
    employeeId,
    employeeName,
    displayName,
    scopeLabel,
    chartRows,
    loadData,
    handlePeriodChange,
    setChartType,
  } = useReportsDashboard();

  if (loading && weeklyData.length === 0 && serviceDistribution.length === 0) {
    return (
      <div className="erp-page space-y-8 pb-8" dir="rtl" aria-busy="true" aria-live="polite">
        <PageHeader
          title={`أهلاً بك، ${displayName}`}
          subtitle={scopeLabel}
          badge="لوحة القيادة التنفيذية"
          icon={LayoutDashboard}
          actions={undefined}
          className={undefined}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="جاري تحميل الإحصائيات">
          {KPI_CONFIG.map((kpi) => (
            <SkeletonCard key={kpi.key} variant="stats" className={undefined} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 mt-8">
          <PremiumCard className="xl:col-span-2" noPadding>
            <SkeletonCard variant="chart" height={400} className={undefined} />
          </PremiumCard>
          <div className="space-y-6">
            <PremiumCard className="h-full min-h-[400px]">
              <SkeletonCard variant="chart" height={400} className={undefined} />
            </PremiumCard>
            <PremiumCard className={undefined}>
              <SkeletonCard variant="content" className={undefined} />
            </PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-6 pb-8" dir="rtl" aria-busy={loading} aria-live="polite">
      <PageHeader
        title={`أهلاً بك، ${displayName}`}
        subtitle={scopeLabel}
        badge="لوحة القيادة التنفيذية"
        icon={LayoutDashboard}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="h-10 rounded-xl" aria-label="اختيار الفترة">
                <SelectValue placeholder="الفترة" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={employeeId ? "outline" : "primary"}
              onClick={() => navigate("/owner")}
              className="h-10 rounded-xl px-4 hidden sm:inline-flex"
            >
              المكتب الرئيسي
            </Button>
            {employeeId && (
              <Badge variant="info" size="sm" className="rounded-xl px-3 py-1.5">
                {employeeName || `الموظف #${employeeId}`}
              </Badge>
            )}
            <Button onClick={loadData} variant="outline" className="h-10 rounded-xl" disabled={loading} aria-label="تحديث البيانات">
              <Loader2 className={cn("ml-2 h-4 w-4", loading ? "animate-spin" : "")} aria-hidden="true" />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
          </div>
        }
        className={undefined}
      />

      {/* Demo Banner — توكنز الثيم */}
      {isDemo && !loading && (
        <div className="rounded-2xl border border-warning/20 bg-warning-soft px-4 py-3 flex items-center gap-3 text-warning">
          <Activity size={18} className="shrink-0 animate-pulse" />
          <p className="text-xs font-bold">وضع العرض التوضيحي — لا توجد بيانات حقيقية للفترة الحالية. يتم عرض أرقام توضيحية لتوضيح شكل اللوحة.</p>
        </div>
      )}

      {/* KPI Stats */}
      <KpiStats stats={stats} />

      {/* شريط هوية — انتقال سريع (مرحلة 3) */}
      <PremiumCard className="p-0 overflow-hidden" hoverable={false} animate={false}>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-muted uppercase ml-2">
            <LayoutDashboard size={12} className="text-accent" /> انتقال سريع
          </span>
          {[
            { label: "الموارد البشرية", desc: "الكادر والرواتب", icon: Users, href: "/owner/hr", color: "bg-primary text-white" },
            { label: "الرواتب", desc: "المستحقات والسلف", icon: Wallet, href: "/owner/payroll", color: "bg-success text-white" },
            { label: "الأمان", desc: "الصلاحيات والجلسات", icon: ShieldCheck, href: "/owner/security-access", color: "bg-info text-white" },
            { label: "التشغيل", desc: "التقارير اليومية", icon: TrendingUp, href: "/owner/reports", color: "bg-warning text-white" },
          ].map((l) => (
            <button
              key={l.href}
              onClick={() => navigate(l.href)}
              className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-right hover:border-accent/20 hover:bg-soft transition-colors group"
            >
              <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", l.color)}>
                <l.icon size={14} />
              </span>
              <span className="text-right">
                <span className="block text-xs font-black text-main group-hover:text-accent transition-colors">{l.label}</span>
                <span className="block text-[10px] font-bold text-muted leading-none">{l.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </PremiumCard>

      {/* Main Charts & Insights */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue Chart */}
        <RevenueChart
          chartRows={chartRows}
          chartType={chartType}
          onChartTypeChange={setChartType}
          period={period}
          onPeriodChange={handlePeriodChange}
        />

        {/* Service Distribution & Insights */}
        <div className="space-y-6">
          {/* Service Distribution */}
          <ServiceDistribution serviceDistribution={serviceDistribution} occupancy={stats.occupancy} />

          {/* Smart Insights */}
          <SmartInsights newCustomersThisWeek={stats.newCustomersThisWeek} onNavigate={navigate} />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions onNavigate={navigate} />
    </div>
  );
}
