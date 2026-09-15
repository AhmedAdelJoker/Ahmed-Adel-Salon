import { Activity, LayoutDashboard, Loader2 } from "lucide-react";
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
      <div className="erp-page space-y-8 pb-8" dir="rtl">
        <PageHeader
          title={`أهلاً بك، ${displayName}`}
          subtitle={scopeLabel}
          badge="لوحة القيادة التنفيذية"
          icon={LayoutDashboard}
          actions={undefined}
          className={undefined}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {KPI_CONFIG.map((_, idx) => (
            <SkeletonCard key={idx} variant="stats" className={undefined} />
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
    <div className="erp-page space-y-6 pb-8" dir="rtl">
      <PageHeader
        title={`أهلاً بك، ${displayName}`}
        subtitle={scopeLabel}
        badge="لوحة القيادة التنفيذية"
        icon={LayoutDashboard}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="h-10 rounded-xl">
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
            <Button onClick={loadData} variant="outline" className="h-10 rounded-xl" disabled={loading}>
              <Loader2 className={cn("ml-2 h-4 w-4", loading ? "animate-spin" : "")} />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
          </div>
        }
        className={undefined}
      />

      {/* Demo Banner */}
      {isDemo && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 flex items-center gap-3 text-amber-800 dark:text-amber-200" dir="rtl">
          <Activity size={18} className="shrink-0 animate-pulse" />
          <p className="text-xs font-bold">وضع العرض التوضيحي — لا توجد بيانات حقيقية للفترة الحالية. يتم عرض أرقام توضيحية لتوضيح شكل اللوحة.</p>
        </div>
      )}

      {/* KPI Stats */}
      <KpiStats stats={stats} />

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
