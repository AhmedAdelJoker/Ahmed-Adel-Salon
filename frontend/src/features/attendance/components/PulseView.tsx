import AttendanceDashboardView from "./AttendanceDashboardView";
import type { AttendanceRecord } from "@/features/attendance/types";
import type { TranslateFn } from "@/features/attendance/utils/attendance";

// Compatibility wrapper: "today" view supersedes pulse. Kept for barrel/API stability.
export default function PulseView({
  todayRecords,
  t,
  locale,
  onOpenEmployeeFile,
}: {
  todayRecords: AttendanceRecord[];
  lateEmployees?: AttendanceRecord[];
  employees?: unknown[];
  t?: TranslateFn;
  locale?: string;
  onOpenEmployeeFile?: (id: string | number) => void;
}) {
  const noop = (k: string) => k;
  return (
    <AttendanceDashboardView
      todayRecords={todayRecords}
      t={t || (noop as TranslateFn)}
      locale={locale || "ar-EG"}
      onOpenEmployeeFile={onOpenEmployeeFile}
    />
  );
}
