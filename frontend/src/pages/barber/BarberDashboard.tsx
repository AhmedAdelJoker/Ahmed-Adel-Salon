import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect, useCallback } from "react";
import { barberService } from "@/services/barberService";
import payrollService from "@/services/payrollService";
import { adaptObject } from "@/services/apiAdapter";


import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Zap,
  ShieldCheck,
  Users,
  Wallet,
  Clock,
  CheckCircle,
  Play,
  TrendingUp,
  Activity,
  RefreshCw,
  CalendarDays,
  UserCheck,
  Scissors,
  BarChart3,
  Calendar,
  Clock3,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/core/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence } from "framer-motion";

const BarberDashboard = () => {
  const { user } = useAuth();
   
  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayCommission: 0,
    weeklyTotal: 0,
    customersCount: 0,
    servicesToday: 0,
  });
   
  const [projectedSalary, setProjectedSalary] = useState<any>(null);
   
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("queue");

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, queueRes, projectedRes, performanceRes] =
        await Promise.all([
          barberService.getStats(),
          barberService.getQueue(),
          payrollService.expectedNet(undefined).catch(() => null),
          barberService.getPerformance().catch(() => ({ data: [] })),
        ]);

       
      const statsData: any = adaptObject(statsRes, {});
      setStats({
        todayCommission:
          statsData.earned_commission || statsData.todayCommission || 0,
        weeklyTotal:
          statsData.weekly_total ||
          statsData.weeklyTotal ||
          statsData.earned_commission ||
          0,
        customersCount:
          statsData.total_customers || statsData.customersCount || 0,
        servicesToday: statsData.services_today || 0,
      });

      const queueData: any = adaptObject(queueRes, {});
      const waitingQueue = Array.isArray(queueData?.waiting)
        ? queueData.waiting
        : [];
      const completedQueue = Array.isArray(queueData?.completed)
        ? queueData.completed
        : [];
      setQueue([
         
        ...waitingQueue.map((item: any) => ({ ...item, isWaiting: true })),
         
        ...completedQueue.map((item: any) => ({ ...item, isWaiting: false })),
      ]);

      setProjectedSalary(adaptObject(projectedRes, {}));
      setPerformanceData(performanceRes?.data || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleStatusChange = async (id: string | number, newStatus: string) => {
    try {
      await barberService.updateStatus(id, newStatus);
      fetchDashboardData();
    } catch (error) {
      console.error("Status update error:", error);
    }
  };

  const queueRows = Array.isArray(queue) ? queue : [];
   
  const waitingCount = queueRows.filter((q: any) => q.isWaiting).length;
   
  const completedCount = queueRows.filter((q: any) => !q.isWaiting).length;

  // Calculate totals
  const totalRevenue = performanceData.reduce(
     
    (s: number, d: any) => s + (d.revenue || 0),
    0,
  );
  const totalServices = performanceData.reduce(
     
    (s: number, d: any) => s + (d.services || 0),
    0,
  );

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center shadow-lg">
              <Scissors className="text-inverse w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-main tracking-tight">
                مرحباً، {user?.full_name || "حلاق"} 👋
              </h1>
              <p className="text-sm text-muted font-bold">
                لوحة التحكم الخاصة بك - تابع أداءك وإدارة عملك
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="h-10 px-4 rounded-xl bg-success-soft text-success border-none font-black text-[10px] uppercase tracking-widest gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              الوردية نشطة
            </Badge>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl"
              onClick={fetchDashboardData}
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        {/* Projected Salary Highlight */}
        {projectedSalary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <PremiumCard className="p-6 bg-gradient-to-l from-slate-900 to-slate-800 border-none overflow-hidden relative">
              <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -ml-32 -mt-32" />
              <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                    <ShieldCheck size={28} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      الراتب المتوقع هذا الشهر
                    </h3>
                    <p className="text-xs font-bold text-slate-400">
                      بناءً على انضباطك وعمولاتك
                    </p>
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-4xl font-black text-white tabular-nums">
                    {Number(projectedSalary.net_salary || 0).toLocaleString(
                      "ar-EG",
                    )}
                    <span className="text-sm text-slate-400 mr-2">ج.م</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[9px] font-black text-emerald-400 border-emerald-500/30"
                    >
                      نسبة الحضور:{" "}
                      {projectedSalary.metrics?.attendance_percent || 0}%
                    </Badge>
                  </div>
                </div>
              </div>
            </PremiumCard>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PremiumCard className="p-4 group" delay={0}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-success-soft text-success flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wallet size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                  عمولة اليوم
                </p>
                <p className="text-lg font-black text-main tabular-nums">
                  {formatCurrency(stats.todayCommission)}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-4 group" delay={0.1}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                <TrendingUp size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                  إنتاجية الأسبوع
                </p>
                <p className="text-lg font-black text-main tabular-nums">
                  {formatCurrency(stats.weeklyTotal)}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-4 group" delay={0.2}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-info-soft text-info flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                  عملاء اليوم
                </p>
                <p className="text-lg font-black text-main tabular-nums">
                  {stats.customersCount}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-4 group" delay={0.3}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-warning-soft text-warning flex items-center justify-center group-hover:scale-105 transition-transform">
                <Scissors size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                  خدمات اليوم
                </p>
                <p className="text-lg font-black text-main tabular-nums">
                  {stats.servicesToday}
                </p>
              </div>
            </div>
          </PremiumCard>
        </div>

        {/* Main Content Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-card border border-border p-1">
            <TabsTrigger
              value="queue"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Zap size={14} className="ml-1.5" /> قائمة الانتظار
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <BarChart3 size={14} className="ml-1.5" /> الأداء
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <CalendarDays size={14} className="ml-1.5" /> الجدول
            </TabsTrigger>
          </TabsList>

          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-3">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-warning" />
                  <span className="text-[10px] font-bold text-muted">
                    في الانتظار
                  </span>
                </div>
                <p className="text-2xl font-black text-warning mt-1">
                  {waitingCount}
                </p>
              </div>
              <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-success" />
                  <span className="text-[10px] font-bold text-muted">
                    مكتمل
                  </span>
                </div>
                <p className="text-2xl font-black text-success mt-1">
                  {completedCount}
                </p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 col-span-2 md:col-span-1">
                <div className="flex items-center gap-2">
                  <UserCheck size={14} className="text-primary" />
                  <span className="text-[10px] font-bold text-muted">
                    الإجمالي
                  </span>
                </div>
                <p className="text-2xl font-black text-primary mt-1">
                  {queueRows.length}
                </p>
              </div>
            </div>

            {/* Queue Table */}
            <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-black text-main flex items-center gap-2">
                  <Zap size={16} className="text-primary animate-pulse" /> قائمة
                  العمليات المباشرة
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={fetchDashboardData}
                >
                  <RefreshCw size={14} />
                </Button>
              </div>
              <div className="divide-y divide-border">
                {queueRows.length > 0 ? (
                  <AnimatePresence>
                    {queueRows.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-4 hover:bg-soft/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center",
                                item.status === "waiting"
                                  ? "bg-warning/10 text-warning"
                                  : item.status === "in-service"
                                    ? "bg-info/10 text-info"
                                    : "bg-success/10 text-success",
                              )}
                            >
                              {item.status === "waiting" ? (
                                <Clock size={18} />
                              ) : item.status === "in-service" ? (
                                <Scissors size={18} />
                              ) : (
                                <CheckCircle size={18} />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-black text-main">
                                {item.customer_name || "عميل نقدي"}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className="h-5 px-2 text-[8px] font-black"
                                >
                                  {item.service_name || "خدمة صالون"}
                                </Badge>
                                <span className="text-[10px] font-bold text-muted">
                                  {item.start_time
                                    ? new Date(
                                        item.start_time,
                                      ).toLocaleTimeString("ar-EG", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "--:--"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.status === "waiting" ? (
                              <Button
                                size="sm"
                                className="h-9 rounded-xl px-4 text-[10px] font-black"
                                onClick={() =>
                                  handleStatusChange(item.id, "in-service")
                                }
                              >
                                <Play size={12} className="ml-1" /> بدء
                              </Button>
                            ) : item.status === "in-service" ? (
                              <Button
                                size="sm"
                                variant="success"
                                className="h-9 rounded-xl px-4 text-[10px] font-black"
                                onClick={() =>
                                  handleStatusChange(item.id, "completed")
                                }
                              >
                                <CheckCircle size={12} className="ml-1" /> إنهاء
                              </Button>
                            ) : (
                              <Badge
                                variant="success"
                                className="h-7 px-3 text-[10px] font-black"
                              >
                                <CheckCircle size={10} className="ml-1" /> مكتمل
                              </Badge>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="p-8 text-center">
                    <Activity size={40} className="mx-auto mb-3 text-muted" />
                    <p className="text-sm font-black text-main">
                      لا توجد حجوزات
                    </p>
                    <p className="text-xs font-bold text-muted">
                      لم يتم إسناد أي عملاء لقائمتك حالياً
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            {/* Performance Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-[9px] font-bold uppercase text-muted">
                  إيرادات الأسبوع
                </p>
                <p className="text-xl font-black text-primary mt-1">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                <p className="text-[9px] font-bold uppercase text-muted">
                  خدمات الأسبوع
                </p>
                <p className="text-xl font-black text-success mt-1">
                  {totalServices}
                </p>
              </div>
              <div className="rounded-xl border border-info/20 bg-info/5 p-3 col-span-2 md:col-span-1">
                <p className="text-[9px] font-bold uppercase text-muted">
                  متوسط الخدمة
                </p>
                <p className="text-xl font-black text-info mt-1">
                  {totalServices > 0
                    ? formatCurrency(totalRevenue / totalServices)
                    : formatCurrency(0)}
                </p>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" /> أداء الأسبوع
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      className="opacity-10"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) =>
                        new Date(v).toLocaleDateString("ar-EG", {
                          weekday: "short",
                        })
                      }
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "revenue"
                          ? [formatCurrency(value), "الإيرادات"]
                          : [value, "الخدمات"]
                      }
                      labelFormatter={(v) =>
                        new Date(v).toLocaleDateString("ar-EG")
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="services"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Services Bar Chart */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-success" /> الخدمات اليومية
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      className="opacity-10"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) =>
                        new Date(v).toLocaleDateString("ar-EG", {
                          weekday: "short",
                        })
                      }
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => [value, "خدمة"]} />
                    <Bar
                      dataKey="services"
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <BarberSchedule />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Barber Schedule Component
const BarberSchedule = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
   
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
       
      const dateParam: any = selectedDate;
      const res = await barberService.getSchedule(dateParam);
      setSchedule(res);
    } catch (err) {
      console.error("Schedule fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    waiting: "في الانتظار",
    "in-service": "قيد الخدمة",
    completed: "مكتمل",
    ready_for_payment: "جاهز للدفع",
    cancelled: "ملغي",
  };

  const statusColors: Record<string, "warning" | "info" | "success" | "danger" | "secondary"> = {
    pending: "warning",
    waiting: "warning",
    "in-service": "info",
    completed: "success",
    ready_for_payment: "success",
    cancelled: "danger",
  };

  return (
    <div className="space-y-4">
      {/* Date Selector */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <CalendarDays size={18} className="text-primary" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 rounded-xl border border-border bg-soft px-3 text-sm font-bold"
          />
          <Button
            variant="outline"
            className="h-10 rounded-xl text-xs"
            onClick={() =>
              setSelectedDate(new Date().toISOString().split("T")[0])
            }
          >
            اليوم
          </Button>
        </div>
      </div>

      {/* Working Hours */}
      {schedule?.working_hours && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
          <Clock3 size={16} className="text-primary" />
          <span className="text-xs font-bold text-main">
            ساعات العمل: {schedule.working_hours.open_time || "--:--"} -{" "}
            {schedule.working_hours.close_time || "--:--"}
          </span>
          {schedule.working_hours.is_open === false && (
            <Badge variant="danger" className="h-5 text-[8px] font-black">
              عطلة
            </Badge>
          )}
        </div>
      )}

      {/* Appointments */}
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-black text-main flex items-center gap-2">
            <Calendar size={16} className="text-primary" /> مواعيد يوم{" "}
            {new Date(selectedDate).toLocaleDateString("ar-EG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw
                size={24}
                className="mx-auto mb-3 text-muted animate-spin"
              />
              <p className="text-xs font-bold text-muted">جاري التحميل...</p>
            </div>
          ) : schedule?.appointments?.length > 0 ? (
            schedule.appointments.map((apt, i) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 hover:bg-soft/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-soft flex items-center justify-center">
                      <Clock size={16} className="text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-main">
                        {apt.customer_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-muted">
                          {apt.start_time}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-5 px-2 text-[8px] font-black"
                        >
                          {apt.service_name}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={statusColors[apt.status] || "secondary"}
                    className="h-6 px-3 text-[9px] font-black"
                  >
                    {statusLabels[apt.status] || apt.status}
                  </Badge>
                </div>
                {apt.notes && (
                  <p className="mt-2 text-[10px] font-bold text-muted mr-13">
                    {apt.notes}
                  </p>
                )}
              </motion.div>
            ))
          ) : (
            <div className="p-8 text-center">
              <Calendar size={40} className="mx-auto mb-3 text-muted" />
              <p className="text-sm font-black text-main">لا توجد مواعيد</p>
              <p className="text-xs font-bold text-muted">
                لا توجد مواعيد في هذا اليوم
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarberDashboard;
