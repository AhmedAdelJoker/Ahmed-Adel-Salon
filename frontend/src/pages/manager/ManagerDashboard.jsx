import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useState } from "react";



import {
  Users,
  Clock,
  ShieldCheck,
  UserCheck,
  Activity,
  MoreVertical,
  Zap,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Calendar,
  ChevronRight,
  Monitor,
  CheckCircle,
  LayoutDashboard,
} from "lucide-react";
import { dashboardService } from "../../services/dashboardService";
import { barberService } from "../../services/barberService";
import { adaptList, adaptObject } from "../../services/apiAdapter";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

const MetricValue = ({
  label,
  value,
  trend,
  icon: Icon,
  color = "text-accent",
}) => (
  <Card className="rounded-[26px] border border-border bg-card shadow-soft p-6 flex flex-col justify-between group cursor-default transition-all hover:border-accent/20">
    <div className="flex items-center justify-between mb-6">
      <div className="p-3 rounded-2xl bg-soft text-accent group-hover:bg-accent group-hover:text-inverse transition-colors duration-300">
        <Icon size={22} className={color} />
      </div>
      {trend && (
        <Badge className="bg-success-soft text-success border-none text-[9px] font-black h-6 px-3 rounded-full">
          {trend}
        </Badge>
      )}
    </div>
    <div>
      <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">
        {label}
      </p>
      <h3 className="text-2xl font-black text-main tracking-tight uppercase">
        {value}
      </h3>
    </div>
  </Card>
);

const ManagerDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const openTeamDirectory = () => navigate("/owner/hr");

  useEffect(() => {

    async function loadData() {
      try {
        setLoading(true);
        const [summary, barbersList] = await Promise.all([
          dashboardService.managerSummary(),
          barberService.list(),
        ]);
        setStats(adaptObject(summary, {}));
        setBarbers(adaptList(barbersList));
      } catch (error) {
        console.error("Manager dashboard error", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const barberRows = Array.isArray(barbers) ? barbers : [];

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Monitor className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-[10px] uppercase tracking-widest">
            تحليل النبض التشغيلي...
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-8 pb-24 erp-page-container" dir="rtl">
      {/* SaaS Executive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20 transition-transform hover:scale-105">
            <Activity className="text-white w-8 h-8" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-main uppercase tracking-tight leading-none">
              مركز العمليات
            </h1>
            <p className="text-base font-medium text-muted">
              متابعة الأداء الحي، كفاءة الفريق، واعتمادات الجودة الفورية
            </p>
          </div>
        </div>
        <Badge
          variant="success"
          className="h-10 px-6 rounded-xl shadow-sm shadow-success/20 font-black text-[10px] uppercase tracking-widest gap-3"
        >
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          الرقابة التشغيلية نشطة
        </Badge>
      </div>

      {/* Operational Key Metrics SaaS Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
        <MetricValue
          label="حضور الفريق"
          value={`${stats?.active_barbers || 0 || ""} خبير`}
          trend="متواجد حالياً"
          icon={UserCheck}
        />
        <MetricValue
          label="مواعيد اليوم"
          value={stats?.today_appointments || 0 || ""}
          trend="موعد مؤكد"
          icon={Calendar}
          color="text-info"
        />
        <MetricValue
          label="ورديات نشطة"
          value={stats?.open_shifts || 0 || ""}
          trend="نقطة بيع"
          icon={Users}
          color="text-warning"
        />
        <MetricValue
          label="كفاءة العمل"
          value={stats?.operational_efficiency || "٩٥٪"}
          trend="+٤٪ نمو"
          icon={Zap}
          color="text-success"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Active Staff Monitor Table Area */}
        <Card className="xl:col-span-2 rounded-premium border-border/60 bg-card shadow-soft overflow-hidden transition-all hover:shadow-premium group">
          <CardHeader className="p-8 border-b border-border/40 flex flex-row items-center justify-between bg-soft/30">
            <div>
              <CardTitle className="text-xl font-black text-main uppercase leading-none">
                مراقبة أداء الطاقم
              </CardTitle>
              <CardDescription className="text-xs font-bold text-muted mt-2 uppercase tracking-widest">
                تتبع الحالة والإنتاجية اللحظية للفريق الفني
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              size="icon"
              disabled={loading}
              onClick={() => {}}
              className="rounded-xl w-11 h-11 border border-border group-hover:border-accent/20 shadow-sm"
              title="الانتقال لإدارة الموظفين"
            >
              <MoreVertical size={20} strokeWidth={2.5} />
            </Button>
          </CardHeader>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-border bg-soft/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    الخبير المسؤول
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    الوضعية الحالية
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    العمولة
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    تاريخ القيد
                  </th>
                  <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {barberRows.map((barber) => (
                  <tr
                    key={barber.id}
                    className="group transition-all hover:bg-accent-subtle/30"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-accent-soft border border-accent/10 flex items-center justify-center text-accent font-black text-sm shadow-sm transition-transform group-hover:scale-110">
                          {barber.display_name?.charAt(0) || "U"}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-black text-main uppercase tracking-tight text-base group-hover:text-accent transition-colors">
                            {barber.display_name || "غير محدد"}
                          </div>
                          <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                            خبير معتمد
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <Badge
                        variant={barber.is_active ? "success" : "outline"}
                        className="h-6 px-4 font-black text-[9px] uppercase tracking-widest"
                      >
                        {barber.is_active ? "نشط الآن" : "غير متصل"}
                      </Badge>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-sm font-black text-accent tabular-nums">
                        {barber.commission_rate || 0}%
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-xs font-bold text-muted uppercase tracking-tighter tabular-nums">
                        {barber.created_at
                          ? new Date(barber.created_at).toLocaleDateString(
                              "ar-EG",
                            )
                          : "---"}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center">
                        <Button
                          variant="secondary"
                          size="icon"
                          disabled={loading}
                          onClick={() => {}}
                          className="rounded-xl h-10 w-10 border border-border group-hover:border-accent/20 transition-all shadow-sm"
                          title="فتح ملف الخبير"
                        >
                          <ChevronRight
                            className="rotate-180 text-muted group-hover:text-accent"
                            size={16}
                            strokeWidth={3}
                          />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {barberRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-24 text-center opacity-40">
                      <div className="flex flex-col items-center gap-4">
                        <Users
                          size={80}
                          strokeWidth={1}
                          className="text-muted"
                        />
                        <p className="font-black text-xl text-main uppercase tracking-tight">
                          لا يوجد كوادر مسجلة
                        </p>
                        <p className="text-sm font-medium">
                          يرجى تسجيل الموظفين عبر وحدة الـ HR
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Decision SaaS Matrix */}
        <div className="space-y-8">
          <Card className="rounded-premium border-border/60 bg-card shadow-soft p-8 hover:shadow-premium transition-all">
            <CardTitle className="text-xl font-black text-main uppercase mb-10 flex items-center gap-3">
              <Zap size={22} className="text-accent" /> مصفوفة الإجراءات
            </CardTitle>
            <div className="space-y-3">
              {[
                {
                  label: "سجل الحضور اليومي",
                  icon: UserCheck,
                  to: "/manager/attendance",
                  color: "text-success",
                },
                {
                  label: "مركز الاعتمادات",
                  icon: ShieldCheck,
                  to: "/manager/approvals",
                  color: "text-warning",
                },
                {
                  label: "جدول المواعيد",
                  icon: Clock,
                  to: "/bookings",
                  color: "text-info",
                },
              ].map((btn, i) => (
                <button
                  type="button"
                  key={i}
                  disabled={loading}
                  onClick={() => {}}
                  className="w-full p-5 rounded-2xl bg-soft border border-border hover:border-accent/30 hover:bg-white transition-all text-right flex items-center justify-between group/btn shadow-none"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-accent shadow-sm border border-border/40 transition-all group-hover/btn:bg-accent group-hover/btn:text-white group-hover/btn:border-accent">
                      <btn.icon size={20} strokeWidth={2} />
                    </div>
                    <span className="text-[11px] font-black text-muted uppercase tracking-widest group-hover/btn:text-accent transition-colors leading-none">
                      {btn.label}
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    strokeWidth={3}
                    className="text-muted/30 rotate-180 group-hover/btn:text-accent group-hover/btn:translate-x-[-4px] transition-all"
                  />
                </button>
              ))}
            </div>
          </Card>

          <Card className="rounded-premium border-border/60 bg-[#1B1714] shadow-premium overflow-hidden group p-8 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl -mr-16 -mt-16" />
            <CardTitle className="text-lg font-black text-warning uppercase flex items-center gap-4 relative z-10 mb-8 leading-none">
              <ShieldCheck size={24} /> طلبات الاعتماد
            </CardTitle>
            
            {Number(stats?.pending_discounts || 0) > 0 ? (
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-warning/10 border border-warning/20">
                  <div className="w-12 h-12 bg-warning rounded-xl flex items-center justify-center text-black shadow-lg shadow-warning/20 animate-bounce">
                    <Zap size={22} strokeWidth={3} />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-warning leading-none mb-1">
                      {stats.pending_discounts} طلبات
                    </div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">بانتظار قرارك الإداري</p>
                  </div>
                </div>
                <Button 
                  onClick={() => navigate("/manager/approvals")}
                  className="w-full h-14 rounded-xl bg-warning hover:bg-warning/80 text-black font-black text-xs uppercase tracking-widest gap-2"
                >
                  فتح مركز الاعتمادات <ArrowRight size={16} />
                </Button>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center justify-center py-10 border-2 border-dashed border-white/5 rounded-[28px] bg-white/5 opacity-60">
                <BarChart3
                  size={40}
                  strokeWidth={1}
                  className="text-muted/40 mb-6"
                />
                <p className="text-[10px] font-black text-center text-white/50 uppercase tracking-[0.2em] leading-relaxed">
                  لا توجد عمليات معلقة
                  <br />
                  بانتظار الموافقة حالياً
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;

