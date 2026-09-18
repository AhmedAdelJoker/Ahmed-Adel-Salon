import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  History,
  Printer,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AIInsights from "@/components/AIInsights";
import { PageHeader, ContentPanel, SkeletonCard } from "@/components/shared/PremiumUI";
import {
  ChartCard,
  CurrencyStatCard,
  ProgressBar,
  StatCard as StatCardDisplay,
} from "@/components/shared/DisplayComponents";
import {
  CHART_COLORS,
  FinanceTooltip,
  PRESETS,
  compactTick,
  formatSignedPct,
} from "@/features/financial-reports";
import {
  OP_HISTORY_PAGE_SIZE,
  useOperationalReports,
  type OpTabId,
} from "@/features/operational-reports";
import { cn, formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/core/utils";

/** Tooltip for count-based charts: shows count + revenue without a currency suffix on the count. */
function ServiceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="min-w-[200px] rounded-2xl border border-border bg-card/95 p-4 shadow-premium backdrop-blur-md">
      <p className="mb-2 truncate text-[10px] font-black uppercase tracking-widest text-muted">
        {row?.name || label || "خدمة"}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs font-bold text-muted">مرات التنفيذ</span>
          <span className="text-sm font-black tabular-nums text-main">
            {formatNumber(row?.count ?? payload[0]?.value ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs font-bold text-muted">الإيراد</span>
          <span className="text-sm font-black tabular-nums text-main">
            {formatCurrency(row?.revenue ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Tooltip for the hourly distribution (pure counts — no currency). */
function HourTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-2xl border border-border bg-card/95 p-4 shadow-premium backdrop-blur-md">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted">
        الساعة {label}
      </p>
      <p className="text-sm font-black tabular-nums text-main">
        {formatNumber(payload[0]?.value ?? 0)} عملية
      </p>
    </div>
  );
}

function safeTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const TABS: Array<{ id: OpTabId; label: string; icon: typeof Activity }> = [
  { id: "finance", label: "التحليل المالي", icon: TrendingUp },
  { id: "operations", label: "كفاءة التشغيل", icon: Activity },
  { id: "history", label: "سجل العمليات", icon: History },
];

export default function OperationalReports() {
  const {
    activeTab,
    setActiveTab,
    preset,
    applyPreset,
    loading,
    refreshing,
    hasLoaded,
    loadError,
    autoRefresh,
    setAutoRefresh,
    lastUpdated,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    searchQuery,
    setSearchQuery,
    historyPage,
    setHistoryPage,
    historyTotal,
    historyTotalPages,
    financialMetrics,
    operationalMetrics,
    aiInsights,
    pagedHistory,
    fetchData,
    handleExportHistoryCsv,
    handlePrint,
  } = useOperationalReports();

  if (loading && !hasLoaded) {
    return (
      <div className="erp-page-container space-y-6 pb-16">
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Sparkles className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted">
            جاري بناء اللوحة التشغيلية...
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

  const hasData = financialMetrics.hasData;

  if (loadError && !hasData && hasLoaded) {
    return (
      <div className="erp-page-container space-y-6 pb-16">
        <PageHeader
          title="التقارير التشغيلية"
          subtitle="تحليل الأداء التشغيلي المتقدم."
          badge="التقارير التشغيلية"
          icon={BarChart3}
        />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-lg font-black text-main">تعذر تحميل البيانات التشغيلية</p>
            <p className="max-w-md text-sm font-bold text-muted">
              تحقق من الاتصال بالخادم ثم أعد المحاولة. النطاق الحالي: {startDate} إلى{" "}
              {endDate}.
            </p>
            <Button onClick={fetchData} loading={refreshing}>
              <RefreshCw size={16} /> إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const margin = financialMetrics.income > 0 ? (financialMetrics.net / financialMetrics.income) * 100 : 0;
  const topExpense = financialMetrics.categories[0] ?? null;
  const topBarberCount = operationalMetrics.topBarbers[0]?.count || 1;
  const hasHourly = operationalMetrics.hourlyData.some((h) => h.count > 0);
  const topServiceByRevenue = [...operationalMetrics.topServices].sort(
    (a, b) => b.revenue - a.revenue,
  )[0];
  const rangeStart = (safeHistoryPageStart() - 1) * OP_HISTORY_PAGE_SIZE + 1;

  function safeHistoryPageStart(): number {
    return historyTotal === 0 ? 0 : historyPage;
  }

  const rangeEnd = Math.min(historyTotal, historyPage * OP_HISTORY_PAGE_SIZE);
  const rangeFrom = historyTotal === 0 ? 0 : rangeStart;

  return (
    <div className="erp-page-container space-y-6 pb-16">
      <PageHeader
        title="التقارير التشغيلية"
        subtitle="تحليل الأداء التشغيلي المتقدم: التدفقات، كفاءة الخدمات، وسجل الحركات."
        badge="التقارير التشغيلية"
        icon={BarChart3}
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
                    value={startDate}
                    max={endDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
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
                    value={endDate}
                    min={startDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                    }}
                    aria-label="إلى تاريخ"
                    className="w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
                  />
                </label>
              </div>
              <Button onClick={fetchData} loading={refreshing} className="h-11 gap-2 px-6 text-xs font-black">
                <RefreshCw size={15} /> تحديث
              </Button>
              <Button onClick={handlePrint} variant="outline" className="h-11 gap-2 px-5 text-xs font-black print:hidden">
                <Printer size={15} /> طباعة / PDF
              </Button>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-[11px] font-black text-muted print:hidden">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="تحديث تلقائي" />
                تحديث تلقائي
              </label>
            </div>
            <p className="text-[10px] font-bold tabular-nums text-muted">
              آخر تحديث: {formatDateTime(lastUpdated)}
              {financialMetrics.prevRange
                ? ` • تُقارن النسب بالفترة ${financialMetrics.prevRange.from} إلى ${financialMetrics.prevRange.to}`
                : ""}
            </p>
          </div>
        }
      />

      <div data-stats-grid="true">
        <CurrencyStatCard
          label="صافي الأرباح التشغيلية"
          value={financialMetrics.net}
          icon={Wallet}
          variant="primary"
          trend={
            financialMetrics.growth.net === null
              ? undefined
              : financialMetrics.growth.net >= 0
                ? "positive"
                : "negative"
          }
          trendValue={
            financialMetrics.growth.net === null
              ? undefined
              : formatSignedPct(financialMetrics.growth.net)
          }
          hint={`هامش ${margin.toFixed(1)}% من الدخل`}
        />
        <CurrencyStatCard
          label="إجمالي الدخل"
          value={financialMetrics.income}
          icon={TrendingUp}
          variant="success"
          trend={
            financialMetrics.growth.income === null
              ? undefined
              : financialMetrics.growth.income >= 0
                ? "positive"
                : "negative"
          }
          trendValue={
            financialMetrics.growth.income === null
              ? undefined
              : formatSignedPct(financialMetrics.growth.income)
          }
          hint={`${financialMetrics.timeline.length} يوم نشط في الفترة`}
        />
        <CurrencyStatCard
          label="إجمالي المصروفات"
          value={financialMetrics.expenses}
          icon={TrendingDown}
          variant="danger"
          trend={
            financialMetrics.growth.expenses === null
              ? undefined
              : financialMetrics.growth.expenses > 0
                ? "negative"
                : "positive"
          }
          trendValue={
            financialMetrics.growth.expenses === null
              ? undefined
              : formatSignedPct(financialMetrics.growth.expenses)
          }
          hint={`${financialMetrics.categories.length} بند تكلفة مصنف`}
        />
        <StatCardDisplay
          label="الخدمات المنفذة"
          value={formatNumber(operationalMetrics.totalServices)}
          icon={Scissors}
          variant="info"
          trend={
            operationalMetrics.growth.services === null
              ? undefined
              : operationalMetrics.growth.services >= 0
                ? "positive"
                : "negative"
          }
          trendValue={
            operationalMetrics.growth.services === null
              ? undefined
              : formatSignedPct(operationalMetrics.growth.services)
          }
          hint={`${formatNumber(operationalMetrics.totalCustomers)} عميل • ${formatNumber(operationalMetrics.totalInvoices)} فاتورة`}
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm print:hidden"
        role="tablist"
        aria-label="أقسام التقارير التشغيلية"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-xs font-black transition-all sm:flex-none",
              activeTab === tab.id
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-muted hover:bg-soft hover:text-main",
            )}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {activeTab === "finance" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ChartCard
                className="lg:col-span-2"
                title="ديناميكية التدفقات النقدية"
                subtitle={`مقارنة الدخل بالمصروفات • ${financialMetrics.timeline.length} نقطة زمنية من حركات الخزينة`}
                data={financialMetrics.timeline}
                height={320}
                emptyTitle="لا توجد حركات في هذه الفترة"
                emptyHint="وسّع النطاق الزمني أو اختر preset مختلف لعرض التدفقات."
                actions={
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> الدخل
                    </Badge>
                    <Badge variant="outline" className="gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500" /> المصروفات
                    </Badge>
                  </div>
                }
              >
                <div className="h-[300px] w-full sm:h-[320px]" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialMetrics.timeline} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="opIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="opExpenses" x1="0" y1="0" x2="0" y2="1">
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
                      <Area
                        type="monotone"
                        dataKey="income"
                        name="الدخل"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        fill="url(#opIncome)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "#10B981", fill: "#fff" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        name="المصروفات"
                        stroke="#F43F5E"
                        strokeWidth={2.5}
                        fill="url(#opExpenses)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "#F43F5E", fill: "#fff" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title="هيكلية المصروفات"
                subtitle="بنود التكلفة الحقيقية (المصروفات فقط) خلال الفترة"
                data={financialMetrics.categories}
                height={220}
                emptyTitle="لا توجد مصروفات مصنفة"
                emptyHint="سجّل المصروفات مبوبة لتظهر هنا بالتفصيل."
                actions={
                  topExpense ? <Badge className="shrink-0">{formatCurrency(topExpense.value)}</Badge> : undefined
                }
              >
                <div className="relative mx-auto h-[220px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financialMetrics.categories.slice(0, 8)}
                        innerRadius={64}
                        outerRadius={92}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                        strokeWidth={0}
                      >
                        {financialMetrics.categories.slice(0, 8).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip content={<FinanceTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      إجمالي المصروف
                    </span>
                    <span className="max-w-[170px] truncate text-lg font-black tabular-nums text-main">
                      {formatCurrency(financialMetrics.expenseTotal)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 max-h-[190px] space-y-2.5 overflow-y-auto">
                  {financialMetrics.categories.slice(0, 6).map((c, i) => {
                    const pct = financialMetrics.expenseTotal > 0 ? (c.value / financialMetrics.expenseTotal) * 100 : 0;
                    return (
                      <div key={`${c.name}-${i}`} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-xs font-black text-main">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span className="truncate">{c.name}</span>
                          </span>
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
                  })}
                </div>
              </ChartCard>
            </div>

            <ContentPanel
              title="الرؤى التشغيلية الذكية"
              subtitle="توصيات مولدة تلقائياً من حركات الفترة الحالية"
            >
              <AIInsights data={aiInsights} />
            </ContentPanel>
          </div>
        )}

        {activeTab === "operations" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartCard
                title="كفاءة الخدمات"
                subtitle="الخدمات الأكثر طلباً وإيرادها خلال الفترة"
                data={operationalMetrics.topServices}
                height={340}
                emptyTitle="لا توجد خدمات منفذة"
                emptyHint="ستظهر الخدمات فور تسجيل الفواتير في الفترة."
              >
                <div className="h-[320px] w-full sm:h-[340px]" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operationalMetrics.topServices} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fontWeight: 800, fill: "var(--muted)" }}
                        width={120}
                      />
                      <ReTooltip content={<ServiceTooltip />} cursor={{ fill: "var(--border)", opacity: 0.25 }} />
                      <Bar dataKey="count" name="مرات التنفيذ" radius={[0, 10, 10, 0]} barSize={26}>
                        {operationalMetrics.topServices.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ContentPanel
                title="إنتاجية الفريق"
                subtitle="ترتيب الموظفين بعدد العمليات والإيراد المحقق"
                actions={
                  operationalMetrics.topBarbers.length > 0 ? (
                    <Badge variant="outline" className="gap-1.5">
                      <Award size={12} /> {operationalMetrics.topBarbers.length} موظف نشط
                    </Badge>
                  ) : undefined
                }
              >
                {!operationalMetrics.topBarbers.length ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <Users size={26} className="text-muted" />
                    <p className="text-sm font-black text-main">لا توجد بيانات فريق بعد</p>
                    <p className="text-xs font-bold text-muted">ستُبنى القائمة تلقائياً من بنود الفواتير.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {operationalMetrics.topBarbers.map((b, i) => (
                      <div
                        key={b.name}
                        className="flex items-center gap-3 rounded-2xl border border-border/50 bg-soft/50 p-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-sm font-black text-main shadow-sm">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-black text-main">{b.name}</span>
                            <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                              {formatNumber(b.count)} عملية • {formatCurrency(b.revenue)}
                            </span>
                          </div>
                          <div className="mt-2">
                            <ProgressBar value={(b.count / topBarberCount) * 100} tone="primary" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ContentPanel>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ChartCard
                className="lg:col-span-2"
                title="توزيع النشاط خلال اليوم"
                subtitle="عدد العمليات لكل ساعة من الفواتير الحقيقية"
                data={hasHourly ? operationalMetrics.hourlyData : []}
                height={230}
                emptyTitle="لا يوجد نشاط مسجل بالساعة"
                emptyHint="ستظهر الذروة فور تسجيل فواتير بتوقيتاتها."
              >
                <div className="h-[210px] w-full sm:h-[230px]" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operationalMetrics.hourlyData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis
                        dataKey="hour"
                        axisLine={false}
                        tickLine={false}
                        interval={2}
                        tick={{ fontSize: 9, fontWeight: 800, fill: "var(--muted)" }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={40}
                        allowDecimals={false}
                        tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                      />
                      <ReTooltip content={<HourTooltip />} cursor={{ fill: "var(--border)", opacity: 0.25 }} />
                      <Bar dataKey="count" name="العمليات" radius={[5, 5, 0, 0]} maxBarSize={22}>
                        {operationalMetrics.hourlyData.map((h, i) => (
                          <Cell
                            key={i}
                            fill={operationalMetrics.peakHour?.hour === h.hour ? "#6366F1" : "#C7D2FE"}
                            fillOpacity={operationalMetrics.peakHour?.hour === h.hour ? 1 : 0.65}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <div className="space-y-6">
                <ContentPanel title="ساعات الذروة" subtitle="أعلى ضغط تشغيلي">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Clock size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-main">
                        {operationalMetrics.peakHour
                          ? `الساعة ${operationalMetrics.peakHour.hour} — ${formatNumber(operationalMetrics.peakHour.count)} عملية`
                          : "لا توجد ذروة بعد"}
                      </p>
                      <p className="mt-0.5 text-xs font-bold leading-relaxed text-muted">
                        {operationalMetrics.peakHour
                          ? "يُنصح بتفعيل الحجز المسبق وتوزيع الفريق على هذه الساعة."
                          : "سجّل الفواتير لاكتشاف ساعات الذروة تلقائياً."}
                      </p>
                    </div>
                  </div>
                </ContentPanel>
                <ContentPanel title="فرص النمو" subtitle="أعلى خدمة إيراداً">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                      <TrendingUp size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-main">
                        {topServiceByRevenue
                          ? `${topServiceByRevenue.name} — ${formatCurrency(topServiceByRevenue.revenue)}`
                          : "لا توجد بيانات كافية"}
                      </p>
                      <p className="mt-0.5 text-xs font-bold leading-relaxed text-muted">
                        {topServiceByRevenue
                          ? `نُفذت ${formatNumber(topServiceByRevenue.count)} مرة — استهدف العملاء الجدد بعروض عليها.`
                          : "ستظهر الفرص فور تسجيل الخدمات."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/60 bg-soft/60 p-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted">متوسط الفاتورة</p>
                      <p className="mt-1 truncate text-sm font-black tabular-nums text-main">
                        {formatCurrency(operationalMetrics.avgTicket)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-soft/60 p-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted">عملاء نشطون</p>
                      <p className="mt-1 truncate text-sm font-black tabular-nums text-main">
                        {formatNumber(operationalMetrics.totalCustomers)}
                      </p>
                    </div>
                  </div>
                </ContentPanel>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <ContentPanel
            title="سجل الحركات التشغيلية"
            subtitle={`${formatNumber(historyTotal)} حركة موثقة في الفترة • تُستبعد الملغاة تلقائياً`}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportHistoryCsv}
                disabled={!historyTotal}
                className="gap-2 text-[11px] font-black"
              >
                <Download size={14} /> تصدير CSV
              </Button>
            }
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالبيان، التصنيف، المبلغ، أو التاريخ (YYYY-MM-DD)..."
                  aria-label="بحث في سجل العمليات"
                  className="h-11 rounded-xl pr-10 text-xs font-bold"
                />
              </div>
            </div>

            {!pagedHistory.length ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <History size={28} className="text-muted" />
                <p className="text-sm font-black text-main">
                  {historyTotal === 0 && !searchQuery ? "لا توجد حركات في هذه الفترة" : "لا توجد سجلات تطابق البحث"}
                </p>
                <p className="max-w-sm text-xs font-bold text-muted">
                  {historyTotal === 0 && !searchQuery
                    ? "جرّب توسيع النطاق الزمني أو اختيار preset مختلف."
                    : "جرّب كلمة أخرى أو امسح البحث لعرض كل الحركات."}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">البيان</TableHead>
                      <TableHead className="text-right">التصنيف</TableHead>
                      <TableHead className="text-center">النوع</TableHead>
                      <TableHead className="text-left">القيمة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedHistory.map((t: any, i: number) => {
                      const isIn = t.direction === "in";
                      const key = String(t.id ?? `${t.created_at ?? ""}-${t.amount ?? ""}-${i}`);
                      return (
                        <TableRow key={key}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-xs font-black tabular-nums text-main">
                                {formatDate(t.transaction_date || t.created_at)}
                              </span>
                              <span className="text-[10px] font-bold tabular-nums text-muted">
                                {safeTime(t.created_at)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <p className="truncate text-xs font-bold text-main" title={String(t.note || "")}>
                              {String(t.note || "عملية تشغيلية")}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] font-black">
                              {String(t.category || "عام")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black",
                                isIn
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "bg-rose-500/10 text-rose-700",
                              )}
                            >
                              {isIn ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                              {isIn ? "إيداع" : "مصروف"}
                            </span>
                          </TableCell>
                          <TableCell className="text-left">
                            <span
                              className={cn(
                                "text-xs font-black tabular-nums",
                                isIn ? "text-emerald-700" : "text-rose-700",
                              )}
                            >
                              {isIn ? "+" : "-"}
                              {formatCurrency(t.amount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <p className="text-[11px] font-bold tabular-nums text-muted">
                    عرض {formatNumber(rangeFrom)}–{formatNumber(rangeEnd)} من {formatNumber(historyTotal)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                      disabled={historyPage <= 1}
                      className="gap-1 text-[11px] font-black"
                      aria-label="الصفحة السابقة"
                    >
                      <ChevronRight size={14} /> السابق
                    </Button>
                    <span className="min-w-[90px] text-center text-[11px] font-black tabular-nums text-main">
                      {formatNumber(historyPage)} / {formatNumber(historyTotalPages)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(Math.min(historyTotalPages, historyPage + 1))}
                      disabled={historyPage >= historyTotalPages}
                      className="gap-1 text-[11px] font-black"
                      aria-label="الصفحة التالية"
                    >
                      التالي <ChevronLeft size={14} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </ContentPanel>
        )}
      </div>

      {loadError && hasData && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 print:hidden dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle size={18} className="shrink-0" />
          <p className="flex-1 text-xs font-bold">
            تعذر تحديث الفترة السابقة — الأرقام المعروضة للفترة الحالية فقط والنسب قد تكون غائبة.
          </p>
          <Button variant="outline" size="sm" onClick={fetchData} loading={refreshing} className="shrink-0">
            إعادة المحاولة
          </Button>
        </div>
      )}
    </div>
  );
}
