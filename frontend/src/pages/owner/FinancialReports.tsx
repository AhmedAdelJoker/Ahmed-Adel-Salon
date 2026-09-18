import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  BarChart3,
  BellRing,
  Calculator,
  Calendar,
  CalendarRange,
  ChevronDown,
  CreditCard,
  Download,
  FileDown,
  FileSpreadsheet,
  History,
  Info,
  LayoutGrid,
  PieChart as PieChartIcon,
  Play,
  Printer,
  Receipt,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { staticURL } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AIInsights from "@/components/AIInsights";
import { cn, formatCurrency, formatDateTime } from "@/lib/core/utils";
import {
  ContentPanel,
  PageHeader,
  PremiumCard,
  SkeletonCard,
} from "@/components/shared/PremiumUI";
import {
  ChartCard,
  CurrencyStatCard,
  StatCard as StatCardDisplay,
} from "@/components/shared/DisplayComponents";
import {
  AnomalyAlerts,
  CHART_COLORS,
  DrilldownPanel,
  FinanceTooltip,
  MonthlyTargetProgress,
  PRESETS,
  compactTick,
  formatSignedPct,
  useFinancialReports,
} from "@/features/financial-reports";

const REPORT_EXPORTS = [
  {
    title: "التدقيق الاستراتيجي للنمو",
    desc: "تقرير شامل يجمع الأداء المالي والخدمات الأكثر ربحية وإنتاجية الفريق بنظرة استراتيجية.",
    details: "يتضمن: ملخص KPIs، قائمة Top 5 خدمات، ترتيب أداء الموظفين.",
    icon: Sparkles,
    color: "text-purple-600 bg-purple-500/10",
    format: "PREMIUM PDF",
    endpoint: "/exports/reports/strategic-growth/pdf",
    type: "pdf" as const,
    file: "strategic_growth_report",
  },
  {
    title: "تقرير الإيرادات التفصيلي",
    desc: "كشف محاسبي بالمبيعات والتحصيلات مفصلاً حسب طريقة الدفع لمطابقة الخزينة.",
    details: "يتضمن: التاريخ، رقم الفاتورة، العميل، طريقة الدفع، القيمة الصافية.",
    icon: FileSpreadsheet,
    color: "text-indigo-600 bg-indigo-500/10",
    format: "EXCEL SHEET",
    endpoint: "/exports/reports/revenue/excel",
    type: "excel" as const,
    file: "revenue_report",
  },
  {
    title: "كشف ميزان العمليات اليومي",
    desc: "سجل زمني دقيق للحركات النقدية اليومية خلال الفترة المختارة لضمان دقة الأرشفة.",
    details: "يتضمن: تفصيل الحركات اليومية وإجمالي الوارد والصادر لكل يوم.",
    icon: History,
    color: "text-amber-600 bg-amber-500/10",
    format: "ACCOUNTING PDF",
    endpoint: "/exports/reports/daily/pdf",
    type: "pdf" as const,
    file: "daily_operations_report",
  },
];

