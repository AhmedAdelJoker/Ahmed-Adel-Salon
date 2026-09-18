import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  Clock,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Target,
  ShieldCheck,
  PieChart as PieChartIcon,
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
import { useNavigate } from "react-router-dom";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/core/utils";
import {
  PageHeader,
  PremiumCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";

const KPI_CONFIG = [
  {
    key: "todayRevenue",
    label: "إيرادات اليوم",
    icon: Wallet,
    variant: "accent",
  },
  {
    key: "todayExpenses",
    label: "مصروفات اليوم",
    icon: TrendingDown,
    variant: "danger",
  },
  { key: "netProfit", label: "صافي الربح", icon: Banknote, variant: "success" },
  {
    key: "avgInvoice",
    label: "متوسط الفاتورة",
    icon: Receipt,
    variant: "warning",
  },
  {
    key: "unconfirmedRevenue",
    label: "إيرادات معلقة",
    icon: Clock,
    variant: "info",
  },
  {
    key: "monthlyGrowth",
    label: "نمو الشهر الحالي",
    icon: TrendingUp,
    variant: "secondary",
  },
];

export default function AccountantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayExpenses: 0,
    netProfit: 0,
    avgInvoice: 0,
    unconfirmedRevenue: 0,
    monthlyGrowth: 0,
  });
   
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/owner/dashboard-stats");
       
      const data: any = adaptObject(res.data);
      setStats(data.stats || {});
      setWeeklyData(data.weekly_data || []);
    } catch (err) {
      console.error(err);
      toast.error("تعذر تحميل البيانات المالية");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartRows = useMemo(
    () => (Array.isArray(weeklyData) ? weeklyData : []),
    [weeklyData],
  );

  if (loading && stats.todayRevenue === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <PieChartIcon className="h-10 w-10 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
            جاري تحليل المؤشرات المالية...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-8 pb-8">
      <PageHeader
        title={`مرحباً، ${user?.full_name || "المحاسب"}`}
        subtitle="نظام التحليل المالي والتدقيق المحاسبي الموحد."
        badge="مركز الرقابة المالية والإدارية"
        icon={ShieldCheck}
        className={undefined}
        actions={
          <>
            <Button
              onClick={() => navigate("/owner/financial")}
              className="h-11 shadow-accent"
            >
              التقارير المالية
            </Button>
            <Button onClick={loadData} variant="outline" className="h-11">
              <Activity
                className={cn("ml-2 h-4 w-4", loading ? "animate-spin" : "")}
              />
              تحديث الأرقام
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPI_CONFIG.map((kpi, idx) => (
          <StatCard
            key={kpi.key}
            label={kpi.label}
            value={
              kpi.key === "monthlyGrowth"
                ? `${stats[kpi.key as keyof typeof stats] || 0}%`
                : formatCurrency(stats[kpi.key as keyof typeof stats] || 0)
            }
            icon={kpi.icon}
            variant={kpi.variant}
            trend={undefined}
            trendValue={undefined}
            delay={idx * 0.05}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PremiumCard wrapperClassName="lg:col-span-2 min-w-0" noPadding>
          <div className="p-6 sm:p-8">
            <h3 className="flex items-center gap-3 text-xl font-black tracking-tight">
              منحنى النمو المالي{" "}
              <TrendingUp size={20} className="text-emerald-500" />
            </h3>
            <p className="mt-1 text-xs font-bold text-muted">
              مقارنة الإيرادات اليومية والاتجاه العام للسيولة.
            </p>
          </div>
          <div className="h-[320px] pb-8 pr-4 sm:h-[380px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                    boxShadow: "var(--shadow-premium)",
                  }}
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
          </div>
        </PremiumCard>

        <div className="space-y-6">
          <PremiumCard className={undefined}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">
              مؤشر صحة التدفق النقدي
            </h4>
            <div className="relative mt-4 h-64 w-full" dir="ltr">
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                <div className="text-5xl font-black text-main tracking-tighter">
                  ٨٨٪
                </div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.3em] text-muted">
                  كفاءة التحصيل
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "تحصيل", value: 88 },
                      { name: "معلق", value: 12 },
                    ]}
                    innerRadius={85}
                    outerRadius={110}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill="var(--accent)" stroke="none" />
                    <Cell fill="var(--danger)" stroke="none" opacity={0.1} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>

          <PremiumCard className="border-accent/10 bg-accent/5">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-accent">
                <Target size={22} />
              </div>
              <Badge
                variant="default"
                className="text-[9px] font-black uppercase tracking-widest"
              >
                تنبيه ذكي
              </Badge>
            </div>
            <p className="text-sm font-bold leading-7 text-main">
              معدل المصروفات النثرية زاد بنسبة ١٢٪ عن الشهر الماضي. يفضل مراجعة
              بنود المشتريات الاستهلاكية.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/expenses")}
              className="mt-8 w-full text-[10px] font-black uppercase tracking-widest h-12 rounded-xl"
            >
              مراجعة المصروفات <TrendingDown size={16} className="mr-2" />
            </Button>
          </PremiumCard>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pb-8 sm:grid-cols-3 xl:grid-cols-3">
        {[
          {
            label: "التقارير المالية",
            icon: TrendingUp,
            to: "/owner/financial",
          },
          { label: "كشف الرواتب", icon: Wallet, to: "/owner/payroll" },
          { label: "خزينة المحل", icon: Banknote, to: "/owner/cashbox" },
          { label: "المصروفات", icon: Receipt, to: "/expenses" },
          {
            label: "تقارير الموظفين",
            icon: Users,
            to: "/owner/employee-reports",
          },
          {
            label: "الملخص اليومي",
            icon: Activity,
            to: "/owner/daily-summary",
          },
        ].map((item, idx) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.to)}
            className="group flex min-h-[10rem] flex-col items-center justify-center gap-4 rounded-[2rem] border border-border bg-card/40 p-5 text-center transition-all duration-500 hover:border-accent/20 hover:bg-accent/5"
          >
            <div className="rounded-[1.25rem] bg-soft p-4 text-muted transition-all duration-500 group-hover:bg-accent group-hover:text-white">
              <item.icon size={28} strokeWidth={1.8} />
            </div>
            <span className="text-[10px] font-black tracking-widest text-muted transition-colors group-hover:text-accent">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
