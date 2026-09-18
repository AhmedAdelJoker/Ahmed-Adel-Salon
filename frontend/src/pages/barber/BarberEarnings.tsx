import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Wallet,
  CreditCard,
  FileText,
  Download,
  RefreshCw,
  PieChart as PieIcon,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import {
  PageHeader,
  PremiumCard,
} from "@/components/shared/PremiumUI";
import { cn, formatCurrency } from "@/lib/core/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BarberEarnings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [earnings, setEarnings] = useState({
    today: 0,
    week: 0,
    month: 0,
    year: 0,
    pending: 0,
    cash: 0,
    card: 0,
    transfer: 0,
    total_sales: 0,
  });
   
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
   
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true);
      const [earningsRes, commissionsRes, chartRes] = await Promise.all([
        api.get("/barber/earnings-summary"),
        api.get("/barber/commissions", { params: { period: selectedPeriod } }),
        api.get("/barber/earnings-chart", {
          params: { period: selectedPeriod },
        }),
      ]);
      setEarnings(earningsRes.data || {});
      setCommissions(commissionsRes.data || []);
      setChartData(chartRes.data || []);
    } catch (err) {
      console.error("Earnings fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <PageHeader
          title="الأرباح والعمولات"
          subtitle="متابعة تفصيلية لدخلك وعمولاتك"
          badge="المالية"
          icon={Wallet}
          className={undefined}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl px-3"
                onClick={fetchEarnings}
              >
                <RefreshCw size={14} className="ml-1.5" />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
              <Button variant="outline" className="h-10 rounded-xl px-3">
                <Download size={14} className="ml-1.5" />
                <span className="hidden sm:inline">تصدير</span>
              </Button>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PremiumCard className="p-3 group" delay={0}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-success/10 text-success flex items-center justify-center group-hover:scale-105 transition-transform">
                <DollarSign size={14} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase text-muted">
                  اليوم
                </p>
                <p className="text-lg font-black text-main">
                  {formatCurrency(earnings.today)}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-3 group" delay={0.1}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                <Calendar size={14} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase text-muted">
                  الأسبوع
                </p>
                <p className="text-lg font-black text-main">
                  {formatCurrency(earnings.week)}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-3 group" delay={0.2}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-info/10 text-info flex items-center justify-center group-hover:scale-105 transition-transform">
                <CalendarDays size={14} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase text-muted">
                  الشهر
                </p>
                <p className="text-lg font-black text-main">
                  {formatCurrency(earnings.month)}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-3 group" delay={0.3}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center group-hover:scale-105 transition-transform">
                <Clock size={14} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase text-muted">
                  مستحق (معلق)
                </p>
                <p className="text-lg font-black text-warning">
                  {formatCurrency(earnings.pending)}
                </p>
              </div>
            </div>
          </PremiumCard>
        </div>

        {/* Period Selector */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted">الفترة:</span>
            <div className="flex items-center gap-2">
              {["today", "week", "month", "year"].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-black transition-all",
                    selectedPeriod === p
                      ? "bg-primary text-white"
                      : "bg-soft text-muted hover:bg-card",
                  )}
                >
                  {p === "today" && "اليوم"}
                  {p === "week" && "الأسبوع"}
                  {p === "month" && "الشهر"}
                  {p === "year" && "السنة"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-card border border-border p-1 max-w-md">
            <TabsTrigger
              value="overview"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <TrendingUp size={14} className="ml-1.5" /> نظرة عامة
            </TabsTrigger>
            <TabsTrigger
              value="commissions"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Wallet size={14} className="ml-1.5" /> العمولات
            </TabsTrigger>
            <TabsTrigger
              value="chart"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <PieIcon size={14} className="ml-1.5" /> الرسوم البيانية
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Earnings Trend Chart */}
              <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" /> اتجاه
                  الإيرادات
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="opacity-10"
                      />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v) => [formatCurrency(v), "إيرادات"]}
                        labelFormatter={(v) =>
                          new Date(v).toLocaleDateString("ar-EG")
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Methods Pie */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                  <CreditCard size={16} className="text-info" /> طرق الدفع
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "نقدي",
                            value: earnings.cash || 0,
                            color: "#10b981",
                          },
                          {
                            name: "بطاقة",
                            value: earnings.card || 0,
                            color: "#3b82f6",
                          },
                          {
                            name: "تحويل",
                            value: earnings.transfer || 0,
                            color: "#8b5cf6",
                          },
                        ].filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {[
                          { color: "#10b981" },
                          { color: "#3b82f6" },
                          { color: "#8b5cf6" },
                        ].map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Commission Rate Info */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" /> معدل
                  العمولة
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-soft">
                    <span className="text-xs font-bold text-muted">
                      معدل العمولة
                    </span>
                    <span className="text-lg font-black text-primary">15%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-soft">
                    <span className="text-xs font-bold text-muted">
                      إجمالي المبيعات
                    </span>
                    <span className="text-lg font-black text-main">
                      {formatCurrency(earnings.total_sales || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-success/10">
                    <span className="text-xs font-bold text-muted">
                      صافي العمولة
                    </span>
                    <span className="text-lg font-black text-success">
                      {formatCurrency(earnings.month)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="space-y-4">
            <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-black text-main">
                  تفاصيل العمولات
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold text-muted">
                        التاريخ
                      </TableHead>
                      <TableHead className="text-[10px] font-bold text-muted">
                        العميل
                      </TableHead>
                      <TableHead className="text-[10px] font-bold text-muted">
                        الخدمة
                      </TableHead>
                      <TableHead className="text-[10px] font-bold text-muted">
                        المبلغ
                      </TableHead>
                      <TableHead className="text-[10px] font-bold text-muted">
                        العمولة
                      </TableHead>
                      <TableHead className="text-[10px] font-bold text-muted">
                        الحالة
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell
                            colSpan={6}
                            className="h-12 animate-pulse"
                          />
                        </TableRow>
                      ))
                    ) : commissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center">
                          <FileText
                            size={32}
                            className="mx-auto mb-2 text-muted"
                          />
                          <p className="text-xs font-bold text-muted">
                            لا توجد عمولات
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      commissions.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[10px] font-bold text-muted">
                            {new Date(c.date).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell className="font-black text-main">
                            {c.customer_name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="h-5 text-[8px] font-black"
                            >
                              {c.service_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-primary font-black">
                            {formatCurrency(c.amount)}
                          </TableCell>
                          <TableCell className="text-success font-black">
                            {formatCurrency(c.commission)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={c.paid ? "success" : "warning"}
                              className="h-5 text-[9px] font-black"
                            >
                              {c.paid ? "مدفوع" : "معلق"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Chart Tab */}
          <TabsContent value="chart" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4">
                  إيرادات يومية
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="opacity-10"
                      />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v) => [formatCurrency(v), "إيرادات"]}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#6366f1"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4">
                  مقارنة الفترات
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="opacity-10"
                      />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v) => [formatCurrency(v), "إيرادات"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

import api from "@/services/api";
import { Badge } from "@/components/ui/badge";

export default BarberEarnings;
