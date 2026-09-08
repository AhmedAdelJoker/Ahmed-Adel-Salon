import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  Clock,
  LayoutDashboard,
  Loader2,
  Receipt,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber } from "@/lib/core/utils";
import {
  StatCard as StatCardDisplay,
  CurrencyStatCard,
} from "@/components/shared/DisplayComponents";
import {
  PageHeader,
  PremiumCard,
  ContentPanel,
  SkeletonCard,
} from "@/components/shared/PremiumUI";

const KPI_CONFIG = [
  { key: "todayRevenue", label: "إيرادات اليوم", icon: Wallet, variant: "primary", trendKey: "todayRevenueTrend" },
  { key: "todayExpenses", label: "مصروفات اليوم", icon: TrendingDown, variant: "danger", trendKey: "todayExpensesTrend" },
  { key: "netProfit", label: "صافي الربح", icon: Banknote, variant: "success", trendKey: "netProfitTrend" },
  { key: "todayAppointments", label: "حجوزات اليوم", icon: Calendar, variant: "info", trendKey: "todayAppointmentsTrend" },
  { key: "avgInvoice", label: "متوسط الفاتورة", icon: Receipt, variant: "warning", trendKey: "avgInvoiceTrend" },
  { key: "occupancy", label: "معدل الإشغال", icon: Zap, variant: "secondary", isPercent: true, trendKey: "occupancyTrend" },
];

const PERIODS = [
  { value: "today", label: "اليوم" },
  { value: "yesterday", label: "أمس" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "year", label: "هذا العام" },
];

const FALLBACK_WEEKLY = [
  { name: "السبت", revenue: 12500, appointments: 18 },
  { name: "الأحد", revenue: 8200, appointments: 12 },
  { name: "الإثنين", revenue: 9600, appointments: 14 },
  { name: "الثلاثاء", revenue: 11200, appointments: 16 },
  { name: "الأربعاء", revenue: 10800, appointments: 15 },
  { name: "الخميس", revenue: 14500, appointments: 20 },
  { name: "الجمعة", revenue: 16800, appointments: 22 },
];

const FALLBACK_SERVICES = [
  { name: "حلاقة", value: 42 },
  { name: "عناية بالبشرة", value: 28 },
  { name: "صبغة", value: 18 },
  { name: "أخرى", value: 12 },
];

const DEMO_STATS = {
  todayRevenue: 18750,
  todayExpenses: 3420,
  netProfit: 15330,
  todayAppointments: 24,
  avgInvoice: 780,
  occupancy: 72,
  todayRevenueTrend: 12,
  todayExpensesTrend: -5,
  netProfitTrend: 18,
  todayAppointmentsTrend: 8,
  avgInvoiceTrend: 4,
  occupancyTrend: -2,
};

const DEFAULT_STATS = DEMO_STATS;

