import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  ChevronRight,
  AlertCircle,
  Clock,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { hasRoleAccess } from "@/lib/access/roles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { loadErrorMessage } from "@/lib/core/asyncError";
import type { OwnerAlert, OwnerAlertsPayload } from "@/features/owner-alerts/types";
import type { AlertPriority as Priority } from "@/features/owner-alerts/types";

const PRIORITY_STYLES: Record<Priority, { label: string; className: string }> = {
  high: {
    label: "حرجة",
    className: "bg-danger-soft text-danger border-danger/20",
  },
  medium: {
    label: "قيد المراجعة",
    className: "bg-warning-soft text-warning border-warning/20",
  },
  low: {
    label: "معلومة",
    className: "bg-info-soft text-info border-info/20",
  },
};

// Icons are chosen by source, not by severity. The source is a fact the backend
// reports; severity is its judgement, and dressing a severity up with a lock
// icon is how a stock warning ends up looking like a breach.
const SOURCE_ICONS: Record<string, typeof FileText> = {
  invoice_adjustment_requests: FileText,
  discount_approval_requests: FileText,
  notifications: AlertCircle,
  employee_documents: Clock,
  products: AlertTriangle,
  pos_shifts: AlertOctagon,
};

function formatWhen(iso: string | null): string {
  if (!iso) return "بلا تاريخ";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "بلا تاريخ";

  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days === 1) return "أمس";
  if (days < 30) return `منذ ${days} يوم`;
  return parsed.toLocaleDateString("ar-EG");
}

