import { CheckCircle2, Loader2, Plane, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import type { LeaveRecord } from "@/features/attendance/types";
import { type TranslateFn } from "@/features/attendance/utils/attendance";
import { cn } from "@/lib/core/utils";

export default function LeavesView({
  leaves,
  leaveFilter,
  setLeaveFilter,
  onNewLeave,
  onLeaveAction,
  canApprove,
  loading,
  t,
  locale,
}: {
  leaves: LeaveRecord[];
  leaveFilter: string;
  setLeaveFilter: (v: string) => void;
  onNewLeave: () => void;
  onLeaveAction: (leaveId: string | number | undefined, action: string) => void;
  canApprove: boolean;
  loading?: boolean;
  t: TranslateFn;
  locale?: string;
}) {
  const loc = locale || "ar-EG";
  const filters = [
    { id: "all", label: t("attendance.leaveStatusAll") },
    { id: "pending", label: t("attendance.leaveStatusPending") },
    { id: "approved", label: t("attendance.leaveStatusApproved") },
    { id: "rejected", label: t("attendance.leaveStatusRejected") },
  ];
  const statusClass = (status?: string) => {
    if (status === "approved") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
    if (status === "rejected") return "border-red-500/20 bg-red-500/10 text-red-700";
    return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  };
  const statusText = (status?: string) => {
    if (status === "approved") return t("attendance.leaveStatusApproved");
    if (status === "rejected") return t("attendance.leaveStatusRejected");
    return t("attendance.leaveStatusPending");
  };

  return (
    <div className="space-y-4" id="attendance-panel-leaves" role="tabpanel" aria-labelledby="attendance-tab-leaves">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-main">
            <Plane size={18} className="text-primary" /> {t("attendance.leaveTitle")}
          </h3>
          <p className="mt-1 text-xs font-medium text-muted">{t("attendance.leaveHint")}</p>
        </div>
        <Button className="h-10 gap-2 rounded-xl font-bold" onClick={onNewLeave}>
          <Plus size={16} /> {t("attendance.newLeave")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setLeaveFilter(f.id)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-bold transition-colors",
              leaveFilter === f.id
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted hover:text-main",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-14 text-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Plane size={26} className="text-muted/50" />
            <p className="mt-3 text-sm font-black text-main">{t("attendance.leaveEmpty")}</p>
            <p className="mt-1 text-xs font-medium text-muted">{t("attendance.leaveEmptyHint")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {leaves.map((leave) => (
              <div key={String(leave.id)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <EmployeeAvatar name={leave.employee_name || "—"} size="sm" shape="circle" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-main">{leave.employee_name || "—"}</p>
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black", statusClass(leave.status))}>
                        {statusText(leave.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {leave.start_date ? new Date(leave.start_date).toLocaleDateString(loc) : "—"} → {leave.end_date ? new Date(leave.end_date).toLocaleDateString(loc) : "—"}
                      {leave.type ? ` · ${leave.type}` : ""}
                    </p>
                    {leave.reason ? <p className="mt-1 text-xs text-muted">{leave.reason}</p> : null}
                  </div>
                </div>
                {leave.status === "pending" && canApprove && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-9 rounded-xl border-emerald-500/20 text-emerald-700 hover:bg-emerald-500/10" onClick={() => onLeaveAction(leave.id, "approved")}>
                      <CheckCircle2 size={14} /> {t("attendance.approve")}
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 rounded-xl border-red-500/20 text-red-700 hover:bg-red-500/10" onClick={() => onLeaveAction(leave.id, "rejected")}>
                      <XCircle size={14} /> {t("attendance.reject")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
