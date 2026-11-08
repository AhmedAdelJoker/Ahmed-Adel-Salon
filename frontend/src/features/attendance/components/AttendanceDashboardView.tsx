import { AlertCircle, Clock, Coffee, UserCheck } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AttendanceRecord } from "@/features/attendance/types";
import {
  formatTime,
  statusLabel,
  type TranslateFn,
} from "@/features/attendance/utils/attendance";
import { cn } from "@/lib/core/utils";

function statusBadgeClass(status?: string) {
  switch (status) {
    case "in":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
    case "break":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700";
    case "break_end":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700";
    case "out":
      return "border-slate-500/20 bg-slate-500/10 text-slate-700";
    default:
      return "border-border bg-muted/20 text-muted";
  }
}

export default function AttendanceDashboardView({
  todayRecords,
  t,
  locale,
  onOpenEmployeeFile,
}: {
  todayRecords: AttendanceRecord[];
  t: TranslateFn;
  locale: string;
  onOpenEmployeeFile?: (id: string | number) => void;
}) {
  const present = todayRecords.filter(
    (r) => r.status === "in" || r.status === "break" || r.status === "break_end",
  ).length;
  const late = todayRecords.filter(
    (r) => Boolean(r.is_late) || Number(r.stats?.lateMinutes || 0) > 0,
  ).length;
  const completed = todayRecords.filter((r) => r.status === "out" || r.isComplete).length;

  return (
    <div
      className="space-y-4"
      id="attendance-panel-today"
      role="tabpanel"
      aria-labelledby="attendance-tab-today"
    >
      <p className="text-xs font-semibold text-muted">{t("attendance.todayViewHint")}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: t("attendance.kpiPresent"), value: present, icon: UserCheck, cls: "text-primary bg-primary/10" },
          { label: t("attendance.kpiLate"), value: late, icon: AlertCircle, cls: "text-red-600 bg-red-500/10" },
          { label: t("attendance.kpiCompleted"), value: completed, icon: Clock, cls: "text-emerald-700 bg-emerald-500/10" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", item.cls)}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-main">{item.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h3 className="text-sm font-black text-main">{t("attendance.tabToday")}</h3>
          <span className="rounded-full bg-muted/30 px-2.5 py-1 text-xs font-bold text-muted tabular-nums">
            {todayRecords.length}
          </span>
        </div>
        {todayRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/20 text-muted">
              <UserCheck size={24} />
            </div>
            <p className="mt-4 text-sm font-black text-main">{t("attendance.noDataToday")}</p>
            <p className="mt-1 max-w-sm text-xs font-medium text-muted">
              {t("attendance.noDataTodayHint")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {todayRecords.map((rec) => {
              const id = rec.employee_id ?? rec.id;
              const lateMinutes = Number(rec.stats?.lateMinutes || 0);
              const isLate = Boolean(rec.is_late) || lateMinutes > 0;
              return (
                <div
                  key={String(id)}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <EmployeeAvatar
                      name={rec.employee_name || rec.full_name || "—"}
                      imageUrl={(rec.profile_photo as string | undefined) ?? (rec.employee_photo as string | undefined) ?? undefined}
                      size="sm"
                      shape="circle"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-main">
                        {rec.employee_name || rec.full_name || "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black",
                            statusBadgeClass(rec.status),
                          )}
                        >
                          {statusLabel(rec.status, t)}
                        </span>
                        {isLate && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-700">
                            <AlertCircle size={11} />
                            {t("attendance.statusLate", { minutes: lateMinutes || "—" })}
                          </span>
                        )}
                        {rec.status === "break" && (
                          <Badge variant="outline" className="h-5 gap-1 border-amber-500/20 bg-amber-500/10 px-2 text-[10px] font-black text-amber-700">
                            <Coffee size={10} /> {t("attendance.statusBreak")}
                          </Badge>
                        )}
                      </div>
                      {rec.late_reason ? (
                        <p className="mt-1 truncate text-[11px] font-medium text-muted" title={String(rec.late_reason)}>
                          {t("attendance.lateReason")}: {String(rec.late_reason)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-start sm:text-end">
                      <p className="text-xs font-bold text-main tabular-nums">
                        {formatTime(rec.created_at, locale)}
                      </p>
                      <p className="text-[10px] font-semibold text-muted">
                        {Number(rec.stats?.totalHours || 0).toFixed(1)} {t("attendance.hours")}
                      </p>
                    </div>
                    {onOpenEmployeeFile && id != null && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl text-xs font-bold"
                        onClick={() => onOpenEmployeeFile(id)}
                      >
                        {t("attendance.openFile")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
