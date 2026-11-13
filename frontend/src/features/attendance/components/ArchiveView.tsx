import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  History,
  Package,
  Printer,
  Receipt,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { PageHeader, StatCard, PremiumCard } from "@/components/shared/PremiumUI";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import {
  formatDateTime,
  statusLabel,
  type TranslateFn,
} from "@/features/attendance/utils/attendance";
import type { AttendanceRecord } from "@/features/attendance/types";
import { formatEmployeeMoney } from "@/features/hr/utils/helpers";
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
  const [tab, setTab] = useState<"records" | "penalties">("records");

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
      if (!buckets.has(key)) buckets.set(key, { label: key, count: 0, amount: 0, excused: 0, late: 0 });
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
  const waivedCount = useMemo(
    () => penaltyRows.filter((r) => r.is_excused).length,
    [penaltyRows],
  );
  const archivedMonths = useMemo(
    () => new Set(penaltyRows.map((r) => r.date.slice(0, 7))).size,
    [penaltyRows],
  );

  const handleExportCsv = () => {
    const escapeCell = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: string[] = [];
    rows.push(
      [t("attendance.colEmployee"), t("attendance.colOperation"), t("attendance.colDateTime")]
        .map(escapeCell)
        .join(","),
    );
    for (const r of archiveRecords) {
      rows.push(
        [
          r.employee_name || r.full_name || "",
          statusLabel(r.status, t),
          formatDateTime(r.created_at, locale, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
        ]
          .map(escapeCell)
          .join(","),
      );
    }
    rows.push("");
    rows.push([t("attendance.rollupMonth"), t("attendance.kpiPenaltyCount"), t("attendance.lateMinutes"), t("attendance.penaltyAmount"), t("attendance.rollupWaived")].map(escapeCell).join(","));
    for (const m of monthly) {
      rows.push([m.label, m.count, m.late, m.amount.toFixed(2), m.excused].map(escapeCell).join(","));
    }
    const csv = "﻿" + rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_archive_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("attendance.pdfSuccess"));
  };

  const handleExportPdf = (): void => {
    const escapeHtml = (v: unknown) =>
      String(v ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const title = t("attendance.archiveHero");
    const direction = locale.startsWith("ar") ? "rtl" : "ltr";
    const rowsHtml = archiveRecords
      .map(
        (r) => `<tr><td>${escapeHtml(r.employee_name || r.full_name)}</td><td>${escapeHtml(statusLabel(r.status, t))}</td><td>${escapeHtml(
          formatDateTime(r.created_at, locale, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
        )}</td></tr>`,
      )
      .join("");
    const penaltyHtml = monthly
      .map(
        (m) => `<tr><td>${m.label}</td><td>${m.count}</td><td>${m.late}</td><td>${m.amount.toFixed(2)}</td><td>${m.excused}</td></tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html lang="${locale.startsWith("ar") ? "ar" : "en"}" dir="${direction}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{margin:14mm}body{font-family:"Cairo","Segoe UI",Tahoma,Arial,sans-serif;color:#111827;padding:24px}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;color:#6b7280;margin:18px 0 8px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:start}th{background:#f3f4f6}tbody tr:nth-child(even){background:#fafafa}.meta{color:#6b7280;font-size:11px;margin-bottom:16px}@media print{body{padding:0}}</style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">${escapeHtml(
      new Date().toLocaleString(locale),
    )}</div><table><thead><tr><th>${escapeHtml(t("attendance.colEmployee"))}</th><th>${escapeHtml(t("attendance.colOperation"))}</th><th>${escapeHtml(t("attendance.colDateTime"))}</th></tr></thead><tbody>${rowsHtml}</tbody></table><h2>${escapeHtml(t("attendance.archiveMonthlyBreakdown"))}</h2><table><thead><tr><th>${escapeHtml(t("attendance.rollupMonth"))}</th><th>${escapeHtml(t("attendance.kpiPenaltyCount"))}</th><th>${escapeHtml(t("attendance.lateMinutes"))}</th><th>${escapeHtml(t("attendance.penaltyAmount"))}</th><th>${escapeHtml(t("attendance.rollupWaived"))}</th></tr></thead><tbody>${penaltyHtml}</tbody></table></body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    try {
      const d = iframe.contentWindow?.document;
      if (!d) throw new Error();
      d.open();
      d.write(html);
      d.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      toast.success(t("attendance.pdfSuccess"));
      window.setTimeout(() => iframe.remove(), 2000);
    } catch {
      iframe.remove();
      toast.error(t("attendance.exportPdfFailed"));
    }
  };

  return (
    <div className="space-y-5" id="attendance-panel-archive" role="tabpanel" aria-labelledby="attendance-tab-archive">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("attendance.archiveStatsRecords")} value={total} icon={Package} variant="primary" />
        <StatCard label={t("attendance.archiveStatsMonths")} value={archivedMonths} icon={CalendarRange} variant="info" />
        <StatCard label={t("attendance.archiveStatsPenaltyAmount")} value={formatEmployeeMoney(totalPenaltyAmount, locale, language)} icon={Wallet} variant="danger" />
        <StatCard label={t("attendance.archiveStatsWaived")} value={waivedCount} icon={Users} variant="success" />
      </div>

      <PageHeader
        title={t("attendance.archiveHero")}
        subtitle={t("attendance.archiveHeroSub")}
        icon={History}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl" onClick={handleExportCsv}>
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">{t("attendance.archiveExportCsv")}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl" onClick={handleExportPdf}>
              <Printer size={16} />
              <span className="hidden sm:inline">{t("attendance.archiveExportPdf")}</span>
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/70 p-1.5 shadow-sm" role="tablist" aria-label={t("attendance.archiveTitle")}>
        {([
          { id: "records" as const, label: t("attendance.archiveTabRecords"), icon: History },
          { id: "penalties" as const, label: t("attendance.archiveTabPenalties"), icon: Receipt },
        ]).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex min-w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-muted/40 hover:text-main",
              )}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.id === "records" && <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-black tabular-nums">{total}</span>}
              {item.id === "penalties" && <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-black tabular-nums">{penaltyRows.length}</span>}
            </button>
          );
        })}
      </div>

      {tab === "records" && (
        <PremiumCard className="overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted">{t("attendance.archivePunchCardTitle")}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px]">
                <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("attendance.searchArchive")}
                  className="h-9 rounded-xl ps-9 text-sm"
                />
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm("")} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-main" aria-label={t("attendance.cancel")}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-auto rounded-xl text-sm" aria-label={t("attendance.from")} />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-auto rounded-xl text-sm" aria-label={t("attendance.to")} />
            </div>
          </div>
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
                    <Archive size={28} className="mx-auto text-muted" />
                    <p className="mt-3 text-sm font-black text-main">{t("attendance.noArchive")}</p>
                    <p className="mt-1 text-xs text-muted">{t("attendance.noArchiveHint")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                archiveRecords.map((r, idx) => (
                  <TableRow key={`${String(r.employee_id ?? r.id)}-${String(r.created_at)}-${idx}`} className="transition-colors hover:bg-muted/20">
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
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : r.status === "out"
                              ? "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300"
                              : r.status === "break"
                                ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400",
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
        </PremiumCard>
      )}

      {tab === "penalties" && (
        <PremiumCard className="rounded-2xl border border-border bg-card p-0 shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted">{t("attendance.archiveMonthlyBreakdown")}</h3>
          </div>
          {penaltyLoading ? (
            <div className="flex items-center justify-center py-14">
              <div className="h-6 w-6 animate-pulse rounded-full bg-primary/20" />
            </div>
          ) : monthly.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <Receipt size={28} className="mx-auto text-muted" />
              <p className="mt-3 text-sm font-black text-main">{t("attendance.archiveNoPenalties")}</p>
              <p className="mt-1 text-xs text-muted">{t("attendance.archiveNoPenaltiesHint")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {monthly.map((m) => {
                const tone = m.amount === 0 ? "border-emerald-500/20 bg-emerald-500/5"
                  : m.excused > 0 ? "border-amber-500/20 bg-amber-500/5"
                  : "border-danger/15 bg-danger-soft";
                return (
                  <div key={m.label} className={cn("rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 hover:shadow-premium", tone)}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm font-black text-main">{m.label}</p>
                      <span className="rounded-full border border-white/20 bg-card/80 px-2 py-0.5 text-[10px] font-black text-muted tabular-nums">{m.count}</span>
                    </div>
                    <p className="mt-2 text-2xl font-black tabular-nums text-main">{formatEmployeeMoney(m.amount, locale, language)}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-muted tabular-nums">
                      <span>{m.late} {t("attendance.minutesUnit")}</span>
                      <span>{m.excused} {t("attendance.rollupWaived")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {perEmployee.length > 0 && !penaltyLoading && (
            <div className="border-t border-border px-4 py-3">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted">{t("attendance.archiveByEmployee")}</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {perEmployee.map((e, idx) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/5 px-3 py-2 transition-colors hover:bg-muted/10">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 text-center text-[10px] font-black tabular-nums text-muted">#{idx + 1}</span>
                      <EmployeeAvatar name={e.name} size="xs" shape="circle" />
                      <span className="truncate text-[11px] font-bold text-main">{e.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[10px] tabular-nums">
                      <span className="font-semibold text-muted">{e.count}×</span>
                      <span className="font-black text-danger">{formatEmployeeMoney(e.amount, locale, language)}</span>
                      {e.excused > 0 && <span className="font-black text-success">+{e.excused}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PremiumCard>
      )}
    </div>
  );
}
