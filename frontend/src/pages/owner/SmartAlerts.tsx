import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  ChevronRight,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Lock,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { hasRoleAccess } from "@/lib/access/roles";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const INITIAL_ALERTS = [
  {
    id: 1,
    title: "خطر: موظف موقوف لديه صلاحيات فعالة",
    desc: 'الموظف "أحمد علي" حالته "موقوف" ولكن لا يزال بإمكانه الوصول لنظام المخزن والعمليات الحساسة.',
    priority: "high",
    category: "security",
    time: "منذ 5 دقائق",
  },
  {
    id: 2,
    title: "تعديل فاتورة بعد التحصيل المالي",
    desc: "تم رصد تعديل في بنود الفاتورة INV-9020 من قبل الكاشير بعد إتمام عملية استلام المبلغ المالي.",
    priority: "high",
    category: "financial",
    time: "منذ ساعة",
  },
  {
    id: 3,
    title: "نشاط غير معتاد خارج ساعات العمل",
    desc: "تم تسجيل دخول للنظام في تمام الساعة 3:00 صباحاً من جهاز غير مسجل مسبقاً في القائمة الموثوقة.",
    priority: "medium",
    category: "access",
    time: "أمس، 03:00 ص",
  },
  {
    id: 4,
    title: "تعديلات متكررة على ملف موظف",
    desc: 'تم تعديل راتب الحلاق "محمد" 3 مرات خلال الـ 24 ساعة الماضية، يرجى مراجعة المبررات.',
    priority: "medium",
    category: "admin",
    time: "اليوم، 10:30 ص",
  },
  {
    id: 5,
    title: "رواتب بانتظار المراجعة الدورية",
    desc: "هناك 5 موظفين لم يتم مراجعة عقودهم أو تحديث سلم رواتبهم منذ أكثر من 6 أشهر.",
    priority: "low",
    category: "hr",
    time: "منذ يومين",
  },
];

const PRIORITY_STYLES = {
  high: {
    label: "حرجة جداً",
    className: "bg-danger-soft text-danger border-danger/20",
  },
  medium: {
    label: "تنبيه إداري",
    className: "bg-warning-soft text-warning border-warning/20",
  },
  low: {
    label: "مراجعة دورية",
    className: "bg-info-soft text-info border-info/20",
  },
};

function getAlertDestination(category) {
  switch (category) {
    case "financial":
      return "/owner/financial";
    case "admin":
    case "hr":
      return "/owner/hr";
    case "security":
    case "access":
    default:
      return "/activity-logs";
  }
}

function getAlertIcon(category) {
  switch (category) {
    case "security":
      return Lock;
    case "financial":
      return DollarSign;
    case "access":
      return Eye;
    default:
      return FileText;
  }
}

