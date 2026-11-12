import { toast } from "react-hot-toast";
import {
  analyzeProductivity,
  calculateAdvancedHours,
  calculatePayroll,
} from "@/lib/domain/attendance";
import type {
  AttendanceRecord,
  AttendanceViewMode,
  CalendarDay,
  EmployeeRecord,
  WorkingHours,
} from "@/features/attendance/types";

export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export const ATTENDANCE_VIEW_MODES: Array<{
  id: AttendanceViewMode;
  labelKey: string;
}> = [
  { id: "today", labelKey: "attendance.tabToday" },
  { id: "register", labelKey: "attendance.tabRegister" },
  { id: "leaves", labelKey: "attendance.tabLeaves" },
  { id: "calendar", labelKey: "attendance.tabCalendar" },
  { id: "analytics", labelKey: "attendance.tabAnalytics" },
  { id: "penalties", labelKey: "attendance.tabPenalties" },
  { id: "archive", labelKey: "attendance.tabArchive" },
];

export function statusLabel(
  status: string | undefined | null,
  t: TranslateFn,
): string {
  switch (status) {
    case "in":
      return t("attendance.statusIn");
    case "out":
      return t("attendance.statusOut");
    case "break":
      return t("attendance.statusBreak");
    case "break_end":
      return t("attendance.statusBreakEnd");
    default:
      return status ? String(status) : t("attendance.statusUnknown");
  }
}

export function statusTone(
  status: string | undefined | null,
): "success" | "warning" | "info" | "danger" | "secondary" {
  switch (status) {
    case "in":
      return "success";
    case "break":
      return "warning";
    case "break_end":
      return "info";
    case "out":
      return "danger";
    default:
      return "secondary";
  }
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, options);
}

export function formatTime(
  value: string | Date | null | undefined,
  locale: string,
): string {
  return formatDateTime(value, locale, { hour: "2-digit", minute: "2-digit" });
}

export function normalizeCurrentRecords(
  data: any[],
  employees: EmployeeRecord[],
): AttendanceRecord[] {
  const byId = new Map(employees.map((e) => [String(e.id), e]));
  return (Array.isArray(data) ? data : []).map((record) => {
    const empId = record.employee_id ?? record.id;
    const employee = byId.get(String(empId));
    const stats = record.last_log?.stats ||
      record.stats || {
        totalHours: 0,
        lateMinutes: 0,
        overtime: 0,
        breakMinutes: 0,
      };
    return {
      ...record,
      id: empId,
      employee_id: empId,
      employee_name:
        record.employee_name ||
        employee?.full_name ||
        employee?.display_name ||
        "—",
      full_name:
        record.employee_name ||
        employee?.full_name ||
        employee?.display_name ||
        "—",
      status: record.current_status ?? record.status,
      created_at: record.last_log?.created_at ?? record.created_at,
      stats,
      isComplete:
        (record.current_status ?? record.status) === "out" ||
        Boolean(record.isComplete),
      is_late: Boolean(record.is_late ?? (Number(stats.lateMinutes) > 0)),
      late_reason: record.late_reason ?? record.last_log?.late_reason ?? null,
      all_logs: record.logs_today ?? record.all_logs ?? [],
    } as AttendanceRecord;
  });
}

export function deriveTodayRecords(
  records: AttendanceRecord[],
  _employees: EmployeeRecord[],
): AttendanceRecord[] {
  // `records` are expected to be normalized `/barber-presence/current` rows.
  return Array.isArray(records) ? records : [];
}

/**
 * Real shift bounds from the salon's working-hours settings.
 * The monthly analytics used to hardcode a 10:00–18:00 shift while the salon
 * actually opens 09:00–03:00, so "late minutes" and overtime never matched the
 * backend. Falls back to the old constants only when no day is configured.
 */
export function effectiveShift(workingHours?: WorkingHours): {
  start: string;
  end: string;
} {
  const days = Object.values(workingHours || {});
  const openDay = days.find(
    (d) => d?.is_open && d.open_time && d.close_time,
  );
  if (openDay?.open_time && openDay?.close_time) {
    return { start: openDay.open_time, end: openDay.close_time };
  }
  return { start: "10:00", end: "18:00" };
}

export function deriveMonthlyData(
  records: AttendanceRecord[],
  employees: EmployeeRecord[],
  opts?: {
    shift?: { start: string; end: string };
    penaltyPerMinute?: number;
  },
): AttendanceRecord[] {
  const logs = Array.isArray(records) ? records : [];
  const grouped: Record<string, AttendanceRecord[]> = {};
  logs.forEach((rec) => {
    const all = Array.isArray(rec.all_logs) && rec.all_logs.length > 0 ? rec.all_logs : [rec];
    all.forEach((log: any) => {
      const id = String(log.employee_id ?? rec.employee_id ?? rec.id ?? "");
      if (!id) return;
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push({ ...log, employee_id: id, employee_name: rec.employee_name || rec.full_name });
    });
  });
  return Object.keys(grouped).map((empId) => {
    const empRecords = grouped[empId];
    const employee =
      employees.find((e) => String(e.id) === String(empId)) ||
      ({ full_name: empRecords[0].employee_name } as EmployeeRecord);
    const stats = calculateAdvancedHours(empRecords as any, opts?.shift);
    const payroll = calculatePayroll(employee as any, stats as any, undefined, {
      latePerMinute: opts?.penaltyPerMinute,
    });
    const ai = analyzeProductivity(stats as any);
    return {
      ...empRecords[0],
      id: empId,
      employee_id: empId,
      stats,
      payroll,
      ai,
      all_logs: empRecords,
      full_name: (employee as EmployeeRecord).full_name || empRecords[0].employee_name,
      employee_name: (employee as EmployeeRecord).full_name || empRecords[0].employee_name,
    } as unknown as AttendanceRecord;
  });
}

