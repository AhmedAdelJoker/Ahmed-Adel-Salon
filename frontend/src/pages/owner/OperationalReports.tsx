import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Download,
  Calendar,
  Sparkles,
  Search,
  ArrowRightLeft,
  Users,
  Scissors,
  Star,
  Award,
  Zap,
  Clock,
  LayoutGrid,
  History,
  Activity,
  ArrowUp,
  ArrowDown,
  LineChart,
  PieChart,
} from "lucide-react";
import { reportService } from "@/services/reportService";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportToPDF } from "@/lib/export/utils";
import { aiService } from "@/services/aiService";
import AIInsights from "@/components/AIInsights";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Cell,
  PieChart as RePieChart,
  Pie,
} from "recharts";
import { cn } from "@/lib/core/utils";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { useOperationalReports } from "@/features/operational-reports";

const CHART_COLORS = [
  "#6D28D9",
  "#22D3EE",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#EC4899",
];

// Native JS replacement for date-fns format(date, 'yyyy-MM-dd')
 
const formatDate = (date: any, _format?: string) => {
  const d = new Date(date);
  const month = "" + (d.getMonth() + 1);
  const day = "" + d.getDate();
  const year = d.getFullYear();

  return [year, month.padStart(2, "0"), day.padStart(2, "0")].join("-");
};

 
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 border border-border p-4 rounded-2xl shadow-premium backdrop-blur-md">
        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-8"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs font-bold text-muted">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-black text-main">
                {Number(entry.value).toLocaleString()} ج.م
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const VARIANT_COLOR_MAP = {
  primary: "bg-primary text-white",
  success: "bg-emerald-500 text-white",
  warning: "bg-amber-500 text-white",
  danger: "bg-rose-500 text-white",
  info: "bg-sky-500 text-white",
  secondary: "bg-slate-500 text-white",
};

interface OpStatCardProps {
  title?: string;
  label?: string;
  value?: React.ReactNode;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  trend?: string;
  trendValue?: React.ReactNode;
  color?: string;
   
  variant?: any;
  description?: React.ReactNode;
  isGrowth?: boolean;
}

