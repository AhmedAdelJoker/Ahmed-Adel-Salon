import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Activity,
  Banknote,
  Calendar,
  Clock,
  LayoutDashboard,
  Receipt,
  Scissors,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  Settings,
  ShieldCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { adaptList, adaptObject } from "../../services/apiAdapter";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn, formatCurrency } from "../../lib/utils";
import DashboardFilters from "../../components/common/DashboardFilters";
import DashboardPanel from "../../components/common/DashboardPanel";

const KPI_CARDS = [
  {
    key: "todayRevenue",
    label: "إيرادات اليوم",
    icon: Wallet,
    trend: "",
    variant: "accent",
  },
  {
    key: "todayExpenses",
    label: "مصروفات اليوم",
    icon: TrendingDown,
    trend: "",
    variant: "danger",
  },
  {
    key: "netProfit",
    label: "صافي الربح",
    icon: Banknote,
    trend: "",
    variant: "success",
  },
  {
    key: "todayAppointments",
    label: "حجوزات اليوم",
    icon: Calendar,
    trend: "",
    variant: "info",
  },
  {
    key: "avgInvoice",
    label: "متوسط الفاتورة",
    icon: Receipt,
    trend: "",
    variant: "warning",
  },
  {
    key: "monthGoal",
    label: "هدف الشهر",
    icon: Target,
    trend: "",
    variant: "secondary",
  },
];

