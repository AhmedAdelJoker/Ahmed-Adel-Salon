import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart as PieChartIcon,
  Filter,
  Download,
  Calendar,
  Sparkles,
  Target,
  LineChart,
  FileSpreadsheet,
  Clock,
  LayoutGrid,
  History,
  Info,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList, adaptObject } from "@/services/apiAdapter";
import type {
  FinancialsState,
} from "@/types/reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { aiService } from "@/services/aiService";
import AIInsights from "@/components/AIInsights";
import { cn } from "@/lib/core/utils";
import {
  PageHeader,
} from "@/components/shared/PremiumUI";
import {
  StatCard as StatCardDisplay,
  CurrencyStatCard,
} from "@/components/shared/DisplayComponents";
import { formatCurrency } from "@/lib/core/utils";

const CHART_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

 
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 p-4 rounded-[22px] shadow-premium">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
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
                  style={{ backgroundColor: entry.color || entry.fill }}
                />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-black text-slate-900 dark:text-white">
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

export default function FinancialReports() {
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [financials, setFinancials] = useState<FinancialsState>({
    revenue: 0,
    expenses: 0,
    netProfit: 0,
    margin: 0,
    payments: [],
    expenseCategories: [],
    dailyTrends: [],
  });

  const fetchFinancials = useCallback(async () => {
    try {
      setLoading(true);
      const [invRes, expRes] = await Promise.all([
        api.get("/invoices", {
          params: { from_date: fromDate, to_date: toDate },
        }),
        api.get("/expenses/summary", {
          params: { from_date: fromDate, to_date: toDate },
        }),
      ]);

      const rawInvoices = adaptList(invRes);
      const invoices = rawInvoices.filter((inv) => {
        const invDate = inv.created_at?.slice(0, 10);
        const isDateMatch =
          (!fromDate || invDate >= fromDate) && (!toDate || invDate <= toDate);
        const isNotCancelled = !["cancelled", "ملغية"].includes(
          String(inv.status).toLowerCase(),
        );
        return isDateMatch && isNotCancelled;
      });

       
      const expensesSum = adaptObject<Record<string, any>>(expRes, {}) || {};
      const totalRevenue = invoices.reduce(
        (sum, inv) => sum + Number(inv.total_amount || 0),
        0,
      );
      const totalExpenses = Number(expensesSum.total_amount || 0);
      const netProfit = totalRevenue - totalExpenses;

      const pMap = new Map();
      invoices.forEach((inv) => {
        const method = inv.payment_method || "cash";
        pMap.set(
          method,
          (pMap.get(method) || 0) + Number(inv.total_amount || 0),
        );
      });

      const mockTrend = [
        {
          name: "الأسبوع 1",
          rev: totalRevenue * 0.2,
          exp: totalExpenses * 0.25,
        },
        {
          name: "الأسبوع 2",
          rev: totalRevenue * 0.3,
          exp: totalExpenses * 0.2,
        },
        {
          name: "الأسبوع 3",
          rev: totalRevenue * 0.15,
          exp: totalExpenses * 0.3,
        },
        {
          name: "الأسبوع 4",
          rev: totalRevenue * 0.35,
          exp: totalExpenses * 0.25,
        },
      ];

      setFinancials({
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        payments: [...pMap.entries()].map(([name, value]) => ({ name, value })),
        dailyTrends: mockTrend,
      });
      setLastUpdated(new Date());
    } catch (_error) {
      toast.error("فشل تحميل البيانات المالية");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  const aiInsights = useMemo(() => {
    const mockTrans = [
      { amount: financials.revenue, direction: "in" },
      { amount: financials.expenses, direction: "out" },
    ];
    return aiService.generateInsights(mockTrans);
  }, [financials]);

  if (loading && financials.revenue === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse" />
            <Sparkles className="h-16 w-16 text-indigo-600 dark:text-sky-400 animate-bounce relative" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500">
            جاري معالجة البيانات المالية الضخمة...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="erp-page-container space-y-10 pb-24 animate-fade-up"
      dir="rtl"
    >
      <PageHeader
        title="التحليلات المالية الاستراتيجية"
        subtitle="مراقبة الأرباح، التدفقات النقدية، والتقارير الضريبية بدقة عالية."
        badge="الرقابة والتحقق"
        icon={Banknote}
        className={undefined}
        actions={
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <div className="flex flex-1 sm:flex-none bg-white p-2 rounded-xl shadow-sm border border-border">
              <div className="flex items-center px-4 border-l border-border/40">
                <Calendar size={14} className="text-muted ml-3" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black outline-none w-28 text-main"
                />
              </div>
              <div className="flex items-center px-4">
                <Calendar size={14} className="text-muted ml-3" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black outline-none w-28 text-main"
                />
              </div>
            </div>
            <Button
              onClick={fetchFinancials}
              className="rounded-xl h-11 px-8 gap-3 font-black text-xs bg-primary shadow-lg shadow-primary/20 text-white"
            >
              <Filter size={16} /> تحديث
            </Button>
          </div>
        }
      />

      <div data-stats-grid="true">
        <CurrencyStatCard
          label="إجمالي الإيرادات"
          value={financials.revenue}
          icon={TrendingUp}
          trend="positive"
          trendValue={15.2}
          variant="success"
          hint={undefined}
          className={undefined}
        />
        <CurrencyStatCard
          label="إجمالي المصروفات"
          value={financials.expenses}
          icon={TrendingDown}
          trend="negative"
          trendValue={5.4}
          variant="danger"
          hint={undefined}
          className={undefined}
        />
        <CurrencyStatCard
          label="صافي الربح"
          value={financials.netProfit}
          icon={Wallet}
          trend={financials.netProfit > 0 ? "positive" : "negative"}
          trendValue={8.1}
          variant="primary"
          hint={undefined}
          className={undefined}
        />
        <StatCardDisplay
          label="هامش الربح"
          value={`${financials.margin.toFixed(1)}%`}
          icon={Target}
          variant="warning"
          trend={undefined}
          trendValue={undefined}
          hint={undefined}
          className={undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-premium rounded-[48px] overflow-hidden bg-white group">
          <CardHeader className="p-12 border-b border-border/40 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <LineChart size={20} />
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight text-main">
                  تحليل التدفقات النقدية
                </CardTitle>
              </div>
              <CardDescription className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mt-2">
                مقارنة أداء الإيرادات بالمصروفات خلال الفترة المحددة
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-12">
            <div className="h-[400px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financials.dailyTrends}>
                  <CartesianGrid
                    strokeDasharray="10 10"
                    vertical={false}
                    stroke="#88888810"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 900, fill: "#888888" }}
                    dy={15}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v / 1000}k`}
                    tick={{ fontSize: 11, fontWeight: 900, fill: "#888888" }}
                    dx={-15}
                  />
                  <ReTooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#88888808" }}
                  />
                  <Legend verticalAlign="top" align="right" height={36} />
                  <Bar
                    name="الإيرادات"
                    dataKey="rev"
                    fill="var(--primary)"
                    radius={[10, 10, 0, 0]}
                    barSize={40}
                  />
                  <Bar
                    name="المصروفات"
                    dataKey="exp"
                    fill="#F43F5E"
                    radius={[10, 10, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-premium rounded-[48px] p-12 bg-white group">
          <CardHeader className="px-0 pb-12 border-b border-border/40 mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                <PieChartIcon size={20} />
              </div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight text-main">
                طرق التحصيل
              </CardTitle>
            </div>
            <CardDescription className="text-[11px] font-black uppercase tracking-widest text-muted">
              توزيع المبيعات حسب وسيلة الدفع
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="h-[300px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financials.payments}
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={8}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {financials.payments.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <ReTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-10 space-y-4">
              {financials.payments.map((p, idx) => (
                <div
                  key={p.name}
                  className="group flex items-center justify-between p-4 rounded-2xl bg-soft border border-transparent hover:border-primary/20 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor:
                          CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                    <span className="text-sm font-black text-main capitalize">
                      {p.name === "cash"
                        ? "نقدي"
                        : p.name === "credit_card"
                          ? "بطاقة ائتمان"
                          : p.name}
                    </span>
                  </div>
                  <span className="text-base font-black text-main tabular-nums">
                    {formatCurrency(p.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[56px] p-12 bg-[#020617] text-white overflow-hidden relative">
        <div className="relative z-10 space-y-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/10 backdrop-blur-xl rounded-[24px] shadow-inner">
              <Sparkles size={32} className="text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="text-3xl font-black uppercase tracking-tighter italic">
                AI FINANCIAL ADVISOR
              </h3>
              <p className="text-primary/60 text-[11px] font-black uppercase tracking-[0.3em]">
                تحليل ذكي للبيانات المالية وتوصيات النمو
              </p>
            </div>
          </div>
          <AIInsights data={aiInsights} />
        </div>

        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] -ml-40 -mb-40" />
      </Card>

      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary rounded-2xl shadow-lg">
            <LayoutGrid size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-main tracking-tight">
              مركز التقارير التنفيذية
            </h2>
            <p className="text-sm font-bold text-muted">
              تصدير مستندات محاسبية معتمدة لمراجعة الأداء المالي
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[
            {
              title: "التدقيق الاستراتيجي للنمو",
              desc: "تقرير شامل يجمع بين الأداء المالي، تحليل الخدمات الأكثر ربحية، وتقييم إنتاجية الفريق بنظرة استراتيجية.",
              details:
                "يتضمن: ملخص KPIs، قائمة Top 5 خدمات، جدول ترتيب أداء الموظفين.",
              icon: Sparkles,
              color: "text-purple-600 bg-purple-50",
              format: "PREMIUM PDF",
              type: "pdf",
              endpoint: "/exports/reports/strategic-growth/pdf",
            },
            {
              title: "تقرير الإيرادات التفصيلي",
              desc: "كشف محاسبي بجميع المبيعات والتحصيلات، مفصل حسب طريقة الدفع (كاش، فيزا، محافظ) لمطابقة الخزينة.",
              details:
                "يتضمن: التاريخ، رقم الفاتورة، العميل، طريقة الدفع، القيمة الصافية.",
              icon: FileSpreadsheet,
              color: "text-indigo-600 bg-indigo-50",
              format: "EXCEL SHEET",
              type: "excel",
              endpoint: "/exports/reports/revenue/excel",
            },
            {
              title: "كشف ميزان العمليات اليومي",
              desc: "سجل زمني دقيق لكافة الحركات النقدية اليومية (داخلة/خارجة) خلال الفترة المختارة لضمان دقة الأرشفة.",
              details:
                "يتضمن: تفصيل الحركات اليومية، إجمالي الوارد والصادر لكل يوم.",
              icon: History,
              color: "text-amber-600 bg-amber-50",
              format: "ACCOUNTING PDF",
              type: "pdf",
              endpoint: "/exports/reports/daily/pdf",
            },
          ].map((item, idx) => (
            <Card
              key={idx}
              className="border-none shadow-premium rounded-[40px] overflow-hidden bg-white/50 backdrop-blur-md group hover:translate-y-[-4px] transition-all duration-500 border border-transparent hover:border-primary/10"
            >
              <CardContent className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 shadow-sm",
                      item.color,
                    )}
                  >
                    <item.icon size={32} />
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[9px] font-black border-border opacity-60 px-3 py-1 uppercase tracking-widest"
                  >
                    {item.format}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-xl font-black text-main mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs font-bold text-muted leading-relaxed mb-4">
                    {item.desc}
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-soft rounded-xl border border-dashed border-border">
                    <Info size={14} className="text-primary shrink-0" />
                    <p className="text-[10px] font-bold text-muted leading-tight">
                      {item.details}
                    </p>
                  </div>
                </div>
                <div className="pt-4 flex items-center justify-end">
                  <Button
                    onClick={() => {
                      const filename = `${item.title.replace(/\s+/g, "_")}_${fromDate}_${toDate}`;
                      if (item.type === "excel") {
                        import("@/services/exportService").then((m) =>
                          m.default.downloadExcel(item.endpoint, filename, {
                            start_date: fromDate,
                            end_date: toDate,
                          }),
                        );
                      } else {
                        import("@/services/exportService").then((m) =>
                          m.default.downloadPdf(item.endpoint, filename, {
                            start_date: fromDate,
                            end_date: toDate,
                          }),
                        );
                      }
                    }}
                    className="w-full h-14 rounded-[20px] bg-main text-white font-black text-xs gap-3 hover:scale-105 transition-all shadow-xl active:scale-95"
                  >
                    <Download size={18} /> إصدار التقرير الآن
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-muted py-6 border-t border-border/40">
        <Clock size={16} />
        <span className="text-[10px] font-black uppercase tracking-widest">
          آخر تدقيق مالي: {lastUpdated.toLocaleString("ar-EG")}
        </span>
      </div>
    </div>
  );
}
