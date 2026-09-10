/**
 * Attendance feature domain types.
 * Mirrors the conventions of `@/features/bookings/types`.
 */
import type {
  AttendanceNotification,
  AttendanceRecord,
  AttendanceSettingsForm,
  LeaveRecord,
  WorkingHours,
} from "@/types/attendance";
import type { EmployeeRecord } from "@/types/employee";

export type {
  AttendanceNotification,
  AttendanceRecord,
  AttendanceSettingsForm,
  LeaveRecord,
  WorkingHours,
  EmployeeRecord,
};

export type AttendanceViewMode =
  | "dashboard"
  | "pulse"
  | "monthly"
  | "leaves"
  | "calendar"
  | "archive";

export interface CalendarDay {
  day: number;
  date: string;
  dayOfWeek: string;
  isToday: boolean;
  workingHours:
    | { open_time?: string; close_time?: string; is_open?: boolean }
    | undefined;
  records: AttendanceRecord[];
  presentCount: number;
  lateCount: number;
}

export interface LeaveFormState {
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export const emptyLeaveForm: LeaveFormState = {
  employee_id: "",
  type: "vacation",
  start_date: "",
  end_date: "",
  reason: "",
};
