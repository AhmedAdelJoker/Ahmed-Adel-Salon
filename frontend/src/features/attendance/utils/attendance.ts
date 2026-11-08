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
import { getIntlLocale } from "@/lib/format/locale";

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

export function deriveMonthlyData(
  records: AttendanceRecord[],
  employees: EmployeeRecord[],
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
    const stats = calculateAdvancedHours(empRecords as any);
    const payroll = calculatePayroll(employee as any, stats as any);
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
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.text(`${t("attendance.title")} — ${t("attendance.exportPdf")}`, 14, 18);
  const tableData = (rows || []).map((r) => [
    String(r.employee_name || (r.full_name as string) || "—"),
    statusLabel(r.status, t),
    formatDateTime(r.created_at, locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  ]);
  autoTable(doc, {
    startY: 26,
    head: [[t("attendance.colEmployee"), t("attendance.colOperation"), t("attendance.colDateTime")]],
    body: tableData,
    styles: { fontSize: 9 },
  });
  doc.save(`attendance_${todayKey()}.pdf`);
  toast.success(t("attendance.pdfSuccess"));
}
