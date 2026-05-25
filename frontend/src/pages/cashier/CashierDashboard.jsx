import { useEffect, useState, useMemo } from "react";
import {
  Users,
  CalendarDays,
  Receipt,
  Boxes,
  Bell,
  Zap,
  PlusCircle,
  Clock,
  TrendingUp,
  Wallet,
  ArrowRight,
  Coins,
  UserCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { dashboardService } from "../../services/dashboardService";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency, cn } from "../../lib/utils";
import DashboardPanel from "../../components/common/DashboardPanel";
import DashboardStatCard from "../../components/common/DashboardStatCard";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export default function CashierDashboard() {
  const { currentUser, user: authUser } = useAuth();
  const user = currentUser || authUser;
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryData, invoicesRes] = await Promise.all([
        dashboardService.cashierSummary(),
        api.get("/invoices", { params: { limit: 5 } }),
      ]);
      setSummary(summaryData);
      setRecentInvoices(invoicesRes.data?.items || invoicesRes.data || []);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل بيانات لوحة التحكم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const quickActions = [
    {
      title: "نقطة البيع (POS)",
      desc: "فتح واجهة الكاشير وإصدار الفواتير",
      icon: Zap,
      link: "/pos",
      color: "bg-primary/10 text-primary",
      borderColor: "border-primary/20",
    },
    {
      title: "حجز جديد",
      desc: "تسجيل موعد جديد للعميل",
      icon: PlusCircle,
      link: "/bookings",
      color: "bg-accent/10 text-accent",
      borderColor: "border-accent/20",
    },
    {
      title: "إضافة عميل",
      desc: "تسجيل بيانات عميل جديد في النظام",
      icon: Users,
      link: "/customers",
      color: "bg-emerald-500/10 text-emerald-600",
      borderColor: "border-emerald-500/20",
    },
    {
      title: "إدارة المخزون",
      desc: "متابعة المنتجات والكميات المتاحة",
      icon: Boxes,
      link: "/inventory",
      color: "bg-amber-500/10 text-amber-600",
      borderColor: "border-amber-500/20",
    },
    {
      title: "تسجيل مصروف",
      desc: "إضافة مصروفات الصالون النثرية",
      icon: Coins,
      link: "/expenses",
      color: "bg-rose-500/10 text-rose-600",
      borderColor: "border-rose-500/20",
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Zap className="h-10 w-10 animate-pulse" />
          <p className="text-sm font-bold text-muted">
            جاري تحضير لوحة الكاشير...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="erp-page-container flex flex-col items-center justify-center py-20 text-center"
        dir="rtl"
      >
        <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <Bell size={32} />
        </div>
        <h2 className="text-xl font-black text-main">{error}</h2>
        <Button onClick={loadData} className="mt-4">
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="erp-page relative pb-24 lg:pb-8" dir="rtl">
      {/* Mobile Floating Action Button (FAB) */}
      <div className="fixed bottom-6 left-6 z-50 lg:hidden">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/bookings")}
          className="h-16 w-16 rounded-full bg-indigo-600 text-white shadow-[0_8px_30px_rgb(79,70,229,0.4)] flex items-center justify-center border-4 border-white dark:border-slate-900"
        >
          <PlusCircle size={32} />
        </motion.button>
      </div>

      {/* ── Header/Filters Section ── */}
      <div className="erp-page__filters pt-8 md:pt-12">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <motion.h1
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl md:text-4xl font-black text-main tracking-tight"
            >
              أهلاً بك، {user?.full_name || "زميلنا الكاشير"} 👋
            </motion.h1>
            <p className="text-sm font-bold text-muted flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              {new Date().toLocaleDateString("ar-EG", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Badge
              variant={summary?.has_open_shift ? "success" : "warning"}
              className="h-12 px-6 rounded-2xl font-black text-xs shadow-sm"
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full ml-2 animate-pulse",
                  summary?.has_open_shift ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
              {summary?.has_open_shift ? "الوردية مفتوحة" : "الوردية مغلقة"}
            </Badge>
            {!summary?.has_open_shift && (
              <Button
                onClick={() => navigate("/pos")}
                className="h-12 px-6 rounded-2xl font-black premium-button shadow-lg shadow-primary/20"
              >
                <Zap size={18} className="ml-2" />
                فتح وردية عمل
              </Button>
            )}
          </div>
        </header>
      </div>

      {/* ── Stats Section ── */}
      <div className="erp-page__stats mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <DashboardStatCard
            title="مبيعات اليوم"
            value={formatCurrency(summary?.today_sales || 0)}
            subtitle="صافي تحصيلك الشخصي"
            accent="from-emerald-400 to-teal-500"
            icon={<TrendingUp size={20} />}
          />
          <DashboardStatCard
            title="مصاريف اليوم"
            value={formatCurrency(summary?.today_expenses || 0)}
            subtitle="إجمالي المصروفات المسجلة"
            accent="from-rose-400 to-red-500"
            icon={<Coins size={20} />}
          />
          <DashboardStatCard
            title="الموظفون الحاضرون"
            value={summary?.present_employees_count || "0"}
            subtitle="خبير متاح حالياً بالصالون"
            accent="from-violet-400 to-purple-500"
            icon={<UserCheck size={20} />}
          />
          <DashboardStatCard
            title="عملاء في الانتظار"
            value={summary?.waiting_customers || "0"}
            subtitle="عملاء Walk-in بانتظار الخدمة"
            accent="from-amber-400 to-orange-500"
            icon={<Clock size={20} />}
          />
          <DashboardStatCard
            title="حجوزات اليوم"
            value={summary?.today_appointments || "0"}
            subtitle="إجمالي المواعيد المسجلة"
            accent="from-primary to-blue-600"
            icon={<CalendarDays size={20} />}
          />
          <DashboardStatCard
            title="تنبيهات نشطة"
            value={summary?.active_notifications || "0"}
            subtitle="إشعارات تحتاج مراجعة"
            accent="from-sky-400 to-indigo-600"
            icon={<Bell size={20} />}
          />
        </div>
      </div>

      {/* ── Main Content Section ── */}
      <div className="erp-page__table mt-12">
        <div className="table-wrapper no-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pb-10">
            {/* Quick Actions & Revenue Highlighting */}
            <div className="lg:col-span-2 space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {quickActions.map((action, idx) => {
                  const isBooking = action.title === "حجز جديد";
                  return (
                    <motion.div
                      key={idx}
                      whileHover={{ y: -6, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                    >
                      <Link to={action.link}>
                        <Card
                          className={cn(
                            "p-6 h-full flex flex-col items-center text-center gap-4 transition-all duration-300 border-2 rounded-[2.5rem] relative overflow-hidden group",
                            isBooking
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-xl shadow-indigo-600/20"
                              : "bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 shadow-soft",
                          )}
                        >
                          {isBooking && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                          )}

                          <div
                            className={cn(
                              "h-16 w-16 rounded-[1.75rem] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3 shadow-lg",
                              isBooking
                                ? "bg-white/20 text-white"
                                : action.color,
                            )}
                          >
                            <action.icon size={32} strokeWidth={2.5} />
                          </div>

                          <div className="min-w-0">
                            <h3
                              className={cn(
                                "font-black text-xl tracking-tight",
                                isBooking ? "text-white" : "text-main",
                              )}
                            >
                              {action.title}
                            </h3>
                            <p
                              className={cn(
                                "text-xs font-bold mt-2 leading-relaxed opacity-70",
                                isBooking ? "text-indigo-100" : "text-muted",
                              )}
                            >
                              {action.desc}
                            </p>
                          </div>

                          {/* Action indicator */}
                          <div
                            className={cn(
                              "mt-4 h-10 w-10 rounded-full flex items-center justify-center transition-all",
                              isBooking
                                ? "bg-white/10 text-white"
                                : "bg-slate-50 dark:bg-white/5 text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50",
                            )}
                          >
                            <ArrowRight
                              size={18}
                              className={
                                isBooking ? "rotate-180" : "rotate-180"
                              }
                            />
                          </div>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <DashboardPanel
                title="أحدث الفواتير الصادرة"
                subtitle="مراجعة سريعة لأحدث العمليات المالية"
                className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border-none shadow-soft overflow-hidden"
                action={
                  <Link to="/invoices">
                    <Button
                      variant="ghost"
                      className="text-xs font-black gap-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl px-4"
                    >
                      عرض سجل الفواتير{" "}
                      <ArrowRight size={14} className="rotate-180" />
                    </Button>
                  </Link>
                }
              >
                <div className="space-y-4">
                  {recentInvoices.length > 0 ? (
                    recentInvoices.map((inv, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-5 rounded-[1.75rem] bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-indigo-500/30 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-slate-100 dark:border-white/5 group-hover:scale-110 transition-transform">
                            <Receipt size={22} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-main group-hover:text-indigo-600 transition-colors">
                              #{inv.invoice_no || inv.id}
                            </p>
                            <p className="text-[11px] font-bold text-muted flex items-center gap-1">
                              <UserCheck size={10} />{" "}
                              {inv.customer_name || "عميل مجهول"}
                            </p>
                          </div>
                        </div>
                        <div className="text-left flex flex-col items-end gap-1.5">
                          <p className="text-base font-black text-emerald-600">
                            {formatCurrency(inv.total_amount)}
                          </p>
                          <Badge
                            className={cn(
                              "text-[9px] font-black h-5 px-2 rounded-lg border-none",
                              inv.payment_method === "cash"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700",
                            )}
                          >
                            {inv.payment_method === "cash" ? "نقدي" : "شبكة"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center">
                      <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <Receipt size={40} className="text-muted" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-widest">
                        لا توجد فواتير اليوم
                      </p>
                    </div>
                  )}
                </div>
              </DashboardPanel>
            </div>

            {/* Sidebar Status / Summary */}
            <div className="space-y-8">
              <Card className="p-8 bg-gradient-to-br from-primary to-accent text-white overflow-hidden relative group border-none">
                <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <Wallet size={24} />
                    </div>
                    <Badge
                      variant="outline"
                      className="border-white/30 text-white bg-white/10"
                    >
                      تحصيل الكاشير
                    </Badge>
                  </div>

                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                    إجمالي تحصيلك اليوم
                  </p>
                  <h2 className="text-4xl font-black mt-2 tracking-tight">
                    {formatCurrency(summary?.today_sales || 0)}
                  </h2>

                  <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-[10px] font-black opacity-70">
                        الفواتير
                      </p>
                      <p className="text-lg font-black">
                        {summary?.invoices_count || 0}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                      <p className="text-[10px] font-black opacity-70">
                        العملاء
                      </p>
                      <p className="text-lg font-black">
                        {summary?.customers_count || 0}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                      <p className="text-[10px] font-black opacity-70">
                        الوردية
                      </p>
                      <p className="text-lg font-black">
                        #{summary?.current_shift_id || "---"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-dashed border-2 border-border bg-soft/20 backdrop-blur-xl">
                <h3 className="font-black text-main flex items-center gap-2 mb-4">
                  <Boxes size={18} className="text-amber-500" />
                  تنبيهات المخزون
                </h3>
                {summary?.low_stock_count > 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50">
                    <p className="text-xs font-black leading-relaxed">
                      هناك {summary.low_stock_count} أصناف وصلت للحد الأدنى
                      للمخزون. يرجى مراجعة صفحة المخزون لطلب توريد.
                    </p>
                    <Link to="/inventory">
                      <Button
                        variant="link"
                        className="p-0 h-auto text-amber-700 dark:text-amber-400 text-xs font-black mt-2 underline"
                      >
                        انتقل للمخزون الآن
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-muted text-center py-4">
                    المخزون مستقر ولا يوجد نواقص حالياً
                  </p>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