const StatCard = ({
  title,
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  color,
  variant,
  description,
  isGrowth = true,
}: OpStatCardProps) => {
  const displayTitle = label || title || "";
  const displayColor = color || VARIANT_COLOR_MAP[variant] || VARIANT_COLOR_MAP.primary;
  return (
    <Card className="overflow-hidden border-border/50 shadow-sm rounded-3xl hover:translate-y-[-2px] transition-all duration-300 group bg-card/95">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "p-3 rounded-2xl transition-all duration-500 group-hover:scale-105 shadow-sm",
              displayColor,
            )}
          >
            <Icon size={20} className="text-white" />
          </div>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0",
                trend === "up"
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger",
              )}
            >
              {trend === "up" ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              {trendValue}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black text-muted uppercase tracking-[0.15em] mb-1 truncate">
            {displayTitle}
          </p>
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="text-2xl font-black text-main tabular-nums tracking-tighter leading-none truncate">
              {value}
            </h3>
          </div>
          {description && (
            <div className="mt-4 flex items-center gap-2 pt-4 border-t border-border">
              <div className="p-1 rounded-md bg-soft shrink-0">
                <Activity size={10} className="text-muted" />
              </div>
              <p className="text-[9px] font-bold text-muted line-clamp-2">{description}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function OperationalReports() {
  const {
    activeTab, setActiveTab, loading, lastUpdated,
    startDate, setStartDate, endDate, setEndDate,
    searchQuery, setSearchQuery,
    financialMetrics, operationalMetrics, aiInsights, filteredHistory,
    transactions,
  } = useOperationalReports();

  if (loading && !transactions.length)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse" />
            <Sparkles className="h-16 w-16 text-[#6D28D9] dark:text-[#22D3EE] animate-bounce relative" />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">
              جاري بناء اللوحة التشغيلية المعززة
            </p>
            <div className="h-1 w-32 bg-slate-100 dark:bg-white/5 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-indigo-500 w-1/2 animate-[shimmer_1.5s_infinite]" />
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="erp-page space-y-6 pb-8" dir="rtl">
      <PageHeader
        title="المركز التشغيلي"
        subtitle="تحليل ذكي متكامل للأداء المالي والكفاءة التشغيلية"
        badge="التقارير التشغيلية"
        icon={LayoutGrid}
        className={undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-card border border-border rounded-xl p-1 shadow-sm">
              <div className="flex items-center px-3 border-l border-border">
                <Calendar size={14} className="text-muted ml-2" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold outline-none w-32"
                />
              </div>
              <div className="flex items-center px-3">
                <Calendar size={14} className="text-muted ml-2" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold outline-none w-32"
                />
              </div>
            </div>
            <Button
              variant="primary"
              className="h-10 rounded-xl px-4 text-xs font-black"
              onClick={() => {
                try {
                  const rows = [
                    ["تاريخ", "دخل", "خرج", "صافي"],
                    ...financialMetrics.timeline.map((d) => [d.date, d.income, d.expenses, d.income - d.expenses]),
                    [],
                    ["الخدمات الأكثر طلباً", "العدد", "الإيراد"],
                    ...operationalMetrics.topServices.map((s) => [s.name, s.count, s.revenue]),
                  ];
                  exportToPDF("التقرير التشغيلي الشامل", rows);
                  toast.success("تم تصدير التقرير الشامل");
                } catch (_e) { toast.error("تعذر التصدير"); }
              }}
            >
              <Download size={14} className="ml-1.5" /> تصدير
            </Button>
          </div>
        }
      />


      {/* Cross-Functional Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        <StatCard
          label="صافي الأرباح التشغيلية"
          value={`${financialMetrics.net.toLocaleString()} ج.م`}
          icon={Wallet}
          variant="success"
          trend={financialMetrics.net > 0 ? "up" : "down"}
          trendValue="12.4%+"
        />
        <StatCard
          label="إجمالي الخدمات المنفذة"
          value={operationalMetrics.totalServices}
          icon={Scissors}
          variant="info"
          trend="up"
          trendValue="8%"
        />
        <StatCard
          label="العملاء النشطون"
          value={operationalMetrics.totalCustomers}
          icon={Users}
          variant="primary"
          trend="up"
          trendValue="15%"
        />
        <StatCard
          label="متوسط جودة الخدمة"
          value="4.9 / 5"
          icon={Star}
          variant="warning"
          trend="up"
          trendValue="—"
        />
      </div>

      {/* Unified Navigation Tabs - Premium Segmented Control */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 p-2 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[32px] border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex gap-2 p-1.5 w-full md:w-auto">
          {[
            { id: "finance", label: "التحليل المالي", icon: TrendingUp },
            { id: "operations", label: "كفاءة التشغيل", icon: Activity },
            { id: "history", label: "سجل العمليات", icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black transition-all duration-500 uppercase tracking-widest",
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-900 shadow-premium text-indigo-600 dark:text-sky-400 scale-105 z-10"
                  : "text-slate-500 hover:bg-white/50 dark:hover:bg-white/5",
              )}
            >
              <tab.icon
                size={18}
                className={cn(activeTab === tab.id ? "animate-pulse" : "")}
              />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-4 px-6 text-slate-400 border-r border-slate-200/60 dark:border-slate-800/60">
          <Clock size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            آخر تحديث: {lastUpdated.toLocaleTimeString("ar-EG")}
          </span>
        </div>
      </div>

      {/* Tab Content Rendering */}
      <div className="space-y-10 min-h-[600px]">
        {activeTab === "finance" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 animate-in fade-in slide-in-from-bottom-6">
            <Card className="xl:col-span-2 border-none shadow-premium rounded-[32px] sm:rounded-[48px] overflow-hidden bg-white dark:bg-slate-900 group">
              <CardHeader className="p-6 sm:p-8 lg:p-12 border-b border-slate-50 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                      <LineChart size={20} />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight">
                      ديناميكية التدفقات النقدية
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">
                    مقارنة تحليلية دقيقة بين الإيداعات والمصروفات التشغيلية
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                      الدخل
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                      المصروفات
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 lg:p-12">
                <div className="h-[300px] sm:h-[360px] lg:h-[450px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialMetrics.timeline}>
                      <defs>
                        <linearGradient
                          id="opIncome"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="opExpenses"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f43f5e"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f43f5e"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="10 10"
                        vertical={false}
                        stroke="#88888810"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fontWeight: 900,
                          fill: "#888888",
                        }}
                        dy={10}
                        interval="preserveStartEnd"
                        minTickGap={20}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 900,
                          fill: "#888888",
                        }}
                        width={60}
                      />
                      <ReTooltip
                        content={<CustomTooltip />}
                        cursor={{
                          stroke: "var(--accent)",
                          strokeWidth: 1,
                          strokeDasharray: "5 5",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        name="إجمالي الدخل"
                        stroke="#10b981"
                        strokeWidth={4}
                        fill="url(#opIncome)"
                        animationDuration={2000}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        name="إجمالي المصروفات"
                        stroke="#f43f5e"
                        strokeWidth={4}
                        fill="url(#opExpenses)"
                        animationDuration={2000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-10">
              <Card className="border-none shadow-2xl rounded-[32px] sm:rounded-[48px] p-6 sm:p-8 lg:p-12 bg-gradient-to-br from-indigo-700 via-indigo-900 to-slate-900 text-white overflow-hidden relative">
                <div className="relative z-10 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl">
                      <Sparkles
                        size={28}
                        className="text-sky-300 animate-pulse"
                      />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight italic">
                      AI INSIGHTS
                    </h3>
                  </div>
                  <AIInsights data={aiInsights} isSidebar />
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-[80px] -ml-24 -mb-24" />
              </Card>

              <Card className="border-none shadow-premium rounded-[32px] sm:rounded-[48px] p-6 sm:p-8 lg:p-12 bg-white dark:bg-slate-900 overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black uppercase tracking-[0.25em] text-slate-400 group-hover:text-indigo-500 transition-colors">
                    هيكلية التكاليف
                  </h3>
                  <PieChart size={20} className="text-slate-300" />
                </div>
                <div className="h-[280px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={financialMetrics.categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={10}
                        dataKey="value"
                        animationDuration={1500}
                      >
                        {financialMetrics.categories.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <ReTooltip content={<CustomTooltip />} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {financialMetrics.categories.slice(0, 4).map((cat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span className="text-[10px] font-black text-slate-500 uppercase truncate">
                        {cat.name}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "operations" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-6">
            <Card className="border-none shadow-premium rounded-[32px] sm:rounded-[48px] p-6 sm:p-8 lg:p-12 bg-white dark:bg-slate-900 group">
              <CardHeader className="px-0 pb-8 sm:pb-12 border-b border-slate-50 dark:border-white/5 mb-10 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                      <Scissors size={20} />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight">
                      كفاءة الخدمات
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    تصنيف الخدمات الأكثر طلباً وتأثيراً على الإيرادات
                  </CardDescription>
                </div>
              </CardHeader>
              <div className="h-[400px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={operationalMetrics.topServices}
                    layout="vertical"
                    margin={{ left: 40 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 900, fill: "#888888" }}
                      width={120}
                    />
                    <ReTooltip cursor={{ fill: "#88888808" }} />
                    <Bar dataKey="count" radius={[0, 12, 12, 0]} barSize={32}>
                      {operationalMetrics.topServices.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="border-none shadow-premium rounded-[32px] sm:rounded-[48px] p-6 sm:p-8 lg:p-12 bg-white dark:bg-slate-900 group">
              <CardHeader className="px-0 pb-8 sm:pb-12 border-b border-slate-50 dark:border-white/5 mb-10 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                      <Award size={20} />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight">
                      إنتاجية الفريق
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    مؤشر الأداء الفني وتقييم جودة العمل لكل موظف
                  </CardDescription>
                </div>
              </CardHeader>
              <div className="space-y-8">
                {operationalMetrics.topBarbers.map((barber, i) => (
                  <div
                    key={barber.name}
                    className="flex items-center gap-6 p-6 bg-slate-50/50 dark:bg-white/5 rounded-[32px] group transition-all duration-500 hover:translate-x-[-12px] hover:shadow-lg hover:bg-white dark:hover:bg-slate-800"
                  >
                    <div className="w-16 h-16 bg-white dark:bg-slate-950 rounded-2xl flex items-center justify-center font-black text-xl shadow-soft group-hover:scale-110 transition-transform">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-sky-400 transition-colors">
                          {barber.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            {barber.count} عملية
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-black border-indigo-500/20 text-indigo-500"
                          >
                            TOP PERFORMER
                          </Badge>
                        </div>
                      </div>
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1500 ease-out"
                          style={{
                            width: `${(barber.count / (operationalMetrics.topBarbers[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                      <Star
                        size={16}
                        fill="#F59E0B"
                        className="text-amber-500"
                      />
                      <span className="font-black text-sm text-amber-600">
                        {barber.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="xl:col-span-2 border-none shadow-premium rounded-[48px] p-12 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 overflow-hidden relative">
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg">
                    <Zap size={24} className="text-white animate-pulse" />
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                    الرؤى التشغيلية الذكية
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">
                      توزيع النشاط خلال اليوم (Heatmap)
                    </p>
                    <div className="h-[250px] w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={operationalMetrics.hourlyData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#88888810"
                          />
                          <XAxis
                            dataKey="hour"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fontSize: 9,
                              fontWeight: 900,
                              fill: "#888888",
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill="var(--accent)"
                            radius={[4, 4, 0, 0]}
                            opacity={0.6}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[40px] shadow-soft group hover:border-indigo-500/30 transition-all">
                      <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Clock size={24} />
                      </div>
                      <h4 className="text-lg font-black mb-3">ساعات الذروة</h4>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                        يُظهر التحليل ضغطاً تشغيلياً عالياً بين الساعة 5 مساءً و
                        8 مساءً.
                        <span className="text-indigo-600 dark:text-sky-400 font-black">
                          {" "}
                          يُنصح بتفعيل نظام الحجز المسبق لهذه الفترة.
                        </span>
                      </p>
                    </div>

                    <div className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[40px] shadow-soft group hover:border-emerald-500/30 transition-all">
                      <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <TrendingUp size={24} />
                      </div>
                      <h4 className="text-lg font-black mb-3">فرص النمو</h4>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                        باقة "العناية المتكاملة" تحقق أعلى معدل عودة للعملاء.
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">
                          {" "}
                          استهدف العملاء الجدد بعروض مخصصة لهذه الباقة.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Abstract decorative background */}
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />
            </Card>
          </div>
        )}

        {activeTab === "history" && (
          <Card className="border-none shadow-premium rounded-[56px] overflow-hidden bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-6">
            <CardHeader className="p-12 border-b border-slate-50 dark:border-white/5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl">
                    <History size={22} />
                  </div>
                  <CardTitle className="text-3xl font-black uppercase tracking-tight">
                    سجل الحركات التشغيلية
                  </CardTitle>
                </div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  مراجعة شاملة لجميع العمليات المالية والتشغيلية الموثقة
                </p>
              </div>

              <div className="relative group w-full lg:w-96">
                <Search
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="بحث عن عملية محددة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-6 pr-14 py-5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-white/5 rounded-[24px] text-sm font-bold focus:ring-4 ring-indigo-500/10 transition-all outline-none"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-50/50 dark:bg-slate-950/50">
                    <tr>
                      <th className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        التوقيت
                      </th>
                      <th className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        التوصيف والبيان
                      </th>
                      <th className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        التصنيف
                      </th>
                      <th className="px-12 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                        الحالة
                      </th>
                      <th className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        القيمة المالية
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredHistory.map((t, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50/50 dark:hover:bg-white/2 transition-all duration-300 group"
                      >
                        <td className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                              {(t.transaction_date || t.created_at || "").slice(
                                0,
                                10,
                              )}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              {new Date(t.created_at).toLocaleTimeString(
                                "ar-EG",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8 max-w-md">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-sky-400 transition-colors">
                            {t.note || "عملية تشغيلية اعتيادية"}
                          </p>
                        </td>
                        <td className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8">
                          <Badge
                            variant="secondary"
                            className="px-4 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest border-none"
                          >
                            {t.category || "GENERAL"}
                          </Badge>
                        </td>
                        <td className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8 text-center">
                          <div
                            className={cn(
                              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter",
                              t.direction === "in"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {t.direction === "in" ? (
                              <ArrowUp size={14} />
                            ) : (
                              <ArrowDown size={14} />
                            )}
                            {t.direction === "in"
                              ? "إيداع نقدي"
                              : "مصروف تشغيلي"}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 lg:px-12 py-4 sm:py-8">
                          <div
                            className={cn(
                              "text-lg font-black tabular-nums tracking-tighter",
                              t.direction === "in"
                                ? "text-emerald-600"
                                : "text-rose-600",
                            )}
                          >
                            {t.direction === "in" ? "+" : "-"}
                            {Number(t.amount).toLocaleString()}
                            <span className="text-[10px] mr-1 opacity-60">
                              ج.م
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredHistory.length === 0 && (
                  <div className="py-32 text-center bg-slate-50/30 dark:bg-slate-950/30">
                    <div className="relative inline-block mb-6">
                      <div className="absolute inset-0 bg-slate-200 rounded-full blur-2xl opacity-50 animate-pulse" />
                      <ArrowRightLeft className="h-20 w-20 text-slate-200 dark:text-white/5 relative" />
                    </div>
                    <p className="text-base font-black text-slate-400 uppercase tracking-[0.3em]">
                      لا توجد سجلات تطابق محددات البحث
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