export function filterArchiveRecords(
  records: AttendanceRecord[],
  opts: {
    startDate: string;
    endDate: string;
    searchTerm: string;
    employeeIdFilter: string | null;
  },
): AttendanceRecord[] {
  const source = Array.isArray(records) ? records : [];
  const flat: AttendanceRecord[] = [];
  source.forEach((rec) => {
    const logs = Array.isArray(rec.all_logs) && rec.all_logs.length > 0 ? rec.all_logs : [rec];
    logs.forEach((log: any) => {
      flat.push({
        ...rec,
        ...log,
        employee_id: log.employee_id ?? rec.employee_id,
        employee_name: rec.employee_name || rec.full_name || log.employee_name,
        status: log.status ?? rec.status,
        created_at: log.created_at ?? rec.created_at,
      } as AttendanceRecord);
    });
  });
  return flat.filter((r) => {
    const recDate = String(r.created_at ?? "").split("T")[0] ?? "";
    const matchesDate =
      (!opts.startDate || recDate >= opts.startDate) &&
      (!opts.endDate || recDate <= opts.endDate);
    const matchesSearch = String(r.employee_name || "")
      .toLowerCase()
      .includes(opts.searchTerm.toLowerCase());
    const matchesEmployee = opts.employeeIdFilter
      ? String(r.employee_id) === String(opts.employeeIdFilter)
      : true;
    return matchesDate && matchesSearch && matchesEmployee;
  });
}

export function buildCalendarDays(
  records: AttendanceRecord[],
  calendarMonth: Date,
  workingHours: WorkingHours,
): (CalendarDay | null)[] {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDay = firstDay.getDay();
  const days: (CalendarDay | null)[] = [];
  const flat: AttendanceRecord[] = [];
  (records || []).forEach((rec) => {
    const logs = Array.isArray(rec.all_logs) && rec.all_logs.length > 0 ? rec.all_logs : [rec];
    logs.forEach((log: any) => flat.push({ ...rec, ...log, created_at: log.created_at ?? rec.created_at }));
  });
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    const dateStr = todayKey(date);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const dayRecords = flat.filter((r) => String(r.created_at ?? "").startsWith(dateStr));
    const lateCount = dayRecords.filter(
      (r) => Boolean(r.is_late) || Number(r?.stats?.lateMinutes) > 0 || Number((r as any).late_minutes) > 0,
    ).length;
    const presentCount = new Set(
      dayRecords
        .filter((r) => ["in", "out", "break", "break_end"].includes(String(r.status)))
        .map((r) => String(r.employee_id)),
    ).size;
    days.push({
      day: i,
      date: dateStr,
      dayOfWeek,
      isToday: dateStr === todayKey(),
      workingHours: workingHours?.[dayOfWeek],
      records: dayRecords,
      presentCount,
      lateCount,
    });
  }
  return days;
}

export async function exportAttendancePDF(opts: {
  activeViewMode: AttendanceViewMode;
  rows: AttendanceRecord[];
  locale: string;
  t: TranslateFn;
}): Promise<void> {
  const { rows, locale, t } = opts;

  // jsPDF + helvetica cannot render Arabic — the glyphs left WinAnsi encoding
  // and came out as garbage. A printable RTL HTML document sidesteps font
  // embedding entirely: the browser shapes Arabic natively, and the print
  // dialog saves a real PDF with selectable text.
  const escapeHtml = (value: unknown) =>
    String(value ?? "—")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const title = `${t("attendance.title")} — ${t("attendance.exportPdf")}`;
  const generated = new Date().toLocaleString(locale);
  const tableRows = (rows || [])
    .map((r) =>
      [
        escapeHtml(r.employee_name || (r.full_name as string)),
        escapeHtml(statusLabel(r.status, t)),
        escapeHtml(
          formatDateTime(r.created_at, locale, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        ),
      ].map((cell) => `<td>${cell}</td>`).join(""),
    )
    .map((cells) => `<tr>${cells}</tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${locale.startsWith("ar") ? "ar" : "en"}" dir="${locale.startsWith("ar") ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Cairo", "Noto Kufi Arabic", "Segoe UI", Tahoma, Arial, sans-serif;
    color: #111827; margin: 0; padding: 24px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 7px 9px; text-align: start; }
  th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody tr { break-inside: avoid; }
  .empty { color: #6b7280; text-align: center; padding: 32px 0; font-size: 13px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(generated)} · ${(rows || []).length} ${escapeHtml(t("attendance.colOperation"))}</div>
  ${
    tableRows
      ? `<table><thead><tr><th>${escapeHtml(t("attendance.colEmployee"))}</th><th>${escapeHtml(t("attendance.colOperation"))}</th><th>${escapeHtml(t("attendance.colDateTime"))}</th></tr></thead><tbody>${tableRows}</tbody></table>`
      : `<p class="empty">${escapeHtml(t("attendance.noDataToday"))}</p>`
  }
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,width=900,height=700");
  if (!win) {
    toast.error(t("attendance.exportPdfFailed"));
    return;
  }
  win.document.write(html);
  win.document.close();
  toast.success(t("attendance.pdfSuccess"));
}
