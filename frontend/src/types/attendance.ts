/**
 * Attendance domain types (moved from pages/manager/AttendanceManagement.tsx).
 */
export interface AttendanceRecord {
  id?: number | string;
  employee_id?: number | string;
  employee_name?: string;
  full_name?: string;
  barber_name?: string;
  status?: string;
  created_at?: string;
  stats?: {
    totalHours: number | string;
    lateMinutes: number;
    overtime: number | string;
    breakMinutes: number;
    hasMissingCheckout?: boolean;
  };
  isComplete?: boolean;
  is_late?: boolean;
  late_reason?: string;
  all_logs?: unknown[];
  ai?: {
    score: number;
    label: string;
    color: string;
  };
  payroll?: Record<string, any>;
  [key: string]: unknown;
}

export interface LeaveRecord {
  id?: number | string;
  employee_id?: number | string;
  employee_name?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  status?: string;
  [key: string]: unknown;
}

export interface WorkingHours {
  [key: string]: { open_time?: string; close_time?: string; is_open?: boolean };
}

export interface AttendanceNotification {
  id?: number | string;
  message?: string;
  [key: string]: unknown;
}

export interface AttendanceSettingsForm {
  open_time: string;
  close_time: string;
  late_threshold: number;
}

/**
 * Working-hours day config (moved from pages/owner/WorkingHoursPanel.tsx).
 */
export interface DayConfig {
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}