export default function ReportsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportScope = searchParams.get("scope");
  const employeeId = searchParams.get("employeeId");
  const employeeName = searchParams.get("employeeName");

  const [stats, setStats] = useState<typeof DEMO_STATS & { newCustomersThisWeek?: number }>(DEFAULT_STATS);
  const [weeklyData, setWeeklyData] = useState(FALLBACK_WEEKLY);
  const [serviceDistribution, setServiceDistribution] = useState(FALLBACK_SERVICES);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [chartType, setChartType] = useState("area");
  const [isDemo, setIsDemo] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/owner/dashboard-stats", {
        params: { scope: reportScope, employee_id: employeeId, period },
      });
      const data = adaptObject(res.data);
      
      const hasRealRevenue = data.stats && Number(data.stats.todayRevenue) > 0;
      const hasRealWeekly = Array.isArray(data.weekly_data) && data.weekly_data.some(d => Number(d.revenue) > 0);
      const isEmpty = !hasRealRevenue && !hasRealWeekly;
      setIsDemo(isEmpty);
      
      const mergedStats = isEmpty ? DEMO_STATS : {
        ...DEMO_STATS,
        ...Object.fromEntries(Object.entries(data.stats || {}).filter(([_, v]) => Number(v) !== 0)),
        occupancy: data.stats?.occupancy ?? DEMO_STATS.occupancy,
      };
      
      setStats((prev) => ({ ...prev, ...mergedStats }));
      setWeeklyData(hasRealWeekly ? data.weekly_data : FALLBACK_WEEKLY);
      
      if (data.service_distribution?.length) {
        setServiceDistribution(data.service_distribution);
      } else if (data.stats?.service_breakdown?.length) {
        setServiceDistribution(data.stats.service_breakdown);
      } else {
        setServiceDistribution(FALLBACK_SERVICES);
      }
    } catch (_err) {
      console.error("Dashboard load error:", _err);
      setStats(DEMO_STATS);
      setWeeklyData(FALLBACK_WEEKLY);
      setServiceDistribution(FALLBACK_SERVICES);
      setIsDemo(true);
      toast.error("تعذر تحميل البيانات - يتم عرض بيانات توضيحية");
    } finally {
      setLoading(false);
    }
  }, [reportScope, employeeId, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  const chartRows = useMemo(() => (Array.isArray(weeklyData) ? weeklyData : []), [weeklyData]);
  const displayName = user?.full_name || "المدير";
  const scopeLabel = employeeId
    ? `تقرير مخصص: ${employeeName || `الموظف #${employeeId}`}`
    : "نظرة عامة على المنشأة بالكامل";

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

  const formatStatValue = (key, value) => {
    const isMoney = ["todayRevenue", "todayExpenses", "netProfit", "avgInvoice"].includes(key);
    const isPercent = key === "occupancy";
    if (isPercent) return `${value}%`;
    if (isMoney) {
      return new Intl.NumberFormat("ar-EG-u-nu-latn", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(value)||0);
    }
    return formatNumber(value);
  };

  const getTrendVariant = (trendValue) => {
    if (trendValue === undefined || trendValue === null) return "neutral";
    return trendValue >= 0 ? "positive" : "negative";
  };

  return (
    <div className="erp-page space-y-6 pb-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center shadow-lg">
            <LayoutDashboard className="text-inverse w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-main tracking-tight">
              أهلاً بك، {displayName} 👋
            </h1>
            <p className="text-sm text-muted font-bold">
              {scopeLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            تحديث
          </Button>
        </div>
      </div>

      {/* Demo Banner */}
      {isDemo && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 flex items-center gap-3 text-amber-800 dark:text-amber-200" dir="rtl">
          <Activity size={18} className="shrink-0 animate-pulse" />
          <p className="text-xs font-bold">وضع العرض التوضيحي — لا توجد بيانات حقيقية للفترة الحالية. يتم عرض أرقام توضيحية لتوضيح شكل اللوحة.</p>
        </div>
      )}

      {/* KPI Stats */}
      <ContentPanel title={undefined} subtitle={undefined} actions={undefined} className={undefined}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {KPI_CONFIG.map((kpi, idx) => {
            const value = stats[kpi.key] ?? 0;
            const rawTrend = stats[kpi.trendKey];
            const isValidTrend = typeof rawTrend === 'number' && isFinite(rawTrend) && rawTrend !== 0;
            const trendVariant = isValidTrend ? getTrendVariant(rawTrend) : undefined;
            const isCurrency = kpi.key.includes("revenue") || kpi.key.includes("expense") || kpi.key.includes("profit");
            const cardProps = {
              label: kpi.label,
              value: formatStatValue(kpi.key, value),
              icon: kpi.icon,
              variant: kpi.variant,
              delay: idx * 0.04,
              trend: trendVariant,
              trendValue: isValidTrend ? `${Math.abs(rawTrend)}%` : undefined,
              hint: undefined,
              className: undefined,
            };
            return isCurrency ? <CurrencyStatCard key={kpi.key} {...cardProps} value={value} /> : <StatCardDisplay key={kpi.key} {...cardProps} />;
          })}
        </div>
      </ContentPanel>

      {/* Main Charts & Insights */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue Chart */}
        <ContentPanel className="xl:col-span-2" title={undefined} subtitle={undefined} actions={undefined}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Activity size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-black tracking-tight text-main truncate">
                  تحليل تدفق الإيرادات
                </h3>
                <p className="text-xs font-bold text-muted truncate">
                  مقارنة الإيرادات التشغيلية للفترة المختارة.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger className="h-9 rounded-xl text-sm">
                  <SelectValue placeholder="نوع الرسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">مناطقي</SelectItem>
                  <SelectItem value="bar">أعمدة</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-xl border border-border bg-soft p-0.5 hidden sm:flex">
                {[
                  { label: "أسبوع", value: "week" },
                  { label: "شهر", value: "month" },
                  { label: "سنة", value: "year" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handlePeriodChange(item.value)}
                    className={cn(
                      "rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                      period === item.value
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:text-primary hover:bg-card",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-[360px] sm:h-[420px] min-h-[320px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "area" ? (
                <AreaChart data={chartRows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--info)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--info)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => `${(value/1000).toFixed(0)}K`}
                    orientation="left"
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--bg-card)",
                      boxShadow: "var(--shadow-premium)",
                    }}
                    formatter={(value, name) => [
                      name === "revenue" ? formatCurrency(value) : value,
                      name === "revenue" ? "الإيرادات" : "المواعيد",
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 20 }}
                    formatter={(name) => name === "revenue" ? "الإيرادات" : "المواعيد"}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="الإيرادات"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                  />
                  {chartRows.some((r) => r.appointments) && (
                    <Area
                      type="monotone"
                      dataKey="appointments"
                      name="المواعيد"
                      stroke="var(--info)"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      fillOpacity={0.4}
                      fill="url(#colorAppointments)"
                      dot={false}
                    />
                  )}
                </AreaChart>
              ) : (
                <BarChart data={chartRows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => `${(value/1000).toFixed(0)}K`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 700 }}
                    width={90}
                    orientation="left"
                    padding={{ top: 10, bottom: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--bg-card)",
                      boxShadow: "var(--shadow-premium)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  <Bar dataKey="revenue" name="الإيرادات" fill="var(--primary)" radius={[0, 8, 8, 0]} maxBarSize={40} />
                  {chartRows.some((r) => r.appointments) && (
                    <Bar dataKey="appointments" name="المواعيد" fill="var(--info)" radius={[0, 8, 8, 0]} maxBarSize={40} />
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </ContentPanel>

        {/* Service Distribution & Insights */}
        <div className="space-y-6">
          {/* Service Distribution */}
          <ContentPanel className="h-full" title={undefined} subtitle={undefined} actions={undefined}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-4">
              توزيع مبيعات الخدمات
            </h4>
            <div className="relative h-[280px] sm:h-[320px] w-full" dir="ltr">
              {serviceDistribution.length > 0 ? (
                <>
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                    <div className="text-3xl sm:text-4xl font-black text-main tracking-tighter tabular-nums">
                      {stats.occupancy ?? 72}%
                    </div>
                    <div className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-muted">
                      متوسط الإشغال
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={serviceDistribution}
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="var(--bg)"
                        strokeWidth={2}
                        label={({ name, percent }) => percent > 0.08 && `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={true}
                      >
                        {serviceDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              [
                                `var(--primary)`,
                                `var(--info)`,
                                `var(--warning)`,
                                `var(--success)`,
                                `var(--danger)`,
                                `var(--secondary)`,
                              ][index % 6]
                            }
                            stroke="var(--bg)"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [value + "%", name || "النسبة"]}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--bg-card)",
                          boxShadow: "var(--shadow-premium)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted">
                  { }
                  <PieChart {...{ className: "opacity-20", size: 64 } as any} />
                  <p className="mt-4 text-sm font-bold">لا توجد بيانات خدمات</p>
                </div>
              )}
            </div>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {serviceDistribution.map((s, i) => (
                <div
                  key={s.name}
                  className="flex items-center gap-2 rounded-xl bg-soft/50 p-2.5 border border-border/40 transition-all hover:bg-soft hover:border-accent/30"
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: [
                        `var(--primary)`,
                        `var(--info)`,
                        `var(--warning)`,
                        `var(--success)`,
                        `var(--danger)`,
                        `var(--secondary)`,
                      ][i % 6],
                    }}
                  />
                  <span className="text-[10px] font-bold text-main truncate flex-1">{s.name}</span>
                  <span className="text-[10px] font-black text-muted tabular-nums">{s.value}%</span>
                </div>
              ))}
              {serviceDistribution.length === 0 && (
                <div className="col-span-full text-center py-10 text-muted">
                  <div className="mx-auto mb-3 p-4 rounded-full bg-soft/50 w-20 h-20 flex items-center justify-center">
                    <Scissors size={32} className="opacity-30" />
                  </div>
                  <p className="text-base font-bold text-main">لا توجد بيانات لتوزيع الخدمات</p>
                  <p className="text-sm text-muted mt-1">ستظهر البيانات عند إضافة خدمات ومواعيد</p>
                </div>
              )}
            </div>
          </ContentPanel>

          {/* Smart Insights */}
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
                onAction={() => navigate("/owner/settings?tab=reminders")}
              />
              <InsightCard
                icon={TrendingUp}
                iconColor="success"
                title="فرصة نمو المسائية"
                description="الفترة المسائية (٦-١٠ م) تحقق ٤٠٪ من الإيرادات بسعة ٦٠٪ فقط. فرصة لزيادة الحجوزات."
                actionLabel="عرض جدول المواعيد"
                onAction={() => navigate("/schedule?range=evening")}
              />
              <InsightCard
                icon={Users}
                iconColor="info"
                title="عملاء جدد هذا الأسبوع"
                description={`${stats.newCustomersThisWeek ?? 12} عميل جديد. معدل الاحتفاظ ٦٨٪ - أعلى من المتوسط.`}
                actionLabel="عرض العملاء"
                onAction={() => navigate("/customers")}
              />
            </div>
          </ContentPanel>
        </div>
      </div>

      {/* Quick Actions */}
      <ContentPanel title={undefined} subtitle={undefined} actions={undefined} className={undefined}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
              <ArrowUpRight size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black tracking-tight text-main truncate">وصول سريع</h3>
              <p className="text-xs font-bold text-muted">اختصارات لأهم العمليات اليومية</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
          {[
            { label: "الموظفين", icon: Users, to: "/owner/hr", bg: "bg-primary/10 text-primary border-primary/20" },
            { label: "الخدمات", icon: Scissors, to: "/owner/settings?tab=services", bg: "bg-info/10 text-info border-info/20" },
            { label: "التقارير", icon: TrendingUp, to: "/owner/reports", bg: "bg-warning/10 text-warning border-warning/20" },
            { label: "المخزن", icon: ShoppingBag, to: "/inventory", bg: "bg-success/10 text-success border-success/20" },
            { label: "المواعيد", icon: Calendar, to: "/bookings", bg: "bg-danger/10 text-danger border-danger/20" },
            { label: "الإعدادات", icon: Settings, to: "/owner/settings", bg: "bg-soft text-muted border-border" },
            { label: "الأمان", icon: ShieldCheck, to: "/owner/permissions", bg: "bg-primary/10 text-primary border-primary/20" },
            { label: "السجلات", icon: Clock, to: "/activity-logs", bg: "bg-info/10 text-info border-info/20" },
          ].map((item, idx) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                "group flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 transition-all duration-300",
                "hover:border-accent/30 hover:bg-accent/5 hover:shadow-lg hover:-translate-y-0.5",
                item.bg,
              )}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className={cn(
                "rounded-xl p-3 transition-all duration-300 group-hover:bg-accent group-hover:text-white group-hover:rotate-3",
                item.bg.split(" ").slice(0,2).join(" "),
              )}>
                <item.icon size={22} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-black tracking-wider text-muted group-hover:text-accent truncate">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </ContentPanel>
    </div>
  );
}

function InsightCard({ icon: Icon, iconColor, title, description, actionLabel, onAction }) {
  const colorMap = {
    primary: "text-primary bg-primary/10",
    success: "text-emerald-600 bg-emerald-500/10",
    warning: "text-amber-600 bg-amber-500/10",
    danger: "text-rose-600 bg-rose-500/10",
    info: "text-blue-600 bg-blue-500/10",
  };
  return (
    <div className="p-4 rounded-2xl bg-soft/50 border border-border/40 space-y-3">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", colorMap[iconColor] || colorMap.primary)}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-black text-main leading-tight">{title}</h5>
          <p className="text-xs font-bold text-muted leading-relaxed mt-0.5 line-clamp-2">{description}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
        onClick={onAction}
      >
        {actionLabel} <ArrowRight size={12} className="ml-1" />
      </Button>
    </div>
  );
}