const SmartAlerts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState<OwnerAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const canManageRules = hasRoleAccess(user?.role, ["OWNER", "ADMIN"] as any);
  const settingsDestination = canManageRules ? "/owner/settings" : "/activity-logs";

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/owner/alerts");
      const data = adaptObject(res.data) as OwnerAlertsPayload;
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (error) {
      // Kept distinct from "loaded successfully, nothing pending". Showing an
      // empty alerts page after a failed request would read as "you are safe".
      setLoadError(loadErrorMessage(error, "تعذّر تحميل التنبيهات"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const counts = useMemo(
    () => ({
      high: alerts.filter((a) => a.priority === "high").length,
      medium: alerts.filter((a) => a.priority === "medium").length,
      low: alerts.filter((a) => a.priority === "low").length,
    }),
    [alerts],
  );

  const alertRows = useMemo(
    () => (showCriticalOnly ? alerts.filter((a) => a.priority === "high") : alerts),
    [alerts, showCriticalOnly],
  );

  // Only notifications can actually be dismissed, because only they have a
  // read flag. The previous "تجاهل" button on every row set local state and was
  // gone on refresh, so it looked like acknowledging an alert and recorded
  // nothing. A pending request or a stock level is not dismissible -- it is
  // resolved by doing the thing, so it gets a link and no dismiss button.
  const dismissNotification = async (alert: OwnerAlert) => {
    const id = alert.key.replace("notification-", "");
    setBusyKey(alert.key);
    try {
      await api.patch(`/notifications/${id}/read`);
      setAlerts((current) => current.filter((a) => a.key !== alert.key));
    } catch (error) {
      setLoadError(loadErrorMessage(error, "تعذّر تعليم الإشعار كمقروء"));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 sm:space-y-8">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-soft sm:h-14 sm:w-14">
            <ShieldCheck className="h-6 w-6 text-inverse sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-main sm:text-3xl">
              مركز التنبيهات
            </h1>
            <p className="text-xs text-muted sm:text-sm">
              ما ينتظر قرارك فعلياً: طلبات، مستندات، مخزون، وإشعارات غير مقروءة
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <Button
            variant="outline"
            onClick={() => setShowCriticalOnly((value) => !value)}
            className="h-11 flex-1 rounded-xl border-border px-6 text-[10px] font-black uppercase tracking-widest md:flex-none"
          >
            <Filter className="me-2" size={14} />
            {showCriticalOnly ? "كل التنبيهات" : "الحرجة فقط"}
          </Button>
          <Button
            variant="outline"
            onClick={loadAlerts}
            disabled={loading}
            className="h-11 flex-1 rounded-xl border-border px-6 text-[10px] font-black uppercase tracking-widest md:flex-none"
          >
            {loading ? (
              <Loader2 className="me-2 animate-spin" size={14} />
            ) : (
              <RefreshCw className="me-2" size={14} />
            )}
            تحديث
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="rounded-[22px] border border-danger/20 bg-danger-soft p-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <div>
                <p className="text-sm font-black text-danger">{loadError}</p>
                <p className="mt-1 text-xs text-muted">
                  لم يتم جلب أي بيانات. هذه ليست حالة «لا يوجد تنبيهات».
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={loadAlerts} className="shrink-0 rounded-xl">
              إعادة المحاولة
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        <StatusCard
          icon={ShieldCheck}
          tone="success"
          label="إجمالي ما ينتظرك"
          value={loadError ? "—" : loading ? "…" : `${alerts.length}`}
        />
        <StatusCard
          icon={AlertOctagon}
          tone="danger"
          label="حرجة"
          value={loadError ? "—" : loading ? "…" : `${counts.high}`}
        />
        <StatusCard
          icon={FileText}
          tone="warning"
          label="قيد المراجعة"
          value={loadError ? "—" : loading ? "…" : `${counts.medium}`}
        />
      </div>

      <div className="space-y-4">
        {alertRows.map((alert) => {
          const Icon = SOURCE_ICONS[alert.source] ?? FileText;
          const config = PRIORITY_STYLES[alert.priority] ?? PRIORITY_STYLES.low;
          const canDismiss = alert.source === "notifications";

          return (
            <Card
              key={alert.key}
              className="group relative overflow-hidden rounded-[26px] border border-border bg-card shadow-soft transition-all hover:border-accent/20"
            >
              <CardContent className="relative flex flex-col items-start justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:gap-10">
                <div className="flex w-full flex-1 items-start gap-6 sm:gap-8">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border/30 shadow-soft sm:h-16 sm:w-16 ${
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
                    {alert.message && (
                      <p className="max-w-4xl text-xs font-medium leading-relaxed text-muted sm:text-sm">
                        {alert.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-2 text-[9px] font-black uppercase tracking-widest text-muted">
                      <Clock className="h-3.5 w-3.5 text-accent" />
                      {formatWhen(alert.occurred_at)}
                    </div>
                  </div>
                </div>

                <div className="flex w-full items-center gap-3 border-t border-border/50 pt-6 lg:w-auto lg:border-t-0 lg:pt-0">
                  {canDismiss && (
                    <Button
                      variant="ghost"
                      disabled={busyKey === alert.key}
                      onClick={() => dismissNotification(alert)}
                      className="h-11 flex-1 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest text-muted hover:bg-soft lg:flex-none"
                    >
                      {busyKey === alert.key ? "…" : "تعليم كمقروء"}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => navigate(alert.destination)}
                    className="h-11 flex-[2] rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-soft transition-all hover:-translate-y-0.5 lg:flex-none"
                  >
                    اتخاذ إجراء
                    <ChevronRight className="me-2 rotate-180" size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {!loading && !loadError && alertRows.length === 0 && (
          <Card className="rounded-[26px] border border-border bg-card p-8 shadow-soft">
            <EmptyState
              variant="table"
              icon={ShieldCheck}
              title={showCriticalOnly ? "لا توجد تنبيهات حرجة" : "لا يوجد ما ينتظرك"}
              message={
                showCriticalOnly
                  ? "لا توجد طلبات أو مستندات أو نقص مخزون مسجّل حالياً."
                  : "كل الطلبات تمت مراجعتها، ولا توجد مستندات قاربت الانتهاء أو إشعارات غير مقروءة."
              }
            />
          </Card>
        )}
      </div>

      <Card className="group relative overflow-hidden rounded-[26px] border border-border bg-primary p-8 shadow-premium sm:p-12">
        <div className="absolute left-0 top-0 -ml-48 -mt-48 h-96 w-96 rounded-full bg-white/5 blur-3xl transition-transform duration-1000 group-hover:scale-110" />
        <div className="relative z-10 flex flex-col items-center justify-between gap-10 xl:flex-row">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-right sm:gap-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-soft transition-transform group-hover:rotate-6">
              <ShieldCheck className="size-8 text-accent" />
            </div>
            <div>
              <h4 className="mb-2 text-xl font-black tracking-tight text-inverse sm:text-2xl">
                مصدر هذه التنبيهات
              </h4>
              <p className="max-w-3xl text-xs font-medium leading-relaxed text-white/70 sm:text-sm">
                تُبنى من بيانات النظام مباشرة: طلبات تعديل الفواتير، طلبات الخصم،
                إشعاراتك غير المقروءة، مستندات الموظفين المنتهية أو القاربة على
                الانتهاء، المنتجات تحت حد التنبيه، والورديات المفتوحة.
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate(settingsDestination)}
            className="h-14 w-full shrink-0 rounded-xl bg-inverse px-10 text-[11px] font-black uppercase tracking-widest text-primary shadow-premium hover:bg-inverse/90 xl:w-auto"
          >
            {canManageRules ? "إعدادات الرقابة" : "سجل الرقابة"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

function StatusCard({ icon: Icon, label, value, tone }: any) {
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