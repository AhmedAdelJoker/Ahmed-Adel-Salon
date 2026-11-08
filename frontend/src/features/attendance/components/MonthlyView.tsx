import { BarChart3 } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import type { AttendanceRecord } from "@/features/attendance/types";
import { type TranslateFn } from "@/features/attendance/utils/attendance";

export default function MonthlyView({
  processedData,
  t,
}: {
  processedData: AttendanceRecord[];
  t: TranslateFn;
}) {
  const rows = Array.isArray(processedData) ? processedData : [];
  const totals = rows.reduce<{ hours: number; overtime: number; late: number }>(
    (acc, r) => {
      acc.hours += Number(r.stats?.totalHours || 0);
      acc.overtime += Number(r.stats?.overtime || 0);
      acc.late += Number(r.stats?.lateMinutes || 0);
      return acc;
    },
    { hours: 0, overtime: 0, late: 0 },
  );

  return (
    <div
      className="space-y-4"
      id="attendance-panel-analytics"
      role="tabpanel"
      aria-labelledby="attendance-tab-analytics"
    >
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-black text-main">{t("attendance.analyticsTitle")}</h3>
        <p className="mt-1 text-xs font-medium text-muted">{t("attendance.analyticsHint")}</p>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/20 text-muted">
              <BarChart3 size={24} />
            </div>
            <p className="mt-4 text-sm font-black text-main">
              {t("attendance.analyticsUnavailable")}
            </p>
            <p className="mt-1 text-xs font-medium text-muted">
              {t("attendance.analyticsUnavailableHint")}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-muted">{t("attendance.kpiHours")}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-main">{totals.hours.toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-muted">{t("attendance.lateMinutes")}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-main">{Math.round(totals.late)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-muted">{t("attendance.overtime")}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-main">{totals.overtime.toFixed(1)}</p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-[11px] font-black uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 text-start">{t("attendance.colEmployee")}</th>
                    <th className="px-2 py-2 text-start">{t("attendance.kpiHours")}</th>
                    <th className="px-2 py-2 text-start">{t("attendance.lateMinutes")}</th>
                    <th className="px-2 py-2 text-start">{t("attendance.overtime")}</th>
                    <th className="px-2 py-2 text-start">{t("attendance.score")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={String(r.employee_id ?? r.id)}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar name={r.employee_name || r.full_name || "—"} size="xs" shape="circle" />
                          <span className="font-bold text-main">{r.employee_name || r.full_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 tabular-nums font-semibold">{Number(r.stats?.totalHours || 0).toFixed(1)}</td>
                      <td className="px-2 py-2 tabular-nums font-semibold">{Number(r.stats?.lateMinutes || 0)}</td>
                      <td className="px-2 py-2 tabular-nums font-semibold">{Number(r.stats?.overtime || 0).toFixed(1)}</td>
                      <td className="px-2 py-2 font-semibold">{r.ai?.score != null ? `${r.ai.score}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