export default function FinancialReports() {
  const {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    preset,
    loading,
    refreshing,
    hasLoaded,
    loadError,
    exporting,
    lastUpdated,
    financials,
    monthly,
    monthlyLoading,
    monthlyLoaded,
    autoRefresh,
    setAutoRefresh,
    monthlyTarget,
    editingTarget,
    setEditingTarget,
    targetDraft,
    setTargetDraft,
    savingTarget,
    schedules,
    schedLoading,
    schedBusyId,
    schedFreq,
    setSchedFreq,
    schedChannel,
    setSchedChannel,
    schedPhone,
    setSchedPhone,
    canEditTarget,
    hasData,
    paymentsWithPct,
    topPayment,
    topExpense,
    topDays,
    maxDayNet,
    monthStart,
    isCurrentMonth,
    currentMonthRevenue,
    targetProgress,
    selectedDay,
    setSelectedDay,
    selectedExpenseCategory,
    setSelectedExpenseCategory,
    selectedPayment,
    setSelectedPayment,
    dayInvoices,
    dayExpenses,
    anomalies,
    anomalyDates,
    paymentInvoices,
    categoryMovements,
    forecast,
    aiInsights,
    fetchFinancials,
    fetchSixMonths,
    applyPreset,
    handleCreateSchedule,
    handleToggleSchedule,
    handleDeleteSchedule,
    handleRunScheduleNow,
    handleSaveTarget,
    handleExport,
    handleExportDay,
    handleExportCategory,
    handleExportPayment,
  } = useFinancialReports();

  const [activeTab, setActiveTab] = useState("overview");
  const [showPrev, setShowPrev] = useState(false);
  const [showQuick, setShowQuick] = useState(true);

  const drillOpen = Boolean(selectedDay || selectedExpenseCategory || selectedPayment);
  const closeDrill = () => {
    setSelectedDay(null);
    setSelectedExpenseCategory(null);
    setSelectedPayment(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleInspectAnomalyDay = (date: string) => {
    const t = financials.dailyTrends.find((d) => d.date === date);
    if (t) {
      setSelectedExpenseCategory(null);
      setSelectedPayment(null);
      setSelectedDay(t);
    }
  };

  if (loading && !hasLoaded) {
    return (
      <div className="erp-page-container space-y-6 pb-16">
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Sparkles className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted">
            جاري معالجة البيانات المالية...
          </p>
        </div>
        <div data-stats-grid="true">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SkeletonCard variant="chart" className="lg:col-span-2" height={320} />
          <SkeletonCard variant="chart" height={320} />
        </div>
      </div>
    );
  }

  if (loadError && !hasData && hasLoaded) {
    return (
      <div className="erp-page-container space-y-6 pb-16">
        <PageHeader
          title="التقارير المالية"
          subtitle="مراقبة الأرباح والتدفقات النقدية ومؤشرات الأداء."
          badge="الرقابة المالية"
          icon={Banknote}
        />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-lg font-black text-main">تعذر تحميل البيانات المالية</p>
            <p className="max-w-md text-sm font-bold text-muted">
              تحقق من الاتصال بالخادم ثم أعد المحاولة. النطاق الحالي: {fromDate} إلى {toDate}.
            </p>
            <Button onClick={fetchFinancials} loading={refreshing}>
              <RefreshCw size={16} /> إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quickMetrics = [
    { icon: Receipt, label: "عدد الفواتير", value: String(financials.invoiceCount) },
    { icon: Calculator, label: "متوسط الفاتورة", value: formatCurrency(financials.avgTicket) },
    { icon: CreditCard, label: "أعلى وسيلة تحصيل", value: topPayment ? topPayment.label : "—" },
    {
      icon: Activity,
      label: "أفضل يوم (صافي)",
      value: financials.bestDay ? formatCurrency(financials.bestDay.net) : "—",
    },
  ];

  return (
    <div className="erp-page-container space-y-6 pb-16">
      <PageHeader
        title="التقارير المالية"
        subtitle="مراقبة الأرباح والتدفقات النقدية ومؤشرات الأداء بدقة عالية."
        badge="الرقابة المالية"
        icon={Banknote}
      />

      {/* Sticky filter bar — glass, same language as DailySummary header */}
      <div className="sticky top-0 z-20 rounded-[1.5rem] border border-border/60 bg-card/85 p-3 shadow-soft backdrop-blur-md print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="نطاقات زمنية سريعة"
          >
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                aria-pressed={preset === p.id}
                className={cn(
                  "h-9 rounded-xl border px-4 text-[11px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  preset === p.id
                    ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                    : "border-border bg-card text-muted hover:border-primary/40 hover:text-main",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-sm xl:flex-none">
              <label className="flex items-center gap-2 px-2">
                <Calendar size={14} className="shrink-0 text-muted" />
                <span className="sr-only">من تاريخ</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                  }}
                  aria-label="من تاريخ"
                  className="h-8 w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
                />
              </label>
              <span className="h-5 w-px bg-border" aria-hidden="true" />
              <label className="flex items-center gap-2 px-2">
                <Calendar size={14} className="shrink-0 text-muted" />
                <span className="sr-only">إلى تاريخ</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                  }}
                  aria-label="إلى تاريخ"
                  className="h-8 w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
                />
              </label>
            </div>
            <Button
              onClick={fetchFinancials}
              loading={refreshing}
              className="h-10 gap-2 px-5 text-xs font-black"
            >
              <RefreshCw size={15} /> تحديث
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="h-10 gap-2 px-4 text-xs font-black"
              title="طباعة التقرير أو حفظه PDF"
            >
              <Printer size={15} /> طباعة / PDF
            </Button>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[11px] font-black text-muted">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="تحديث تلقائي" />
              تلقائي
            </label>
          </div>
        </div>
        <p className="mt-2 px-1 text-[10px] font-bold tabular-nums text-muted">
          آخر تدقيق: {formatDateTime(lastUpdated)} • النطاق {fromDate} إلى {toDate}
          {financials.prevRange && (
            <> • مقارنة بالفترة {financials.prevRange.from} إلى {financials.prevRange.to}</>
          )}
        </p>
      </div>

      {/* KPI row — unified stat cards */}
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
            financials.growth.revenue === null
              ? undefined
              : formatSignedPct(financials.growth.revenue)
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
            financials.growth.expenses === null
              ? undefined
              : formatSignedPct(financials.growth.expenses)
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
          trendValue={
            financials.growth.net === null ? undefined : formatSignedPct(financials.growth.net)
          }
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

      {/* Quick metrics — collapsible */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setShowQuick((v) => !v)}
            aria-expanded={showQuick}
            className="flex w-full items-center justify-between gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="text-xs font-black uppercase tracking-widest text-muted">
              مؤشرات سريعة
            </span>
            <ChevronDown
              size={16}
              className={cn("text-muted transition-transform", showQuick && "rotate-180")}
            />
          </button>
          {showQuick && (
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quickMetrics.map((m) => (
                <div
                  key={m.label}
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-soft/60 p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                    <m.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black uppercase tracking-widest text-muted">
                      {m.label}
                    </p>
                    <p className="truncate text-sm font-black tabular-nums text-main" title={m.value}>
                      {m.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main tabs — same pattern as Settings / HRManagement */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto p-1.5 print:hidden">
          <TabsTrigger value="overview" className="gap-1.5 text-xs font-black">
            <LayoutGrid size={14} /> نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-1.5 text-xs font-black">
            <Activity size={14} /> التدفقات والتحصيل
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5 text-xs font-black">
            <Wallet size={14} /> المصروفات
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5 text-xs font-black">
            <Zap size={14} /> التوقعات
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs font-black">
            <BellRing size={14} /> التقارير والجدولة
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <MonthlyTargetProgress
            monthlyTarget={monthlyTarget}
            currentMonthRevenue={currentMonthRevenue}
            targetProgress={targetProgress}
            monthStart={monthStart}
            toDate={toDate}
            editingTarget={editingTarget}
            targetDraft={targetDraft}
            savingTarget={savingTarget}
            canEditTarget={canEditTarget}
            disabledReason={
              isCurrentMonth
                ? null
                : "النطاق المختار خارج الشهر الحالي — اختر نطاقاً يشمل الشهر الحالي لمتابعة الهدف لحظياً."
            }
            onTargetDraftChange={setTargetDraft}
            onEditTarget={() => setEditingTarget(true)}
            onCancelEditTarget={() => {
              setEditingTarget(false);
              setTargetDraft(String(Math.round(monthlyTarget)));
            }}
            onSaveTarget={handleSaveTarget}
          />

          <AnomalyAlerts anomalies={anomalies} onInspectDay={handleInspectAnomalyDay} />

          <ContentPanel
            title={
              <span className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" /> أفضل الأيام صافياً
              </span>
            }
            subtitle="أعلى 5 أيام ربحية من البيانات اليومية الحقيقية — اضغط أي يوم لعرض تفاصيله"
          >
            {!topDays.length || !hasData ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Calendar size={26} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد أيام للعرض بعد</p>
                <p className="text-xs font-bold text-muted">ستُبنى القائمة تلقائياً من الفواتير.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topDays.map((d, i) => (
                  <button
                    key={d.isBucket && d.rangeEnd ? `${d.date}_${d.rangeEnd}` : d.date}
                    type="button"
                    onClick={() => {
                      setSelectedExpenseCategory(null);
                      setSelectedPayment(null);
                      setSelectedDay(d);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-soft/50 p-3 text-right transition-colors hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-sm font-black text-main shadow-sm">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-black tabular-nums text-main">
                          {d.isBucket && d.rangeEnd ? `${d.date} إلى ${d.rangeEnd}` : d.date}
                          {anomalyDates.has(d.date) && (
                            <span title="يوم شاذ إحصائياً">
                              <AlertTriangle size={12} className="text-amber-600" />
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-xs font-black tabular-nums",
                            d.net >= 0 ? "text-emerald-600" : "text-rose-600",
                          )}
                        >
                          {formatCurrency(d.net)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/60">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            d.net >= 0 ? "bg-emerald-500" : "bg-rose-500",
                          )}
                          style={{ width: `${Math.max(4, (Math.abs(d.net) / Math.abs(maxDayNet)) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 truncate text-[10px] font-bold tabular-nums text-muted">
                        إيراد {formatCurrency(d.rev)} • مصروف {formatCurrency(d.exp)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ContentPanel>
        </TabsContent>

        {/* ── Cashflow & collection ────────────────── */}
        <TabsContent value="cashflow" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <ChartCard
              title={
                <span className="flex items-center gap-2">
                  <Activity size={16} className="text-primary" /> تحليل التدفقات النقدية
                </span>
              }
              subtitle={`مقارنة الإيرادات بالمصروفات • ${financials.dailyTrends.length} نقطة زمنية حقيقية من الفواتير والمصروفات`}
              data={financials.dailyTrends}
              height={320}
              emptyTitle="لا توجد حركات في هذه الفترة"
              emptyHint="جرّب توسيع النطاق الزمني أو اختيار نطاق مختلف لعرض التدفقات النقدية."
              className="overflow-hidden lg:col-span-2"
              actions={
                financials.prevDailyTrends.length > 0 ? (
                  <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-soft/60 px-2.5 py-1.5 text-[10px] font-black text-muted">
                    <History size={12} />
                    <Switch
                      checked={showPrev}
                      onCheckedChange={setShowPrev}
                      aria-label="إظهار الفترة السابقة"
                    />
                    الفترة السابقة
                  </label>
                ) : undefined
              }
              badge={
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> الإيرادات
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> المصروفات
                  </Badge>
                </div>
              }
            >
              <div className="h-[300px] w-full sm:h-[320px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={financials.dailyTrends}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="finRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="finExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                      tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={compactTick}
                      tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                    />
                    <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />
                    {showPrev && financials.prevDailyTrends.length > 0 && (
                      <>
                        <Line
                          type="monotone"
                          data={financials.prevDailyTrends}
                          dataKey="rev"
                          name="إيرادات الفترة السابقة"
                          stroke="#10B981"
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                          strokeOpacity={0.6}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2, stroke: "#10B981", fill: "#fff", strokeOpacity: 0.6 }}
                        />
                        <Line
                          type="monotone"
                          data={financials.prevDailyTrends}
                          dataKey="exp"
                          name="مصروفات الفترة السابقة"
                          stroke="#F43F5E"
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                          strokeOpacity={0.6}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2, stroke: "#F43F5E", fill: "#fff", strokeOpacity: 0.6 }}
                        />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey="rev"
                      name="الإيرادات"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fill="url(#finRev)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#10B981", fill: "#fff" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="exp"
                      name="المصروفات"
                      stroke="#F43F5E"
                      strokeWidth={2.5}
                      fill="url(#finExp)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#F43F5E", fill: "#fff" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title={
                <span className="flex items-center gap-2">
                  <PieChartIcon size={16} className="text-amber-600" /> طرق التحصيل
                </span>
              }
              subtitle="توزيع المبيعات حسب وسيلة الدفع — اضغط أي وسيلة لعرض فواتيرها"
              data={paymentsWithPct}
              height={300}
              emptyTitle="لا توجد مدفوعات مسجلة"
              emptyHint="ستظهر وسائل الدفع فور تسجيل الفواتير."
              className="overflow-hidden"
            >
              <div className="relative mx-auto h-[200px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentsWithPct}
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="label"
                      strokeWidth={0}
                    >
                      {paymentsWithPct.map((p) => (
                        <Cell
                          key={p.name}
                          fill={p.color}
                          onClick={() => {
                            setSelectedDay(null);
                            setSelectedExpenseCategory(null);
                            setSelectedPayment({ name: p.name, value: p.value });
                          }}
                          style={{ cursor: "pointer", outline: "none" }}
                          opacity={selectedPayment && selectedPayment.name !== p.name ? 0.45 : 1}
                        />
                      ))}
                    </Pie>
                    <ReTooltip content={<FinanceTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                    الإجمالي
                  </span>
                  <span className="max-w-[160px] truncate text-lg font-black tabular-nums text-main">
                    {formatCurrency(financials.revenue)}
                  </span>
                </div>
              </div>
              <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto">
                {paymentsWithPct.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setSelectedDay(null);
                      setSelectedExpenseCategory(null);
                      setSelectedPayment(
                        selectedPayment?.name === p.name ? null : { name: p.name, value: p.value },
                      );
                    }}
                    aria-pressed={selectedPayment?.name === p.name}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      selectedPayment?.name === p.name
                        ? "border-primary bg-primary/5"
                        : "border-border/50 bg-soft/60 hover:bg-soft",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="truncate text-xs font-black text-main">{p.label}</span>
                      <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                        {p.pct.toFixed(0)}%
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-black tabular-nums text-main">
                      {formatCurrency(p.value)}
                    </span>
                  </button>
                ))}
              </div>
            </ChartCard>
          </div>
        </TabsContent>

        {/* ── Expenses ───────────────────────────────── */}
        <TabsContent value="expenses" className="mt-4">
          <ChartCard
            title="هيكل المصروفات"
            subtitle="أكبر بنود التكلفة في الفترة المحددة — اضغط أي بند لعرض حركاته"
            data={financials.expenseCategories}
            height={280}
            emptyTitle="لا توجد مصروفات مصنفة"
            emptyHint="سجّل المصروفات لتظهر هنا بالتفصيل."
            className="overflow-hidden"
            badge={
              topExpense ? <Badge className="shrink-0">{formatCurrency(topExpense.value)}</Badge> : undefined
            }
          >
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {financials.expenseCategories.slice(0, 6).map((c, i) => {
                const pct = financials.expenses > 0 ? (c.value / financials.expenses) * 100 : 0;
                const active = selectedExpenseCategory?.name === c.name;
                return (
                  <button
                    key={`${c.name}-${i}`}
                    type="button"
                    onClick={() => {
                      setSelectedDay(null);
                      setSelectedPayment(null);
                      setSelectedExpenseCategory(active ? null : c);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "space-y-1.5 rounded-xl border p-3 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-border/60 hover:bg-soft/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-black text-main">{c.name}</span>
                      <span className="shrink-0 text-xs font-black tabular-nums text-main">
                        {formatCurrency(c.value)} • {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(4, Math.min(100, pct))}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </ChartCard>
        </TabsContent>

        {/* ── Forecast ───────────────────────────────── */}
        <TabsContent value="forecast" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {!monthlyLoaded ? (
              <Card className="overflow-hidden">
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <CalendarRange size={26} className="text-muted" />
                  <p className="text-sm font-black text-main">المقارنة الشهرية جاهزة عند الطلب</p>
                  <p className="text-xs font-bold text-muted">اضغط تحميل لجلب 6 شهور وتجميعها شهرياً.</p>
                  <Button
                    onClick={fetchSixMonths}
                    loading={monthlyLoading}
                    variant="outline"
                    size="sm"
                    className="mt-2 shrink-0 gap-2 text-[11px] font-black"
                  >
                    <BarChart3 size={14} /> تحميل المقارنة
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ChartCard
                title={
                  <span className="flex items-center gap-2">
                    <CalendarRange size={16} className="text-indigo-600" /> مقارنة آخر 6 شهور
                  </span>
                }
                subtitle="الإيرادات مقابل المصروفات شهرياً من البيانات الحقيقية"
                data={monthly}
                height={260}
                className="overflow-hidden"
              >
                <div className="h-[260px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tickFormatter={compactTick}
                        tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                      />
                      <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 800 }} />
                      <Bar dataKey="rev" name="الإيرادات" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="exp" name="المصروفات" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={28} />
                      <Line
                        type="monotone"
                        dataKey="net"
                        name="الصافي"
                        stroke="#6366F1"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#6366F1" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            )}

            {!forecast ? (
              <Card className="overflow-hidden">
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <Zap size={26} className="text-muted" />
                  <p className="text-sm font-black text-main">لا توجد بيانات كافية للإسقاط</p>
                  <p className="text-xs font-bold text-muted">اختر نطاقاً زمنياً فيه حركات مالية.</p>
                </CardContent>
              </Card>
            ) : (
              <ChartCard
                title={
                  <span className="flex items-center gap-2">
                    <Zap size={16} className="text-violet-600" /> إسقاط التدفق النقدي — 30 يوم
                  </span>
                }
                subtitle={`بناءً على متوسط آخر ${forecast.basisDays} يوم من الفترة الحالية`}
                data={forecast.cumulative}
                height={260}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">إيراد متوقع</p>
                    <p className="mt-1 text-sm font-black tabular-nums text-emerald-600">
                      {formatCurrency(forecast.projRev)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-600">مصروف متوقع</p>
                    <p className="mt-1 text-sm font-black tabular-nums text-rose-600">
                      {formatCurrency(forecast.projExp)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl border p-3",
                      forecast.projNet >= 0
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-rose-500/20 bg-rose-500/5",
                    )}
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted">صافي متوقع</p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-black tabular-nums",
                        forecast.projNet >= 0 ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {formatCurrency(forecast.projNet)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-[150px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={forecast.cumulative} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="finForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tickFormatter={compactTick}
                        tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                      />
                      <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />
                      <Area
                        type="monotone"
                        dataKey="net"
                        name="الصافي التراكمي المتوقع"
                        stroke="#8B5CF6"
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        fill="url(#finForecast)"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 text-[10px] font-bold text-muted">
                  متوسط يومي: إيراد {formatCurrency(forecast.avgRev)} • مصروف {formatCurrency(forecast.avgExp)} — الإسقاط خطي ويفترض استمرار نفس الوتيرة.
                </p>
              </ChartCard>
            )}
          </div>

          <PremiumCard
            hoverable={false}
            className="border-primary/20 bg-gradient-to-br from-indigo-500/[0.06] via-card to-violet-500/[0.06]"
          >
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-main sm:text-2xl">
                      المستشار المالي الذكي
                    </h3>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-muted">
                      تحليل فعلي للبيانات الحالية وتوصيات نمو قابلة للتنفيذ
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit text-[10px] font-black">
                  AI POWERED
                </Badge>
              </div>
              <AIInsights data={aiInsights} isSidebar />
            </div>
          </PremiumCard>
        </TabsContent>

        {/* ── Reports & schedules ──────────────────── */}
        <TabsContent value="reports" className="mt-4 space-y-6">
          {canEditTarget && (
            <ContentPanel
              title={
                <span className="flex items-center gap-2">
                  <BellRing size={16} className="text-teal-600" /> التقارير المالية المجدولة
                </span>
              }
              subtitle="إرسال تلقائي لملخص الإيرادات والمصروفات والصافي — إشعار داخل النظام و/أو واتساب"
              className="print:hidden"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-border bg-soft/60 p-3">
                  <label className="flex min-w-32 flex-1 flex-col gap-1 text-[11px] font-black text-muted sm:flex-none">
                    التكرار
                    <Select value={schedFreq} onValueChange={setSchedFreq}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-black">
                        <SelectValue placeholder="التكرار" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">يومي</SelectItem>
                        <SelectItem value="weekly">أسبوعي</SelectItem>
                        <SelectItem value="monthly">شهري</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="flex min-w-36 flex-1 flex-col gap-1 text-[11px] font-black text-muted sm:flex-none">
                    القناة
                    <Select value={schedChannel} onValueChange={setSchedChannel}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-black">
                        <SelectValue placeholder="القناة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notification">إشعار داخلي</SelectItem>
                        <SelectItem value="whatsapp">واتساب</SelectItem>
                        <SelectItem value="both">الاثنان معاً</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  {(schedChannel === "whatsapp" || schedChannel === "both") && (
                    <label className="flex min-w-40 flex-1 flex-col gap-1 text-[11px] font-black text-muted sm:flex-none">
                      رقم الواتساب (اختياري — وإلا رقم المحل)
                      <input
                        value={schedPhone}
                        onChange={(e) => setSchedPhone(e.target.value)}
                        placeholder="01xxxxxxxxx"
                        dir="ltr"
                        className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-black tabular-nums text-main outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      />
                    </label>
                  )}
                  <Button
                    onClick={handleCreateSchedule}
                    loading={schedBusyId === "new"}
                    disabled={schedBusyId !== null}
                    className="h-10 gap-2 text-xs font-black"
                  >
                    <BellRing size={15} /> إنشاء جدولة
                  </Button>
                </div>

                {schedLoading ? (
                  <p className="py-6 text-center text-xs font-bold text-muted">جاري تحميل الجداول...</p>
                ) : schedules.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <BellRing size={24} className="text-muted" />
                    <p className="text-sm font-black text-main">لا توجد جداول بعد</p>
                    <p className="text-xs font-bold text-muted">أنشئ أول جدولة ليصلك الملخص المالي تلقائياً.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                          s.is_active ? "border-border/60 bg-card" : "border-border/40 bg-soft/40 opacity-70",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-main">
                            {s.name} • {s.frequency === "daily" ? "يومي" : s.frequency === "weekly" ? "أسبوعي" : "شهري"} •{" "}
                            {s.channel === "notification" ? "إشعار داخلي" : s.channel === "whatsapp" ? "واتساب" : "إشعار + واتساب"}
                          </p>
                          <p className="mt-1 text-[10px] font-bold tabular-nums text-muted">
                            {s.last_run_at
                              ? `آخر تشغيل: ${s.last_run_at.slice(0, 16).replace("T", " ")} (${s.last_status === "ok" ? "ناجح" : "فشل"})`
                              : "لم يُشغَّل بعد"}
                            {s.next_run_at ? ` • التالي: ${s.next_run_at.slice(0, 16).replace("T", " ")}` : ""}
                          </p>
                          {s.last_summary && (
                            <p className="mt-1 line-clamp-2 text-[10px] font-bold leading-relaxed text-muted">
                              {s.last_summary}
                            </p>
                          )}
                          {s.last_pdf_url && (
                            <a
                              href={`${staticURL}${s.last_pdf_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-soft/60 px-2.5 py-1 text-[10px] font-black text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                              <FileDown size={12} /> تحميل آخر PDF
                            </a>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <label className="flex items-center gap-2 text-[10px] font-black text-muted">
                            <Switch
                              checked={s.is_active}
                              onCheckedChange={() => handleToggleSchedule(s)}
                              aria-label="تفعيل الجدولة"
                            />
                            {s.is_active ? "مفعّلة" : "متوقفة"}
                          </label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRunScheduleNow(s)}
                            loading={schedBusyId === s.id}
                            disabled={schedBusyId !== null}
                            className="gap-1.5 text-[11px] font-black"
                            title="تشغيل فوري"
                          >
                            <Play size={13} /> الآن
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSchedule(s)}
                            disabled={schedBusyId !== null}
                            className="gap-1.5 text-[11px] font-black text-rose-600"
                            aria-label="حذف الجدولة"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ContentPanel>
          )}

          <ContentPanel
            title={
              <span className="flex items-center gap-2">
                <span className="rounded-xl bg-primary p-2 text-white">
                  <LayoutGrid size={16} />
                </span>
                مركز التقارير التنفيذية
              </span>
            }
            subtitle={`تصدير مستندات محاسبية معتمدة للفترة ${fromDate} إلى ${toDate}`}
            className="print:hidden"
          >
            {!hasData && (
              <p className="mb-4 rounded-xl border border-dashed border-border bg-soft/60 px-3 py-2 text-[11px] font-bold text-muted">
                لا توجد حركات في النطاق المختار — وسّع النطاق الزمني لتفعيل أزرار التصدير.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {REPORT_EXPORTS.map((item) => (
                <div
                  key={item.endpoint}
                  className="group flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-shadow hover:shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-105",
                        item.color,
                      )}
                    >
                      <item.icon size={24} />
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest opacity-70">
                      {item.format}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-base font-black text-main">{item.title}</h3>
                    <p className="mb-2.5 text-xs font-bold leading-relaxed text-muted">{item.desc}</p>
                    <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-soft/60 p-2.5">
                      <Info size={14} className="mt-0.5 shrink-0 text-primary" />
                      <p className="text-[11px] font-bold leading-relaxed text-muted">{item.details}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleExport(item.endpoint, item.file, item.type)}
                    loading={exporting === item.endpoint}
                    disabled={exporting !== null || !hasData}
                    title={!hasData ? "لا توجد بيانات في النطاق المختار" : "إصدار التقرير الآن"}
                    className="mt-auto h-11 w-full gap-2 rounded-xl text-xs font-black"
                  >
                    <Download size={16} /> إصدار التقرير الآن
                  </Button>
                </div>
              ))}
            </div>
          </ContentPanel>
        </TabsContent>
      </Tabs>

      {/* Drill-down dialog — replaces the inline panel that pushed content */}
      <Dialog
        open={drillOpen}
        onOpenChange={(open) => {
          if (!open) closeDrill();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DrilldownPanel
            selectedDay={selectedDay}
            selectedExpenseCategory={selectedExpenseCategory}
            selectedPayment={selectedPayment}
            dayInvoices={dayInvoices}
            dayExpenses={dayExpenses}
            financials={financials}
            categoryMovements={categoryMovements}
            paymentInvoices={paymentInvoices}
            onClose={closeDrill}
            onExportDay={handleExportDay}
            onExportCategory={handleExportCategory}
            onExportPayment={handleExportPayment}
            onPrint={handlePrint}
          />
        </DialogContent>
      </Dialog>

      {/* Status footer */}
      <div className="flex flex-col items-center justify-center gap-2 border-t border-border/60 py-5 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          آخر تدقيق مالي: {formatDateTime(lastUpdated)} • النطاق {fromDate} إلى {toDate}
          {financials.prevRange && (
            <> • مقارنة بالفترة {financials.prevRange.from} إلى {financials.prevRange.to}</>
          )}
        </span>
        {financials.truncated && (
          <Badge variant="outline" className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-[10px] font-black text-amber-700">
            <AlertTriangle size={12} />
            عرض أحدث {financials.invoiceCount} من أصل {financials.totalInvoices} فاتورة (حد العرض 5000 سجل) — ضيّق النطاق الزمني لنتائج أدق
          </Badge>
        )}
        {refreshing && (
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            جاري التحديث...
          </span>
        )}
        {autoRefresh && (
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
            التحديث التلقائي مفعّل (كل 60 ثانية)
          </span>
        )}
      </div>
    </div>
  );
}
