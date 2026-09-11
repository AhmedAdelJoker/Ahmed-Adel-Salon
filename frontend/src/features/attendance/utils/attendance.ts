import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

/**
 * Pure attendance helpers — moved verbatim from
 * `src/pages/manager/AttendanceManagement.tsx` (no behavior changes).
 */

export const statusLabels: Record<string, string> = {
  in: "حضور",
  break: "استراحة",
  break_end: "عودة",
  out: "انصراف",
};

export const statusColors: Record<
  string,
  "success" | "warning" | "info" | "danger" | "secondary"
> = {
  in: "success",
  break: "warning",
  break_end: "info",
  out: "danger",
};

export const ATTENDANCE_VIEW_MODES: {
  id: AttendanceViewMode;
  label: string;
}[] = [
  { id: "dashboard", label: "لوحة التحكم" },
  { id: "pulse", label: "نبض اليوم" },
  { id: "monthly", label: "التحليلات" },
  { id: "leaves", label: "الإجازات" },
  { id: "calendar", label: "التقويم" },
  { id: "archive", label: "الأرشيف" },
];

export const WEEKLY_ATTENDANCE = [
  { name: "الأحد", حضور: 5, تأخير: 1 },
  { name: "الإثنين", حضور: 4, تأخير: 2 },
  { name: "الثلاثاء", حضور: 6, تأخير: 0 },
  { name: "الأربعاء", حضور: 5, تأخير: 1 },
  { name: "الخميس", حضور: 4, تأخير: 3 },
  { name: "الجمعة", حضور: 3, تأخير: 0 },
  { name: "السبت", حضور: 2, تأخير: 1 },
];

export const MONTHLY_TREND = [
  { week: "الأسبوع 1", حضور: 85 },
  { week: "الأسبوع 2", حضور: 78 },
  { week: "الأسبوع 3", حضور: 92 },
  { week: "الأسبوع 4", حضور: 88 },
];

export const CALENDAR_WEEKDAY_NAMES = [
  "أحد",
  "إثنين",
  "ثلاثاء",
  "أربعاء",
  "خميس",
  "جمعة",
  "سبت",
];

export function todayKey(d = new Date()): string {
  return d.toISOString().split("T")[0];
}

export function deriveTodayRecords(
  records: AttendanceRecord[],
  employees: EmployeeRecord[],
): AttendanceRecord[] {
  const todayStr = todayKey();
  const todayLogs = records.filter((r) => r.created_at?.startsWith(todayStr));
  const grouped: Record<string, AttendanceRecord[]> = {};
  todayLogs.forEach((rec) => {
    const id = rec.employee_id as string;
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(rec);
  });
  return Object.keys(grouped).map((empId) => {
    const empRecords = grouped[empId];
    const employee =
      employees.find((e) => String(e.id) === String(empId)) ||
      ({ full_name: empRecords[0].employee_name } as EmployeeRecord);
    void employee;
    const stats = calculateAdvancedHours(empRecords as any);
    const ai = analyzeProductivity(stats as any);
    return {
      ...empRecords[0],
      id: empId,
      stats,
      ai,
      all_logs: empRecords,
    } as AttendanceRecord;
  });
}

export function deriveMonthlyData(
  records: AttendanceRecord[],
  employees: EmployeeRecord[],
): AttendanceRecord[] {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthLogs = records.filter((r) =>
    r.created_at?.startsWith(currentMonth),
  );
  const grouped: Record<string, AttendanceRecord[]> = {};
  monthLogs.forEach((rec) => {
    const id = rec.employee_id as string;
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(rec);
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
      stats,
      payroll,
      ai,
      all_logs: empRecords,
      full_name: (employee as EmployeeRecord).full_name,
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
  return records.filter((r) => {
    const recDate = r.created_at?.split("T")[0] ?? "";
    const matchesDate = recDate >= opts.startDate && recDate <= opts.endDate;
    const matchesSearch = (r.employee_name || "")
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
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    const dateStr = date.toISOString().split("T")[0];
    const dayRecords = records.filter((r) =>
      r.created_at?.startsWith(dateStr),
    );
    days.push({
      day: i,
      date: dateStr,
      dayOfWeek: date
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase(),
      isToday: dateStr === todayKey(),
      workingHours:
        workingHours[
          date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
        ],
      records: dayRecords,
      presentCount: dayRecords.filter((r) => r.status === "in").length,
      lateCount: dayRecords.filter((r) => (r.stats?.lateMinutes ?? 0) > 0)
        .length,
    });
  }
  return days;
}

export function exportAttendancePDF(opts: {
  activeViewMode: AttendanceViewMode;
  todayRecords: AttendanceRecord[];
  processedData: AttendanceRecord[];
  archiveRecords: AttendanceRecord[];
}): void {
  const { activeViewMode, todayRecords, processedData, archiveRecords } = opts;
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.text("Barber Luxe OS - Attendance Report", 14, 20);
  let dataToExport: AttendanceRecord[] = [];
  if (activeViewMode === "dashboard") dataToExport = todayRecords;
  else if (activeViewMode === "monthly") dataToExport = processedData;
  else dataToExport = archiveRecords;
  const tableData = dataToExport.map((r) => [
    r.employee_name || (r.full_name as string) || "Unknown",
    r.status || (r.stats ? "Aggregated" : "N/A"),
    r.created_at
      ? new Date(r.created_at).toLocaleString("ar-EG")
      : "Report Data",
  ]);
  autoTable(doc, {
    startY: 30,
    head: [["Employee", "Status", "Timestamp"]],
    body: tableData,
  });
  doc.save(
    `attendance_${activeViewMode}_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
  toast.success("تم تحميل تقرير PDF");
}
