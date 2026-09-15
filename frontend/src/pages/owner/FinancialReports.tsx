import {
  Activity,
  AlertTriangle,
  Banknote,
  BarChart3,
  BellRing,
  Calculator,
  Calendar,
  CalendarRange,
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
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { staticURL } from "@/services/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import AIInsights from "@/components/AIInsights";
import { cn, formatCurrency, formatDateTime } from "@/lib/core/utils";
import { PageHeader, SkeletonCard } from "@/components/shared/PremiumUI";
import {
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

export default function FinancialReports() {
  const {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    preset,
    setPreset,
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
      <div className="erp-page-container space-y-6 pb-16" dir="rtl">
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
      <div className="erp-page-container space-y-6 pb-16" dir="rtl">
        <PageHeader
          title="التحليلات المالية الاستراتيجية"
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

  const reports = [
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

  return (
    <div className="erp-page-container space-y-6 pb-16" dir="rtl">
      <PageHeader
        title="التحليلات المالية الاستراتيجية"
        subtitle="مراقبة الأرباح والتدفقات النقدية ومؤشرات الأداء بدقة عالية."
        badge="الرقابة المالية"
        icon={Banknote}
        actions={
          <div className="flex w-full flex-col gap-3 print:hidden xl:w-auto">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="نطاقات زمنية سريعة">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  aria-pressed={preset === p.id}
                  className={cn(
                    "h-9 rounded-xl border px-4 text-[11px] font-black transition-all",
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
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm xl:flex-none">
                <label className="flex items-center gap-2 px-2">
                  <Calendar size={14} className="shrink-0 text-muted" />
                  <span className="sr-only">من تاريخ</span>
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setPreset("month");
                    }}
                    aria-label="من تاريخ"
                    className="w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
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
                      setPreset("month");
                    }}
                    aria-label="إلى تاريخ"
                    className="w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
                  />
                </label>
              </div>
              <Button
                onClick={fetchFinancials}
                loading={refreshing}
                className="h-11 gap-2 px-6 text-xs font-black"
              >
                <RefreshCw size={15} /> تحديث
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="h-11 gap-2 px-5 text-xs font-black print:hidden"
                title="طباعة التقرير أو حفظه PDF"
              >
                <Printer size={15} /> طباعة / PDF
              </Button>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-[11px] font-black text-muted print:hidden">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="تحديث تلقائي" />
                تحديث تلقائي
              </label>
            </div>
          </div>
        }
      />

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
              : `Δ ${formatSignedPct(financials.growth.marginDelta)} نقطة عن الفترة السابقة`
          }
        />
      </div>

      {/* Monthly Revenue Target Progress */}
      {isCurrentMonth && (
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
          onTargetDraftChange={setTargetDraft}
          onEditTarget={() => setEditingTarget(true)}
          onCancelEditTarget={() => {
            setEditingTarget(false);
            setTargetDraft(String(Math.round(monthlyTarget)));
          }}
          onSaveTarget={handleSaveTarget}
        />
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:p-5 lg:grid-cols-4">
          {[
            { icon: Receipt, label: "عدد الفواتير", value: String(financials.invoiceCount) },
            { icon: Calculator, label: "متوسط الفاتورة", value: formatCurrency(financials.avgTicket) },
            { icon: CreditCard, label: "أعلى وسيلة تحصيل", value: topPayment ? topPayment.label : "—" },
            {
              icon: Activity,
              label: "أفضل يوم (صافي)",
              value: financials.bestDay ? formatCurrency(financials.bestDay.net) : "—",
            },
          ].map((m) => (
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
        </CardContent>
        </Card>

      {/* Anomaly Alerts */}
      <AnomalyAlerts anomalies={anomalies} onInspectDay={handleInspectAnomalyDay} />

      {/* Drill-down Detail Panel */}
      <DrilldownPanel
        selectedDay={selectedDay}
        selectedExpenseCategory={selectedExpenseCategory}
        selectedPayment={selectedPayment}
        dayInvoices={dayInvoices}
        dayExpenses={dayExpenses}
        financials={financials}
        categoryMovements={categoryMovements}
        paymentInvoices={paymentInvoices}
        onClose={() => {
          setSelectedDay(null);
          setSelectedExpenseCategory(null);
          setSelectedPayment(null);
        }}
        onExportDay={handleExportDay}
        onExportCategory={handleExportCategory}
        onExportPayment={handleExportPayment}
        onPrint={handlePrint}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Activity size={18} />
                </div>
                <CardTitle>تحليل التدفقات النقدية</CardTitle>
              </div>
              <CardDescription>
                مقارنة الإيرادات بالمصروفات • {financials.dailyTrends.length} نقطة زمنية حقيقية من
                الفواتير والمصروفات
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> الإيرادات
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> المصروفات
              </Badge>
              {financials.prevDailyTrends.length > 0 && (
                <>
                  <Badge variant="outline" className="gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 opacity-60" style={{ borderBottom: "2px dashed" }} /> الفترة السابقة (إيراد)
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 opacity-60" style={{ borderBottom: "2px dashed" }} /> الفترة السابقة (مصروف)
                  </Badge>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {!hasData ? (
              <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
                <Activity size={28} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد حركات في هذه الفترة</p>
                <p className="max-w-sm text-xs font-bold text-muted">
                  جرّب توسيع النطاق الزمني أو اختيار preset مختلف لعرض التدفقات النقدية.
                </p>
              </div>
            ) : (
              <div className="h-[300px] w-full sm:h-[340px]" dir="ltr">
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
                      <linearGradient id="finRevPrev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="finExpPrev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.12} />
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
                    {/* Previous period - Revenue (dashed line) */}
                    {financials.prevDailyTrends.length > 0 && (
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
                        {/* Previous period - Expenses (dashed line) */}
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
                    {/* Current period - Revenue */}
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
                    {/* Current period - Expenses */}
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
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                <PieChartIcon size={18} />
              </div>
              <CardTitle>طرق التحصيل</CardTitle>
            </div>
            <CardDescription>توزيع المبيعات حسب وسيلة الدفع — اضغط أي وسيلة لعرض فواتيرها</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {!paymentsWithPct.length ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
                <CreditCard size={28} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد مدفوعات مسجلة</p>
                <p className="text-xs font-bold text-muted">ستظهر وسائل الدفع فور تسجيل الفواتير.</p>
              </div>
            ) : (
              <>
                <div className="relative mx-auto h-[220px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentsWithPct}
                        innerRadius={68}
                        outerRadius={96}
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
                    <div
                      key={p.name}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                        selectedPayment?.name === p.name
                          ? "border-primary bg-primary/5"
                          : "border-border/50 bg-soft/60 hover:bg-soft",
                      )}
                      onClick={() => {
                        setSelectedDay(null);
                        setSelectedExpenseCategory(null);
                        setSelectedPayment(
                          selectedPayment?.name === p.name ? null : { name: p.name, value: p.value },
                        );
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setSelectedDay(null);
                          setSelectedExpenseCategory(null);
                          setSelectedPayment(
                            selectedPayment?.name === p.name ? null : { name: p.name, value: p.value },
                          );
                        }
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="truncate text-xs font-black text-main">{p.label}</span>
                        <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                          {p.pct.toFixed(0)}%
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-black tabular-nums text-main">
                        {formatCurrency(p.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>هيكل المصروفات</CardTitle>
                <CardDescription>أكبر بنود التكلفة في الفترة المحددة</CardDescription>
              </div>
              {topExpense && (
                <Badge className="shrink-0">{formatCurrency(topExpense.value)}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            {!financials.expenseCategories.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Wallet size={26} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد مصروفات مصنفة</p>
                <p className="text-xs font-bold text-muted">سجّل المصروفات لتظهر هنا بالتفصيل.</p>
              </div>
            ) : (
              financials.expenseCategories.slice(0, 6).map((c, i) => {
                const pct = financials.expenses > 0 ? (c.value / financials.expenses) * 100 : 0;
                return (
                  <div
                    key={`${c.name}-${i}`}
                    className="space-y-1.5 cursor-pointer hover:bg-soft/50 rounded-xl p-2 transition-colors"
                    onClick={() => {
                      setSelectedDay(null);
                      setSelectedPayment(null);
                      setSelectedExpenseCategory(c);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSelectedDay(null);
                        setSelectedPayment(null);
                        setSelectedExpenseCategory(c);
                      }
                    }}
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
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Calendar size={18} />
              </div>
              <div>
                <CardTitle>أفضل الأيام صافياً</CardTitle>
                <CardDescription>أعلى 5 أيام ربحية من البيانات اليومية الحقيقية</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            {!topDays.length || !hasData ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Calendar size={26} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد أيام للعرض بعد</p>
                <p className="text-xs font-bold text-muted">ستُبنى القائمة تلقائياً من الفواتير.</p>
              </div>
            ) : (
              topDays.map((d, i) => (
                <div
                  key={d.date}
                  className="flex items-center gap-3 rounded-2xl border border-border/50 bg-soft/50 p-3 cursor-pointer hover:bg-soft transition-colors"
                  onClick={() => {
                    setSelectedExpenseCategory(null);
                    setSelectedPayment(null);
                    setSelectedDay(d);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSelectedExpenseCategory(null);
                      setSelectedPayment(null);
                      setSelectedDay(d);
                    }
                  }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-sm font-black text-main shadow-sm">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-black tabular-nums text-main">
                        {d.date}
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
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600">
                  <CalendarRange size={18} />
                </div>
                <div>
                  <CardTitle>مقارنة آخر 6 شهور</CardTitle>
                  <CardDescription>الإيرادات مقابل المصروفات شهرياً من البيانات الحقيقية</CardDescription>
                </div>
              </div>
              {!monthlyLoaded && (
                <Button
                  onClick={fetchSixMonths}
                  loading={monthlyLoading}
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 text-[11px] font-black"
                >
                  <BarChart3 size={14} /> تحميل المقارنة
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {!monthlyLoaded ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CalendarRange size={26} className="text-muted" />
                <p className="text-sm font-black text-main">المقارنة الشهرية جاهزة عند الطلب</p>
                <p className="text-xs font-bold text-muted">اضغط تحميل لجلب 6 شهور وتجميعها شهرياً.</p>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-violet-500/10 p-2 text-violet-600">
                <Zap size={18} />
              </div>
              <div>
                <CardTitle>إسقاط التدفق النقدي — 30 يوم</CardTitle>
                <CardDescription>
                  {forecast
                    ? `بناءً على متوسط آخر ${forecast.basisDays} يوم من الفترة الحالية`
                    : "توقع تلقائي من الترند الحالي"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            {!forecast ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Zap size={26} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد بيانات كافية للإسقاط</p>
                <p className="text-xs font-bold text-muted">اختر نطاقاً زمنياً فيه حركات مالية.</p>
              </div>
            ) : (
              <>
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
                <div className="h-[150px] w-full" dir="ltr">
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
                <p className="text-[10px] font-bold text-muted">
                  متوسط يومي: إيراد {formatCurrency(forecast.avgRev)} • مصروف {formatCurrency(forecast.avgExp)} — الإسقاط خطي ويفترض استمرار نفس الوتيرة.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {canEditTarget && (
        <Card className="overflow-hidden print:hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-teal-500/10 p-2 text-teal-600">
                <BellRing size={18} />
              </div>
              <div>
                <CardTitle>التقارير المالية المجدولة</CardTitle>
                <CardDescription>
                  إرسال تلقائي لملخص الإيرادات والمصروفات والصافي — إشعار داخل النظام و/أو واتساب
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-border bg-soft/60 p-3">
              <label className="flex flex-col gap-1 text-[11px] font-black text-muted">
                التكرار
                <select
                  value={schedFreq}
                  onChange={(e) => setSchedFreq(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-black text-main outline-none"
                >
                  <option value="daily">يومي</option>
                  <option value="weekly">أسبوعي</option>
                  <option value="monthly">شهري</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black text-muted">
                القناة
                <select
                  value={schedChannel}
                  onChange={(e) => setSchedChannel(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-black text-main outline-none"
                >
                  <option value="notification">إشعار داخلي</option>
                  <option value="whatsapp">واتساب</option>
                  <option value="both">الاثنان معاً</option>
                </select>
              </label>
              {(schedChannel === "whatsapp" || schedChannel === "both") && (
                <label className="flex flex-col gap-1 text-[11px] font-black text-muted">
                  رقم الواتساب (اختياري — وإلا رقم المحل)
                  <input
                    value={schedPhone}
                    onChange={(e) => setSchedPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    className="h-10 w-40 rounded-xl border border-border bg-card px-3 text-xs font-black tabular-nums text-main outline-none"
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
                          className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-soft/60 px-2.5 py-1 text-[10px] font-black text-primary hover:underline"
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
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden bg-slate-950 text-white">
        <div className="relative z-10 space-y-6 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-xl">
                <Sparkles size={26} className="animate-pulse text-amber-300" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                  المستشار المالي الذكي
                </h3>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/60">
                  تحليل فعلي للبيانات الحالية وتوصيات نمو قابلة للتنفيذ
                </p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit border-white/20 text-[10px] font-black text-white/80">
              AI POWERED
            </Badge>
          </div>
          <AIInsights data={aiInsights} isSidebar />
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-500/10 blur-[100px]" />
      </Card>

      <div className="space-y-5 print:hidden">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary p-2.5 text-white shadow-lg shadow-primary/20">
            <LayoutGrid size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-main sm:text-2xl">
              مركز التقارير التنفيذية
            </h2>
            <p className="text-xs font-bold text-muted sm:text-sm">
              تصدير مستندات محاسبية معتمدة للفترة {fromDate} إلى {toDate}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((item) => (
            <Card key={item.endpoint} className="group overflow-hidden transition-all hover:-translate-y-1">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105",
                      item.color,
                    )}
                  >
                    <item.icon size={26} />
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest opacity-70">
                    {item.format}
                  </Badge>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-black text-main">{item.title}</h3>
                  <p className="mb-3 text-xs font-bold leading-relaxed text-muted">{item.desc}</p>
                  <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-soft/60 p-3">
                    <Info size={14} className="mt-0.5 shrink-0 text-primary" />
                    <p className="text-[11px] font-bold leading-relaxed text-muted">{item.details}</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleExport(item.endpoint, item.file, item.type)}
                  loading={exporting === item.endpoint}
                  disabled={exporting !== null || !hasData}
                  className="h-12 w-full gap-2 rounded-2xl text-xs font-black"
                >
                  <Download size={16} /> إصدار التقرير الآن
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-1 border-t border-border/60 py-5 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          آخر تدقيق مالي: {formatDateTime(lastUpdated)} • النطاق {fromDate} إلى {toDate}
          {financials.prevRange && (
            <> • مقارنة بالفترة {financials.prevRange.from} إلى {financials.prevRange.to}</>
          )}
        </span>
        {financials.truncated && (
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
            عرض أحدث {financials.invoiceCount} من أصل {financials.totalInvoices} فاتورة (حد العرض
            5000 سجل)
          </span>
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