export default function ReportsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportScope = searchParams.get("scope");
  const employeeId = searchParams.get("employeeId");

  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayExpenses: 0,
    netProfit: 0,
    todayAppointments: 0,
    avgInvoice: 0,
    monthGoal: 0,
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/owner/dashboard-stats", {
        params: { scope: reportScope, employee_id: employeeId },
      });
      const data = adaptObject(res.data);
      setStats(data.stats || {});
      setWeeklyData(data.weekly_data || []);
    } catch (err) {
      console.error(err);
      toast.error("تعذر تحميل البيانات الإحصائية");
    } finally {
      setLoading(false);
    }
  }, [reportScope, employeeId]);

  useEffect(() => {
    let alive = true;
    loadData();
    return () => {
      alive = false;
    };
  }, [loadData]);

  const chartRows = useMemo(
    () => (Array.isArray(weeklyData) ? weeklyData : []),
    [weeklyData],
  );
  const displayName = user?.full_name || "المدير";

  if (loading && stats.todayRevenue === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#6D28D9] dark:text-[#22D3EE]">
          <LayoutDashboard className="h-10 w-10 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            جاري تحضير مصفوفة البيانات...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-6 pb-6 sm:space-y-8" dir="rtl">
      <div className="erp-page__filters">
        <div className="page-header">
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              أهلاً بك، {displayName}
            </h1>
            <p className="page-subtitle">
              نظرة إستراتيجية شاملة على مؤشرات الأداء اليومي
            </p>
          </div>

          <div className="surface-toolbar flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <DashboardFilters
              scope={reportScope}
              onScopeChange={(s) => navigate(`?scope=${s}`)}
            />
            <Button
              onClick={loadData}
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-2xl border-slate-200/60 bg-white/50 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50"
            >
              <Activity
                className={cn("h-5 w-5", loading ? "animate-spin" : "")}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats Section ── */}
      <div className="erp-page__stats">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {KPI_CARDS.map((kpi) => {
            const Icon = kpi.icon;
            const value = stats[kpi.key] || 0;
            const isMoney = [
              "todayRevenue",
              "todayExpenses",
              "netProfit",
              "avgInvoice",
            ].includes(kpi.key);

            return (
              <Card
                key={kpi.key}
                className="group relative overflow-hidden border-slate-200/60 shadow-sm transition-all duration-500 hover:border-indigo-500/30 hover:shadow-2xl dark:border-slate-800/60 dark:hover:border-sky-400/30"
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-xl transition-transform duration-500 group-hover:scale-110 sm:h-14 sm:w-14",
                        kpi.variant === "danger" &&
                          "bg-rose-600 shadow-rose-500/20",
                        kpi.variant === "success" &&
                          "bg-emerald-600 shadow-emerald-500/20",
                        kpi.variant === "warning" &&
                          "bg-amber-500 shadow-amber-500/20",
                        kpi.variant === "info" &&
                          "bg-sky-600 shadow-sky-500/20",
                        !["danger", "success", "warning", "info"].includes(
                          kpi.variant,
                        ) &&
                          "bg-indigo-600 dark:bg-sky-400 dark:text-slate-900 shadow-indigo-500/20",
                      )}
                    >
                      <Icon size={26} strokeWidth={2} />
                    </div>
                    {kpi.trend ? (
                      <Badge
                        variant={kpi.trend.includes("+") ? "success" : "danger"}
                        className="rounded-lg"
                      >
                        {kpi.trend}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {kpi.label}
                    </div>
                    <div className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white sm:text-3xl">
                      {kpi.key === "monthGoal"
                        ? `${value}%`
                        : isMoney
                          ? formatCurrency(value)
                          : value.toLocaleString("ar-EG")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Main Content Section ── */}
      <div className="erp-page__table">
        <div className="table-wrapper no-scrollbar">
          <div className="grid grid-cols-1 gap-6 pb-8 xl:grid-cols-3">
            <Card className="lg:col-span-2 border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
              <CardHeader className="flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight">
                    تحليل تدفق الإيرادات{" "}
                    <TrendingUp
                      size={20}
                      className="text-indigo-600 dark:text-sky-400"
                    />
                  </CardTitle>
                  <CardDescription className="text-xs font-bold">
                    مصفوفة الإيرادات التشغيلية للفترة المختارة
                  </CardDescription>
                </div>
                <div className="chip-scroller rounded-2xl border border-slate-200/60 bg-slate-50 p-1.5 dark:border-slate-800/60 dark:bg-white/5 shadow-inner">
                  {[
                    { label: "أسبوعي", value: "week" },
                    { label: "شهري", value: "month" },
                    { label: "سنوي", value: "year" },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => setPeriod(item.value)}
                      className={cn(
                        "rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                        period === item.value
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 dark:bg-sky-400 dark:text-slate-900"
                          : "text-slate-400 hover:text-indigo-600 dark:hover:text-sky-400",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="h-[320px] pt-6 sm:h-[380px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartRows}>
                    <defs>
                      <linearGradient
                        id="colorRevenue"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--accent)"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--accent)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "var(--text-muted)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                      dy={15}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "var(--text-muted)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "20px",
                        border: "none",
                        backgroundColor: "var(--bg-card)",
                        color: "var(--text-main)",
                        fontSize: "10px",
                        fontWeight: "900",
                        boxShadow: "var(--shadow-premium)",
                      }}
                      cursor={{ stroke: "var(--accent)", strokeWidth: 1.5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--accent)"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                    كفاءة توزيع الخدمات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-64 w-full" dir="ltr">
                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                      <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                        ٧٢٪
                      </div>
                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        متوسط الإشغال
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "A", value: 45 },
                            { name: "B", value: 30 },
                            { name: "C", value: 25 },
                          ]}
                          innerRadius={85}
                          outerRadius={110}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="var(--accent)" stroke="none" />
                          <Cell fill="var(--info)" stroke="none" />
                          <Cell fill="var(--warning)" stroke="none" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-500/20 bg-indigo-50/40 dark:border-sky-400/20 dark:bg-sky-900/10 shadow-none backdrop-blur-xl">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 dark:bg-sky-400 dark:text-slate-950">
                      <Zap size={22} />
                    </div>
                    <Badge
                      variant="accent"
                      className="rounded-full px-4 text-[9px] font-black uppercase tracking-widest"
                    >
                      تنبيه ذكي
                    </Badge>
                  </div>
                  <p className="text-sm font-bold leading-7 text-slate-700 dark:text-slate-200">
                    تم رصد زيادة في معدل الحجوزات الملغاة هذا الأسبوع بنسبة ٥٪.
                    نقترح مراجعة سياسة التأكيد.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/owner/reports")}
                    className="mt-8 w-full text-[10px] font-black uppercase tracking-widest h-12 rounded-xl"
                  >
                    تحليل الأسباب <Activity size={16} className="mr-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-8 sm:grid-cols-4 xl:grid-cols-8">
            {[
              { label: "الموظفين", icon: Users, to: "/owner/hr" },
              {
                label: "الخدمات",
                icon: Scissors,
                to: "/owner/settings?tab=services",
              },
              { label: "التقارير", icon: TrendingUp, to: "/owner/reports" },
              { label: "المخزن", icon: ShoppingBag, to: "/inventory" },
              { label: "المواعيد", icon: Calendar, to: "/bookings" },
              { label: "الإعدادات", icon: Settings, to: "/owner/settings" },
              { label: "الأمان", icon: ShieldCheck, to: "/owner/permissions" },
              { label: "السجلات", icon: Clock, to: "/activity-logs" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="group flex min-h-[9rem] flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-slate-200/60 bg-white/40 p-4 text-center shadow-sm transition-all duration-300 hover:border-indigo-600/30 hover:bg-indigo-50/50 hover:shadow-xl sm:min-h-[10rem] sm:rounded-[2rem] sm:p-5 dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:border-sky-400/30 dark:hover:bg-sky-900/10"
                >
                  <div className="rounded-[1.25rem] bg-slate-50/50 p-4 text-slate-400 transition-all duration-500 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-12 dark:bg-white/5 dark:group-hover:bg-sky-400 dark:group-hover:text-slate-900">
                    <Icon size={28} strokeWidth={1.8} />
                  </div>
                  <span className="text-center text-[10px] font-black tracking-widest text-slate-500 transition-colors group-hover:text-indigo-600 dark:group-hover:text-sky-400">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
