import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
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
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

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
    </div>
  );
}
