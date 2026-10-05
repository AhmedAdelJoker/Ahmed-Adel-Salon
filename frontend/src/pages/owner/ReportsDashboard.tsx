import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import i18n from "@/i18n";
import {
  Activity,
  AlertTriangle,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Wallet,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader, PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/core/utils";

import { PERIODS } from "@/features/reports-dashboard/constants";
import { useReportsDashboard } from "@/features/reports-dashboard/hooks/useReportsDashboard";
import { useOperatingSummary } from "@/features/reports-dashboard/hooks/useOperatingSummary";
import {
  DayStatusBar,
  Delta,
  NeedsAttention,
  RankingTable,
  RevenueChart,
  RevenueSparkline,
  SmartInsights,
} from "@/features/reports-dashboard";

/**
 * `/owner` -- executive cockpit.
 *
 * Rebuilt around one question per band, top to bottom:
 *
 *   1. What needs a decision?          (NeedsAttention, /owner/alerts)
 *   2. Is the salon trading, and how?   (DayStatusBar)
 *   3. How did today go, against the
 *      days before it?                  (KPI row + RevenueSparkline)
 *   4. Who and what is carrying it?     (RankingTable x2)
 *
 * That order is the difference between this and the previous layout, which put
 * the revenue chart above the fold and the things requiring action at the bottom.
 *
 * Two requests, not one: `useReportsDashboard` owns the period-scoped KPIs and
 * the demo-mode decision, `useOperatingSummary` owns the always-current trading
 * state. They are kept apart so the period selector cannot change what "open
 * right now" means, and so each can say which sections it has.
 *
 * Density is the point. Rows are tight, figures are tabular, and every panel is
 * a table or a strip rather than a card with a shadow. Nothing here is a
 * placeholder: a section that could not be loaded says so, and a section that is
 * genuinely empty says what was checked.
 */
export default function ReportsDashboard() {
  const navigate = useNavigate();
  const dir = i18n.dir() as "rtl" | "ltr";

  const {
    stats,
    weeklyData,
    serviceDistribution,
    loading,
    period,
    chartType,
    isDemo,
    loadError,
    employeeId,
    employeeName,
    displayName,
    scopeLabel,
    chartRows,
    loadData,
    handlePeriodChange,
    setChartType,
  } = useReportsDashboard();

  const { summary, loading: opsLoading, failures, error: opsError, reload: reloadOps } =
    useOperatingSummary(14);

  const busy = loading || opsLoading;

  // Today's revenue against the mean of the days before it. Null when there is no
  // baseline, which renders as "لا مقارنة" rather than a confident percentage.
  const todayVsBaseline = useMemo(() => {
    const today = summary?.daily?.find((d) => d.is_today);
    const baseline = summary?.previous_window_average;
    if (!today || baseline == null || baseline <= 0) return null;
    return ((today.revenue - baseline) / baseline) * 100;
  }, [summary]);

  const topBarbers = useMemo(
    () =>
      summary?.top_barbers?.map((b) => ({
        name: b.name,
        revenue: b.revenue,
        count: b.invoices,
        countLabel: "فاتورة",
      })) ?? null,
    [summary],
  );

  const topServices = useMemo(
    () =>
      summary?.top_services?.map((s) => ({
        name: s.name,
        revenue: s.revenue,
        count: s.count,
        countLabel: "مرة",
      })) ?? null,
    [summary],
  );

  const kpis = useMemo(
    () => [
      {
        key: "todayRevenue",
        label: "إيراد اليوم",
        value: stats.todayRevenue,
        icon: Wallet,
        trend: stats.todayRevenueTrend,
        money: true,
      },
      {
        key: "netProfit",
        label: "صافي الربح",
        value: stats.netProfit,
        icon: Activity,
        trend: stats.netProfitTrend,
        money: true,
      },
      {
        key: "todayAppointments",
        label: "مواعيد اليوم",
        value: stats.todayAppointments,
        icon: LayoutDashboard,
        trend: stats.todayAppointmentsTrend,
        money: false,
      },
      {
        key: "occupancy",
        label: "الإشغال",
        value: stats.occupancy,
        icon: Zap,
        trend: null,
        money: false,
        percent: true,
      },
    ],
    [stats],
  );

  if (loading && weeklyData.length === 0 && serviceDistribution.length === 0) {
    return (
      <div className="erp-page space-y-4 pb-8" dir={dir} aria-busy="true" aria-live="polite">
        <PageHeader
          title={`أهلاً بك، ${displayName}`}
          subtitle={scopeLabel}
          badge="لوحة القيادة التنفيذية"
          icon={LayoutDashboard}
          actions={undefined}
          className={undefined}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <SkeletonCard key={kpi.key} variant="stats" className={undefined} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard variant="content" className={undefined} />
          <SkeletonCard variant="content" className={undefined} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="erp-page space-y-4 pb-8"
      dir={dir}
      aria-busy={busy}
      aria-live="polite"
    >
      <PageHeader
        title={`أهلاً بك، ${displayName}`}
        subtitle={scopeLabel}
        badge="لوحة القيادة"
        icon={LayoutDashboard}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="h-9 rounded-xl" aria-label="اختيار الفترة">
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

            {employeeId && (
              <Badge variant="info" size="sm" className="rounded-xl px-3 py-1.5">
                {employeeName || `الموظف #${employeeId}`}
              </Badge>
            )}

            <Button
              onClick={() => {
                loadData();
                reloadOps();
              }}
              variant="outline"
              className="h-9 rounded-xl"
              disabled={busy}
              aria-label="تحديث البيانات"
            >
              <Loader2
                className={cn("ms-1.5 h-3.5 w-3.5", busy && "animate-spin")}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
          </div>
        }
        className={undefined}
      />

      {/* 1. Needs a decision. */}
      <NeedsAttention onNavigate={navigate} />

      {/* 2. Is the salon trading. */}
      <DayStatusBar
        status={summary?.day_status ?? null}
        unavailable={failures.status || Boolean(opsError)}
        className={undefined}
      />

      {/* Load failures, stated once and precisely. */}
      {loadError && !loading && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-2.5 text-danger">
          <AlertTriangle size={16} className="shrink-0" />
          <p className="min-w-[200px] flex-1 text-[11px] font-bold">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadData} className="shrink-0">
            <RefreshCw size={13} className="ms-1.5" />
            إعادة المحاولة
          </Button>
        </div>
      )}

      {opsError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-2.5 text-danger">
          <AlertTriangle size={16} className="shrink-0" />
          <p className="min-w-[200px] flex-1 text-[11px] font-bold">{opsError}</p>
          <Button variant="outline" size="sm" onClick={reloadOps} className="shrink-0">
            <RefreshCw size={13} className="ms-1.5" />
            إعادة المحاولة
          </Button>
        </div>
      )}

      {isDemo && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning-soft px-4 py-2.5 text-warning">
          <Activity size={16} className="shrink-0 animate-pulse" />
          <p className="text-[11px] font-bold">
            وضع العرض التوضيحي — لا توجد بيانات حقيقية للفترة الحالية.
          </p>
        </div>
      )}

      {/* 3. Today against the days before it. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCell
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            trend={kpi.trend}
            money={kpi.money}
            percent={kpi.percent}
            demo={isDemo}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <PremiumCard className="lg:col-span-2 p-0 overflow-hidden" hoverable={false} animate={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">
              اتجاه الإيراد · 14 يوماً
            </h3>
            <Delta value={todayVsBaseline} className={undefined} />
          </div>
          <div className="p-4">
            <RevenueSparkline
              data={summary?.daily ?? []}
              baseline={summary?.previous_window_average ?? null}
              unavailable={failures.daily || Boolean(opsError)}
              className={undefined}
            />
          </div>
        </PremiumCard>

        <div className="flex flex-col gap-3">
          <MiniPanel
            title="ملخّص الفترة"
            loading={loading}
            rows={[
              { label: "المصروفات", value: stats.todayExpenses, money: true },
              { label: "متوسط الفاتورة", value: stats.avgInvoice, money: true },
              { label: "هدف الشهر", value: stats.monthGoal, percent: true },
              { label: "عملاء جدد", value: stats.newCustomersThisWeek ?? 0 },
            ]}
          />
        </div>
      </div>

      {/* 4. Who and what is carrying it. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RankingTable
          title="الأعلى إيراداً"
          rows={topBarbers}
          unavailable={failures.barbers || Boolean(opsError)}
          emptyMessage="لم تُسجَّل فواتير موصوفة بموظف في هذه الفترة"
          className={undefined}
        />
        <RankingTable
          title="الخدمات الأعلى مبيعاً"
          rows={topServices}
          unavailable={failures.services || Boolean(opsError)}
          emptyMessage="لم تُسجَّل بيانات مبيعات في هذه الفترة"
          className={undefined}
        />
      </div>

      {/* 5. Period analysis. Kept below the cockpit bands because it answers a
          question you go looking for, rather than one you check on the way in.
          The sparkline above is the glanceable version of the same story. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <RevenueChart
          chartRows={chartRows}
          chartType={chartType}
          onChartTypeChange={setChartType}
          period={period}
          onPeriodChange={handlePeriodChange}
        />
        <div className="xl:col-span-1">
          <SmartInsights
            newCustomersThisWeek={stats.newCustomersThisWeek}
            onNavigate={navigate}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * One KPI cell, 28px padding instead of a card.
 *
 * `value` may be null, which means the server could not compute it. That renders
 * as an em dash with the reason underneath rather than as 0.
 */
function KpiCell({
  label,
  value,
  icon: Icon,
  trend,
  money = false,
  percent = false,
  demo = false,
}: {
  label: string;
  value: number | null | undefined;
  icon: any;
  trend: number | null | undefined;
  money?: boolean;
  percent?: boolean;
  demo?: boolean;
}) {
  const unknown = value === null || value === undefined;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-accent/25">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted">
          <Icon size={11} className="text-accent" />
          {label}
        </span>
        {trend !== undefined && !unknown && <Delta value={trend} className={undefined} />}
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn(
            "text-xl font-black tabular-nums tracking-tight",
            unknown ? "text-muted" : "text-main",
          )}
        >
          {unknown
            ? "—"
            : money
              ? formatCurrency(value)
              : percent
                ? `${value}%`
                : Number(value).toLocaleString("ar-EG-u-nu-latn")}
        </span>
      </div>

      {unknown && (
        <p className="mt-0.5 text-[9px] font-bold text-muted">تعذّر الحساب</p>
      )}
      {demo && !unknown && (
        <p className="mt-0.5 text-[9px] font-bold text-warning">رقم توضيحي</p>
      )}
    </div>
  );
}

function MiniPanel({
  title,
  rows,
  loading,
}: {
  title: string;
  loading: boolean;
  rows: { label: string; value: number | null | undefined; money?: boolean; percent?: boolean }[];
}) {
  return (
    <PremiumCard className="p-0 overflow-hidden" hoverable={false} animate={false}>
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">
          {title}
        </h3>
      </div>
      <dl className="divide-y divide-border/50">
        {rows.map((row) => {
          const unknown = row.value === null || row.value === undefined;
          return (
            <div key={row.label} className="flex items-center justify-between px-4 py-2">
              <dt className="text-[10px] font-bold text-muted">{row.label}</dt>
              <dd className="text-[11px] font-black tabular-nums text-main">
                {loading || unknown
                  ? "—"
                  : row.money
                    ? formatCurrency(row.value)
                    : row.percent
                      ? `${row.value}%`
                      : Number(row.value).toLocaleString("ar-EG-u-nu-latn")}
              </dd>
            </div>
          );
        })}
      </dl>
    </PremiumCard>
  );
}