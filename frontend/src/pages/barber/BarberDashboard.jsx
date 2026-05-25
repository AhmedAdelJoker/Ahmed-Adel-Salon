import { useAuth } from "../../context/AuthContext";
import React, { useState, useEffect } from "react";



import { barberService } from "../../services/barberService";
import { adaptObject } from "../../services/apiAdapter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import {
  Zap,
  Users,
  Wallet,
  Clock,
  CheckCircle,
  Play,
  Bell,
  CalendarCheck,
  ChevronRight,
  TrendingUp,
  History,
  Activity,
  Scissors,
  RefreshCw,
} from "lucide-react";
import { TableEmptyState } from "../../components/shared/TableEmptyState";

const BarberDashboard = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayCommission: 0,
    weeklyTotal: 0,
    customersCount: 0,
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, queueRes] = await Promise.all([
        barberService.getStats(),
        barberService.getQueue(),
      ]);

      const statsData = adaptObject(statsRes, {});
      const queueData = adaptObject(queueRes, {});

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
      });

      const waitingQueue = Array.isArray(queueData.waiting)
        ? queueData.waiting
        : [];
      const completedQueue = Array.isArray(queueData.completed)
        ? queueData.completed
        : [];
      const combinedQueue = [
        ...waitingQueue.map((item) => ({ ...item, isWaiting: true })),
        ...completedQueue.map((item) => ({ ...item, isWaiting: false })),
      ];
      setQueue(combinedQueue);
    } catch (error) {
      console.error("Barber dashboard sync error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {

    fetchDashboardData();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await barberService.updateStatus(id, newStatus);
      fetchDashboardData();
    } catch (error) {
      console.error("Status update error:", error);
    }
  };

  const queueRows = Array.isArray(queue) ? queue : [];

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Scissors className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">
            جاري تحليل النبض الفني للمقص...
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-8 pb-24" dir="rtl">
      {/* SaaS Executive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-soft">
            <Activity className="text-inverse w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-main tracking-tight uppercase">
              لوحة الحلاق
            </h1>
            <p className="text-sm text-muted">
              متابعة قائمة الانتظار المباشرة وتحليل العمولات اليومية
            </p>
          </div>
        </div>
        <Badge className="h-10 px-5 rounded-xl bg-success-soft text-success border-none font-black text-[10px] uppercase tracking-widest gap-2">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.4)]" />
          النظام متصل: الوردية نشطة
        </Badge>
      </div>

      {/* Professional Stats Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[26px] border border-border bg-card shadow-soft p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-soft/10 rounded-full -mr-16 -mt-16 blur-2xl transition-transform group-hover:scale-110"></div>
          <Wallet className="w-8 h-8 text-accent mb-6" />
          <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
            عمولة اليوم المستحقة
          </div>
          <div className="text-4xl font-black text-main tracking-tighter">
            {stats.todayCommission}{" "}
            <span className="text-xs text-muted uppercase ml-1">ج.م</span>
          </div>
        </Card>

        <Card className="rounded-[26px] border border-border bg-card shadow-soft p-8 relative overflow-hidden group">
          <div className="p-16 w-32 h-32 absolute top-0 right-0 bg-success-soft/5 rounded-full -mr-16 -mt-16 blur-2xl transition-transform group-hover:scale-110"></div>
          <TrendingUp className="w-8 h-8 text-success mb-6" />
          <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
            إجمالي إنتاجية الأسبوع
          </div>
          <div className="text-4xl font-black text-main tracking-tighter">
            {stats.weeklyTotal}{" "}
            <span className="text-xs text-muted uppercase ml-1">ج.م</span>
          </div>
        </Card>

        <Card className="rounded-[26px] border border-border bg-card shadow-soft p-8 relative overflow-hidden group">
          <div className="p-16 w-32 h-32 absolute top-0 right-0 bg-info-soft/5 rounded-full -mr-16 -mt-16 blur-2xl transition-transform group-hover:scale-110"></div>
          <Users className="w-8 h-8 text-info mb-6" />
          <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
            عدد عملاء اليوم
          </div>
          <div className="text-4xl font-black text-main tracking-tighter">
            {stats.customersCount}{" "}
            <span className="text-xs text-muted uppercase ml-1">عضو</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real-time Operations Queue */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[26px] border border-border bg-card shadow-soft overflow-hidden group">
            <CardHeader className="p-8 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-main uppercase flex items-center gap-3">
                  <Zap size={20} className="text-accent animate-pulse" />
                  قائمة العمليات المباشرة
                </CardTitle>
                <CardDescription className="text-xs font-bold text-muted mt-1">
                  إدارة العملاء المسندين إليك حالياً في الصالة
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={loading}
                onClick={fetchDashboardData}
                className="rounded-xl w-10 h-10 text-muted hover:bg-soft transition-all"
                title="تحديث القائمة"
                aria-label="تحديث القائمة"
              >
                <RefreshCw size={18} />
              </Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-soft/50">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-bold text-muted h-14 px-8">
                      التوقيت
                    </TableHead>
                    <TableHead className="font-bold text-muted">
                      العميل
                    </TableHead>
                    <TableHead className="font-bold text-muted">
                      الخدمة المطلوبة
                    </TableHead>
                    <TableHead className="font-bold text-muted text-center">
                      الحالة
                    </TableHead>
                    <TableHead className="font-bold text-muted text-left px-8">
                      إجراء
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueRows.length > 0 ? (
                    queueRows.map((item) => (
                      <TableRow
                        key={item.id}
                        className="group border-border/50"
                      >
                        <TableCell className="px-8 py-5 text-xs font-bold text-muted uppercase">
                          {item.start_time
                            ? new Date(item.start_time).toLocaleTimeString(
                                "ar-EG",
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "---"}
                        </TableCell>
                        <TableCell className="font-bold text-main uppercase tracking-tight text-sm">
                          {item.customer_name || "عميل نقدي"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="px-3 py-1 rounded-lg text-[9px] font-black uppercase border-border bg-soft text-accent"
                          >
                            {item.service_name || "خدمة صالون"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={`rounded-full px-4 font-black text-[9px] border-none ${
                              item.status === "waiting"
                                ? "bg-warning-soft text-warning"
                                : item.status === "in-service"
                                  ? "bg-info-soft text-info"
                                  : "bg-success-soft text-success"
                            }`}
                          >
                            {item.status === "waiting"
                              ? "في الانتظار"
                              : item.status === "in-service"
                                ? "قيد الخدمة"
                                : "مكتمل"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left px-8">
                          {item.status === "waiting" ? (
                            <Button
                              size="sm"
                              variant="accent"
                              className="rounded-xl h-9 px-6 font-black text-[10px] uppercase shadow-soft"
                              onClick={() =>
                                handleStatusChange(item.id, "in-service")
                              }
                            >
                              <Play size={12} className="ml-1.5" /> بدء العمل
                            </Button>
                          ) : item.status === "in-service" ? (
                            <Button
                              size="sm"
                              className="bg-success text-inverse hover:bg-success/90 rounded-xl h-9 px-6 font-black text-[10px] uppercase shadow-soft"
                              onClick={() =>
                                handleStatusChange(item.id, "completed")
                              }
                            >
                              <CheckCircle size={12} className="ml-1.5" /> إنهاء
                            </Button>
                          ) : (
                            <div className="flex items-center justify-end gap-2 text-[10px] font-black text-muted opacity-50 uppercase">
                              <CheckCircle size={14} className="text-success" />{" "}
                              تم الإنجاز
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <TableEmptyState
                          icon={Activity}
                          title="لا توجد حجوزات"
                          description="لم يتم إسناد أي عملاء لقائمتك حالياً."
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Side Performance Panel */}
        <div className="space-y-6">
          <Card className="rounded-[26px] border border-border bg-card shadow-soft overflow-hidden group">
            <CardHeader className="p-8 border-b border-border">
              <CardTitle className="text-lg font-black text-main uppercase flex items-center gap-3">
                <Bell size={18} className="text-accent" /> إشعارات العمليات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="p-5 bg-soft rounded-2xl border border-border group-hover:border-accent/10 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <p className="font-black text-[10px] text-accent uppercase tracking-widest">
                    عميل جديد مسند
                  </p>
                </div>
                <p className="text-xs font-bold text-muted leading-relaxed">
                  تمت إضافة طلب جديد إلى قائمتك بواسطة الكاشير الرئيسي.
                </p>
              </div>
              <div className="p-5 bg-warning-soft/20 rounded-2xl border border-warning/10">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  <p className="font-black text-[10px] text-warning uppercase tracking-widest">
                    تنبيه الكفاءة
                  </p>
                </div>
                <p className="text-xs font-bold text-muted leading-relaxed">
                  لديك ٣ عملاء بانتظار بدء الخدمة، يرجى متابعة الجدول.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border border-border bg-card shadow-soft p-8 group">
            <CardTitle className="text-lg font-black text-main uppercase flex items-center gap-3 mb-8">
              <CalendarCheck size={18} className="text-accent" /> سجل الحضور
              اليومي
            </CardTitle>
            <div className="flex items-center justify-between p-5 bg-soft rounded-2xl border border-border group-hover:border-accent/10 transition-all duration-300">
              <div>
                <div className="text-[9px] font-black text-muted uppercase mb-1">
                  وقت تسجيل الدخول
                </div>
                <div className="text-base font-black text-main">٠٩:١٥ ص</div>
              </div>
              <div className="text-left">
                <div className="text-[9px] font-black text-muted uppercase mb-1 text-left">
                  حالة الانضباط
                </div>
                <Badge className="bg-success-soft text-success border-none font-black px-4 rounded-full">
                  منضبط
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={fetchDashboardData}
              className="w-full mt-6 rounded-xl font-black text-[10px] uppercase tracking-widest h-12 border border-border hover:bg-soft"
              title="تحديث لوحة اليوم"
              aria-label="تحديث لوحة اليوم"
            >
              <RefreshCw size={14} className="ml-2" /> تحديث لوحة اليوم
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BarberDashboard;

