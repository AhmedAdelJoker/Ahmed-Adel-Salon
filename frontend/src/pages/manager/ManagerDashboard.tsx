import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useState } from "react";

import {
  Users,
  Clock,
  ShieldCheck,
  UserCheck,
  Activity,
  Zap,
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronRight,
  Monitor,
} from "lucide-react";
import { dashboardService } from "@/services/dashboardService";
import { barberService } from "@/services/barberService";
import { adaptList, adaptObject } from "@/services/apiAdapter";
import { useNavigate } from "react-router-dom";
import {
  PageHeader,
  PremiumCard,
  StatCard,
  ContentPanel,
} from "@/components/shared/PremiumUI";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  interface ManagerStats {
    active_barbers?: number;
    today_appointments?: number;
    open_shifts?: number;
    operational_efficiency?: number;
    pending_discounts?: number;
    [key: string]: unknown;
  }

  interface ManagerBarber {
    id?: string | number;
    display_name?: string;
    is_active?: boolean;
    commission_rate?: number;
    created_at?: string;
    [key: string]: unknown;
  }

  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [barbers, setBarbers] = useState<ManagerBarber[]>([]);
  const [loading, setLoading] = useState(true);

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
          <p className="text-muted font-bold text-[10px] uppercase tracking-widest text-center">
            تحليل النبض التشغيلي...
          </p>
        </div>
      </div>
    );

  return (
    <div className="erp-page space-y-8 pb-12">
      <PageHeader
        title="مركز العمليات"
        subtitle="متابعة الأداء الحي وكفاءة الفريق"
        badge="لوحة المدير"
        icon={Activity}
        actions={
          <Badge
            variant="success"
            className="h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider"
          >
            <div className="h-1.5 w-1.5 rounded-full ml-2 bg-white animate-pulse" />
            الرقابة التشغيلية نشطة
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="حضور الفريق"
          value={`${stats?.active_barbers || 0} خبير`}
          icon={UserCheck}
          variant="primary"
          trend="up"
          trendValue={5}
        />
        <StatCard
          label="مواعيد اليوم"
          value={stats?.today_appointments || 0}
          icon={Calendar}
          variant="info"
        />
        <StatCard
          label="ورديات نشطة"
          value={stats?.open_shifts || 0}
          icon={Users}
          variant="warning"
        />
        <StatCard
          label="كفاءة العمل"
          value={stats?.operational_efficiency || "95%"}
          icon={Zap}
          variant="success"
          trend="up"
          trendValue={4}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <ContentPanel
          className="xl:col-span-2"
          title="مراقبة أداء الطاقم"
          subtitle="تتبع الحالة والإنتاجية اللحظية"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/owner/hr")}
              className="text-[10px] font-black uppercase"
            >
              إدارة الموظفين{" "}
              <ArrowRight size={14} className="mr-2 rotate-180" />
            </Button>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-soft/50">
                  <TableHead className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted sm:px-6">
                    الخبير
                  </TableHead>
                  <TableHead className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                    الحالة
                  </TableHead>
                  <TableHead className="hidden px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted md:table-cell">
                    العمولة
                  </TableHead>
                  <TableHead className="hidden px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted lg:table-cell">
                    تاريخ القيد
                  </TableHead>
                  <TableHead className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted sm:px-6">
                    إجراء
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/40">
                {barberRows.map((barber) => (
                  <TableRow
                    key={barber.id}
                    className="group transition-all hover:bg-soft/30"
                  >
                    <TableCell className="px-4 py-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary-soft text-xs font-black text-primary shadow-sm transition-transform group-hover:scale-110">
                          {barber.display_name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-main">
                            {barber.display_name || "غير محدد"}
                          </p>
                          <p className="text-[9px] font-bold uppercase text-muted">
                            خبير معتمد
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center">
                      <Badge
                        variant={barber.is_active ? "success" : "secondary"}
                        className="h-5 px-2 text-[8px] font-black uppercase tracking-widest"
                      >
                        {barber.is_active ? "نشط" : "غير متصل"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden px-4 py-4 text-center md:table-cell">
                      <span className="text-xs font-black text-primary">
                        {barber.commission_rate || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="hidden px-4 py-4 text-center lg:table-cell">
                      <span className="text-[10px] font-bold tabular-nums text-muted">
                        {barber.created_at
                          ? new Date(barber.created_at).toLocaleDateString(
                              "ar-EG",
                            )
                          : "---"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center sm:px-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg group-hover:text-primary"
                      >
                        <ChevronRight
                          className="rotate-180"
                          size={14}
                          strokeWidth={3}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ContentPanel>

        <div className="space-y-8">
          <ContentPanel
            title="مصفوفة الإجراءات"
            subtitle="عمليات المدير السريعة"
          >
            <div className="space-y-3">
              {[
                {
                  label: "سجل الحضور اليومي",
                  icon: UserCheck,
                  to: "/attendance",
                  variant: "success",
                },
                {
                  label: "مركز الاعتمادات",
                  icon: ShieldCheck,
                  to: "/approvals",
                  variant: "warning",
                },
                {
                  label: "جدول المواعيد",
                  icon: Clock,
                  to: "/bookings",
                  variant: "info",
                },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={() => navigate(btn.to)}
                  className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card/60 p-4 text-right transition-all hover:bg-card hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110",
                        btn.variant === "success"
                          ? "bg-success-soft text-success"
                          : btn.variant === "warning"
                            ? "bg-warning-soft text-warning"
                            : "bg-info-soft text-info",
                      )}
                    >
                      <btn.icon size={18} />
                    </div>
                    <span className="text-[11px] font-black text-muted uppercase tracking-wider group-hover:text-main">
                      {btn.label}
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-muted/30 rotate-180 group-hover:text-main"
                  />
                </button>
              ))}
            </div>
          </ContentPanel>

          <PremiumCard className="bg-card border-2 border-warning/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-warning/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-soft text-warning border border-warning/10 shadow-sm">
                  <ShieldCheck size={20} />
                </div>
                <Badge
                  variant="warning"
                  className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5"
                >
                  مركز الموافقات
                </Badge>
              </div>

              {(stats?.pending_discounts ?? 0) > 0 ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-2xl font-black text-main tracking-tight leading-none mb-1">
                      {stats?.pending_discounts} طلبات
                    </h4>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                      بانتظار قرارك الإداري
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate("/approvals")}
                    variant="warning"
                    className="h-11 w-full gap-2 rounded-xl text-xs font-black uppercase tracking-widest"
                  >
                    عرض الطلبات <ArrowRight size={16} />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-2xl bg-soft/30">
                  <BarChart3 size={32} className="text-muted/30 mb-3" />
                  <p className="text-[9px] font-black text-muted text-center uppercase tracking-widest leading-relaxed">
                    لا توجد عمليات معلقة
                    <br />
                    بانتظار الموافقة
                  </p>
                </div>
              )}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
