import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";

import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Filter,
  Download,
  Receipt,
  CreditCard,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { adaptList, adaptObject } from "../../services/apiAdapter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";

const CHART_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

function formatCurrency(value) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function FinancialReports() {
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [financials, setFinancials] = useState({
    revenue: 0,
    expenses: 0,
    netProfit: 0,
    margin: 0,
    payments: [],
    expenseCategories: [],
    dailyTrends: [],
  });

  const fetchFinancials = async () => {
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

      const invoices = adaptList(invRes).filter(
        (inv) => inv.status !== "cancelled",
      );
      const expensesSum = adaptObject(expRes, {});

      const totalRevenue = invoices.reduce(
        (sum, inv) => sum + Number(inv.total_amount || 0),
        0,
      );
      const totalExpenses = Number(expensesSum.total_amount || 0);
      const netProfit = totalRevenue - totalExpenses;

      // تحليل طرق الدفع
      const pMap = new Map();
      invoices.forEach((inv) => {
        const method = inv.payment_method || "cash";
        pMap.set(
          method,
          (pMap.get(method) || 0) + Number(inv.total_amount || 0),
        );
      });

      setFinancials({
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        payments: [...pMap.entries()].map(([name, value]) => ({ name, value })),
        dailyTrends: [], // يمكن ملؤه ببيانات حقيقية من السيرفر
      });
    } catch (error) {
      toast.error("فشل تحميل البيانات المالية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  return (
    <div className="erp-page-container space-y-8 pb-24" dir="rtl">
      {/* Header */}
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-4xl font-black text-gray-950 dark:text-gray-50">
            التقارير والتحليلات المالية
          </h1>
          <p className="mt-2 text-gray-500 font-bold text-lg text-blue-600">
            كشف الأرباح والخسائر، التدفقات النقدية، والهوامش الربحية
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm ring-1 ring-black/5 dark:bg-white/5">
          <Input
            type="date"
            value={fromDate || ""}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-10 border-none font-bold"
          />
          <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
          <Input
            type="date"
            value={toDate || ""}
            onChange={(e) => setToDate(e.target.value)}
            className="h-10 border-none font-bold"
          />
          <Button
            disabled={loading}
            onClick={fetchFinancials}
            className="rounded-xl"
          >
            <Filter size={16} />
          </Button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-lg ring-1 ring-black/5 dark:bg-white/5 overflow-hidden">
          <div className="h-1.5 bg-blue-600" />
          <CardContent className="p-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              إجمالي الإيرادات
            </p>
            <div className="flex items-end justify-between mt-3">
              <p className="text-3xl font-black text-gray-950 dark:text-gray-50">
                {formatCurrency(financials.revenue)}
              </p>
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                <TrendingUp size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg ring-1 ring-black/5 dark:bg-white/5 overflow-hidden">
          <div className="h-1.5 bg-red-500" />
          <CardContent className="p-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              إجمالي المصروفات
            </p>
            <div className="flex items-end justify-between mt-3">
              <p className="text-3xl font-black text-gray-950 dark:text-gray-50">
                {formatCurrency(financials.expenses)}
              </p>
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10">
                <TrendingDown size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg ring-1 ring-black/5 dark:bg-white/5 overflow-hidden">
          <div className="h-1.5 bg-emerald-500" />
          <CardContent className="p-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              صافي الربح
            </p>
            <div className="flex items-end justify-between mt-3">
              <p className="text-3xl font-black text-emerald-600">
                {formatCurrency(financials.netProfit)}
              </p>
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                <Banknote size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg ring-1 ring-black/5 dark:bg-white/5 overflow-hidden">
          <div className="h-1.5 bg-amber-500" />
          <CardContent className="p-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              هامش الربح
            </p>
            <div className="flex items-end justify-between mt-3">
              <p className="text-3xl font-black text-gray-950 dark:text-gray-50">
                {financials.margin.toFixed(1)}%
              </p>
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10">
                <ArrowUpRight size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Revenue Breakdown */}
        <Card className="lg:col-span-2 border-none shadow-sm ring-1 ring-black/5 dark:bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black">
                مقارنة الإيرادات بالمصروفات
              </CardTitle>
              <CardDescription>تحليل التدفق المالي الشهري</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 rounded-lg border"
            >
              شهرياً
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "الأسبوع 1", rev: 12000, exp: 4000 },
                    { name: "الأسبوع 2", rev: 15000, exp: 5000 },
                    { name: "الأسبوع 3", rev: 11000, exp: 4500 },
                    { name: "الأسبوع 4", rev: 18000, exp: 6000 },
                  ]}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontBlack: 700 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v / 1000}k`}
                  />
                  <Tooltip cursor={{ fill: "#f9fafb" }} />
                  <Legend verticalAlign="top" align="right" height={36} />
                  <Bar
                    name="الإيرادات"
                    dataKey="rev"
                    fill="#6366F1"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                  <Bar
                    name="المصروفات"
                    dataKey="exp"
                    fill="#EF4444"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="border-none shadow-sm ring-1 ring-black/5 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="text-xl font-black">طرق التحصيل</CardTitle>
            <CardDescription>توزيع السيولة حسب وسيلة الدفع</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financials.payments}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={10}
                    dataKey="value"
                  >
                    {financials.payments.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 space-y-3">
              {financials.payments.map((p, idx) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between text-sm font-bold"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                    <span className="capitalize">
                      {p.name === "cash" ? "نقدي" : p.name}
                    </span>
                  </div>
                  <span>{formatCurrency(p.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Quick Actions */}
      <Card className="border-none bg-linear-to-r from-blue-600 to-indigo-700 text-white shadow-2xl">
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
              <Receipt size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black">
                هل أنت مستعد لتقفيل الميزانية؟
              </h3>
              <p className="text-blue-100 font-bold mt-1">
                يمكنك الآن تصدير كشف حساب تفصيلي بصيغة Excel لتقديمه للمحاسب.
              </p>
            </div>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button className="bg-white text-blue-600 hover:bg-blue-50 font-black h-12 px-8 rounded-xl shadow-lg">
              تصدير EXCEL
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 font-black h-12 px-8 rounded-xl"
            >
              تحميل PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