const SmartAlerts = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const canManageRules = hasRoleAccess(
    user?.role,
     
    ["OWNER", "ADMIN"] as any,
  );
  const settingsDestination = canManageRules
    ? "/owner/settings"
    : "/activity-logs";

  const alertRows = useMemo(() => {
    if (!showCriticalOnly) return alerts;
    return alerts.filter((alert) => alert.priority === "high");
  }, [alerts, showCriticalOnly]);

  const criticalCount = alerts.filter(
    (alert) => alert.priority === "high",
  ).length;
  const mediumCount = alerts.filter(
    (alert) => alert.priority === "medium",
  ).length;

  const dismissAlert = (alertId) => {
    setAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  return (
    <div className="space-y-6 pb-24 sm:space-y-8">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-soft sm:h-14 sm:w-14">
            <ShieldAlert className="h-6 w-6 text-inverse sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-main sm:text-3xl">
              مركز التنبيهات
            </h1>
            <p className="text-xs text-muted sm:text-sm">
              لوحة رقابية لحظية لمتابعة المخاطر التشغيلية والتنبيهات الحساسة
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setShowCriticalOnly((value) => !value)}
            className="h-11 flex-1 rounded-xl border-border px-6 text-[10px] font-black uppercase tracking-widest md:flex-none"
          >
            <Filter className="mr-2" size={14} />
            {showCriticalOnly ? "كل التنبيهات" : "التنبيهات الحرجة"}
          </Button>
          <Button
            variant="primary"
            disabled={loading}
            onClick={() => navigate(settingsDestination)}
            className="h-11 flex-1 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-soft md:flex-none"
          >
            <Settings className="mr-2" size={14} />
            {canManageRules ? "إعدادات الرقابة" : "فتح سجل الرقابة"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        <StatusCard
          icon={ShieldCheck}
          tone="success"
          label="حالة النظام"
          value="آمن ومستقر"
        />
        <StatusCard
          icon={AlertOctagon}
          tone="danger"
          label="تنبيهات نشطة"
          value={`${criticalCount || ""} تنبيه حرج`}
        />
        <StatusCard
          icon={FileText}
          tone="warning"
          label="تنبيهات متوسطة"
          value={`${mediumCount || ""} قيد المراجعة`}
        />
        <Card className="rounded-[22px] border border-border bg-soft p-5 sm:p-6 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-accent/10 bg-accent-soft/30 p-2.5">
              <Zap className="h-5 w-5 animate-pulse text-accent" />
            </div>
            <p className="text-[10px] font-bold leading-relaxed text-muted">
              الذكاء الاصطناعي يراجع العمليات المالية والتعديلات الإدارية
              لحظياً.
            </p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {alertRows.map((alert) => {
          const Icon = getAlertIcon(alert.category);
          const config = PRIORITY_STYLES[alert.priority] || PRIORITY_STYLES.low;

          return (
            <Card
              key={alert.id}
              className="group relative overflow-hidden rounded-[26px] border border-border bg-card shadow-soft transition-all hover:border-accent/20"
            >
              <div className="absolute right-0 top-0 h-full w-24 -mr-12 skew-x-12 bg-soft transition-all duration-500 group-hover:bg-accent-soft/10" />

              <CardContent className="relative flex flex-col items-center justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:gap-10">
                <div className="flex w-full flex-1 items-start gap-6 sm:gap-8">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border/30 shadow-soft transition-all duration-300 group-hover:scale-105 sm:h-16 sm:w-16 ${
                      alert.priority === "high"
                        ? "bg-danger-soft text-danger"
                        : alert.priority === "medium"
                          ? "bg-warning-soft text-warning"
                          : "bg-info-soft text-info"
                    }`}
                  >
                    <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                      <h3 className="text-base font-black tracking-tight text-main sm:text-lg">
                        {alert.title}
                      </h3>
                      <Badge
                        className={`rounded-lg border px-3 py-0.5 text-[9px] font-black uppercase tracking-widest ${config.className}`}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    <p className="max-w-4xl text-xs font-medium leading-relaxed text-muted sm:text-sm">
                      {alert.desc}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 pt-2 sm:gap-6">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted">
                        <Clock className="h-3.5 w-3.5 text-accent" />{" "}
                        {alert.time}
                      </div>
                      <div className="hidden h-1 w-1 rounded-full bg-border sm:block" />
                      <div className="text-[9px] font-black uppercase tracking-widest text-accent">
                        بروتوكول: النظام المركزي
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex w-full items-center gap-3 border-t border-border/50 pt-6 lg:w-auto lg:border-t-0 lg:pt-0">
                  <Button
                    variant="ghost"
                    disabled={loading}
                    onClick={() => dismissAlert(alert.id)}
                    className="h-11 flex-1 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest text-muted hover:bg-soft lg:flex-none"
                  >
                    تجاهل
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      navigate(getAlertDestination(alert.category))
                    }
                    className="h-11 flex-[2] rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-soft transition-all hover:-translate-y-0.5 lg:flex-none"
                  >
                    اتخاذ إجراء{" "}
                    <ChevronRight className="mr-2 rotate-180" size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {alertRows.length === 0 && (
          <Card className="rounded-[26px] border border-border bg-card p-8 shadow-soft">
            <TableEmptyState
              icon={ShieldCheck}
              title="لا توجد تنبيهات"
              description="جميع البنود الحالية تمت مراجعتها أو لا توجد عناصر تطابق الفلتر النشط."
            />
          </Card>
        )}
      </div>

      <Card className="group relative overflow-hidden rounded-[26px] border border-border bg-primary p-8 shadow-premium sm:p-12">
        <div className="absolute left-0 top-0 -ml-48 -mt-48 h-96 w-96 rounded-full bg-white/5 blur-3xl transition-transform duration-1000 group-hover:scale-110" />
        <div className="relative z-10 flex flex-col items-center justify-between gap-10 xl:flex-row">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-right sm:gap-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-soft transition-transform group-hover:rotate-6">
              <Shield size={32} className="text-accent" />
            </div>
            <div>
              <h4 className="mb-2 text-xl font-black tracking-tight text-inverse sm:text-2xl">
                تخصيص بروتوكولات الرقابة
              </h4>
              <p className="max-w-3xl text-xs font-medium leading-relaxed text-white/70 sm:text-sm">
                يمكنك تعديل عتبات التنبيه وتعريف العمليات الحساسة حتى ينبهك
                النظام فوراً مع كل تغيير مهم.
              </p>
            </div>
          </div>
          <Button
            disabled={loading}
            onClick={() => navigate(settingsDestination)}
            className="h-14 w-full shrink-0 rounded-xl bg-inverse px-10 text-[11px] font-black uppercase tracking-widest text-primary shadow-premium hover:bg-inverse/90 xl:w-auto"
          >
            {canManageRules ? "تعديل القواعد الأمنية" : "فتح سجل الرقابة"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

function StatusCard({ icon: Icon, label, value, tone }) {
  const toneClasses = {
    success: "bg-success-soft/10 border-success/10 text-success",
    danger: "bg-danger-soft/10 border-danger/10 text-danger",
    warning: "bg-warning-soft/10 border-warning/10 text-warning",
  };

  const classes = toneClasses[tone] || toneClasses.warning;

  return (
    <Card
      className={`flex items-center gap-4 rounded-[22px] border p-5 sm:p-6 ${classes}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card/60 shadow-soft">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-[9px] font-black uppercase tracking-widest text-muted">
          {label}
        </div>
        <div className="text-sm font-black">{value}</div>
      </div>
    </Card>
  );
}

export default SmartAlerts;
