import { ChevronLeft, ChevronRight, History, Search, Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import api from "@/services/api";
import { formatEmployeeMoney } from "@/features/hr/utils/helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateTime,
  statusLabel,
  type TranslateFn,
} from "@/features/attendance/utils/attendance";
import type { AttendanceRecord } from "@/features/attendance/types";
import { cn } from "@/lib/core/utils";

export default function ArchiveView({
  archiveRecords,
  searchTerm,
  setSearchTerm,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  page,
  setPage,
  totalPages,
  total,
  pageSize,
  t,
  locale,
  language,
}: {
  archiveRecords: AttendanceRecord[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  total: number;
  pageSize: number;
  t: TranslateFn;
  locale: string;
  language?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Archived-penalty summary: the archive tab is the full historical ledger,
  // so the same scroll shows penalties alongside punches — grouped by month,
  // grouped by employee — with everything read-only and frozen.
  interface ArchivedPenaltyRow {
    id: number;
    employee_id: number;
    employee_name: string;
    date: string;
    late_minutes: number;
    reason: string | null;
    penalty_amount: number;
    is_excused: boolean;
    source: string;
  }
  const [penaltyRows, setPenaltyRows] = useState<ArchivedPenaltyRow[]>([]);
  const [penaltyLoading, setPenaltyLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setPenaltyLoading(true);
    api
      .get("/barber-presence/penalties", { params: { scope: "archive", limit: 5000 } })
      .then((res) => {
        if (!cancelled) setPenaltyRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setPenaltyRows([]);
      })
      .finally(() => {
        if (!cancelled) setPenaltyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const monthly = useMemo(() => {
    const buckets = new Map<string, { label: string; count: number; amount: number; excused: number; late: number }>();
    for (const row of penaltyRows) {
      const key = row.date.slice(0, 7);
      const label = key;
      if (!buckets.has(key)) buckets.set(key, { label, count: 0, amount: 0, excused: 0, late: 0 });
      const b = buckets.get(key)!;
      b.count += 1;
      b.late += Number(row.late_minutes || 0);
      if (row.is_excused) b.excused += 1; else b.amount += Number(row.penalty_amount || 0);
    }
    return Array.from(buckets.values()).sort((a, b) => b.label.localeCompare(a.label));
  }, [penaltyRows]);

  const perEmployee = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number; amount: number; excused: number }>();
    for (const row of penaltyRows) {
      const id = Number(row.employee_id);
      if (!map.has(id)) map.set(id, { id, name: row.employee_name || "—", count: 0, amount: 0, excused: 0 });
      const e = map.get(id)!;
      e.count += 1;
      if (row.is_excused) e.excused += 1; else e.amount += Number(row.penalty_amount || 0);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [penaltyRows]);

  const totalPenaltyAmount = useMemo(
    () => penaltyRows.reduce((a, r) => a + (r.is_excused ? 0 : Number(r.penalty_amount || 0)), 0),
    [penaltyRows],
  );

  return (
    <div className="space-y-4" id="attendance-panel-archive" role="tabpanel" aria-labelledby="attendance-tab-archive">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-main">
            <History size={18} className="text-primary" /> {t("attendance.archiveTitle")}
          </h3>
          <p className="mt-1 text-xs font-medium text-muted">{t("attendance.archiveHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder={t("attendance.searchArchive")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 rounded-xl ps-9 text-sm"
            />
          </div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 w-auto rounded-xl" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 w-auto rounded-xl" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("attendance.colEmployee")}</TableHead>
              <TableHead className="text-start">{t("attendance.colOperation")}</TableHead>
              <TableHead className="text-start">{t("attendance.colDateTime")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {archiveRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-14 text-center">
                  <p className="text-sm font-black text-main">{t("attendance.noArchive")}</p>
                  <p className="mt-1 text-xs font-medium text-muted">{t("attendance.noArchiveHint")}</p>
                </TableCell>
              </TableRow>
            ) : (
              archiveRecords.map((r, idx) => (
                <TableRow key={`${String(r.employee_id ?? r.id)}-${String(r.created_at)}-${idx}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar name={r.employee_name || r.full_name || "—"} size="xs" shape="circle" />
                      <span className="font-bold text-main">{r.employee_name || r.full_name || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black",
                        r.status === "in"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                          : r.status === "out"
                            ? "border-slate-500/20 bg-slate-500/10 text-slate-700"
                            : r.status === "break"
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                              : "border-sky-500/20 bg-sky-500/10 text-sky-700",
                      )}
                    >
                      {statusLabel(r.status, t)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-muted tabular-nums">
                    {formatDateTime(r.created_at, locale, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-muted">
            {t("attendance.showingRange", { from, to, total })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronRight size={16} className="rtl:rotate-180" />
            </Button>
            <span className="min-w-[72px] text-center text-xs font-bold text-main tabular-nums">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronLeft size={16} className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>

      {/* الجزاءات المؤرشفة — نفس السجل التاريخي، مفصولة بل — مجموع للقراءة فقط */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-black text-main">
            <Receipt size={16} className="text-primary" /> {t("attendance.archivePenaltiesTitle")}
          </h4>
          <p className="text-[11px] font-semibold text-muted">
            {penaltyLoading
              ? t("attendance.fileLoading")
              : t("attendance.archivePenaltiesTotal", {
                  amount: formatEmployeeMoney(totalPenaltyAmount, locale, language),
                  count: penaltyRows.length,
                })}
          </p>
        </div>

        {monthly.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] font-black uppercase tracking-wide text-muted">
                  <th className="px-2 py-1.5 text-start">{t("attendance.rollupMonth")}</th>
                  <th className="px-2 py-1.5 text-start">{t("attendance.kpiPenaltyCount")}</th>
                  <th className="px-2 py-1.5 text-start">{t("attendance.lateMinutes")}</th>
                  <th className="px-2 py-1.5 text-start">{t("attendance.penaltyAmount")}</th>
                  <th className="px-2 py-1.5 text-start">{t("attendance.rollupWaived")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthly.map((m) => (
                  <tr key={m.label}>
                    <td className="px-2 py-1.5 font-mono font-black text-main">{m.label}</td>
                    <td className="px-2 py-1.5 tabular-nums">{m.count}</td>
                    <td className="px-2 py-1.5 tabular-nums text-muted">{m.late}</td>
                    <td className="px-2 py-1.5 font-semibold tabular-nums text-danger">{formatEmployeeMoney(m.amount, locale, language)}</td>
                    <td className="px-2 py-1.5 tabular-nums text-muted">
                      {m.excused > 0 ? <span className="text-success">{m.excused}</span> : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !penaltyLoading && (
            <p className="py-4 text-center text-[11px] font-semibold text-muted">{t("attendance.archivePenaltiesEmpty")}</p>
          )
        )}

        {perEmployee.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-muted/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted">
              {t("attendance.archivePenaltiesByEmployee")}
            </div>
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2">
              {perEmployee.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <EmployeeAvatar name={e.name} size="xs" shape="circle" />
                    <span className="truncate text-[11px] font-bold text-main">{e.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 tabular-nums text-[10px]">
                    <span className="text-muted">{e.count} ×</span>
                    <span className="font-black text-danger">{formatEmployeeMoney(e.amount, locale, language)}</span>
                    {e.excused > 0 && <span className="text-success">+{e.excused}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
