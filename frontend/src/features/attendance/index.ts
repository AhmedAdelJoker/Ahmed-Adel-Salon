/**
 * Attendance feature barrel — mirrors `@/features/bookings/index.ts` conventions.
 * Re-exports domain types, utils, hooks and the extracted EmployeeCard sub-feature.
 */
export * from "@/features/attendance/types";
export * from "@/features/attendance/utils/attendance";
export * from "@/features/attendance/components/EmployeeCard/constants";
export { default as EmployeeCard } from "@/features/attendance/components/EmployeeCard/EmployeeCard";
export { EmployeeCardHeader } from "@/features/attendance/components/EmployeeCard/EmployeeCardHeader";
export { EmployeeCardStats } from "@/features/attendance/components/EmployeeCard/EmployeeCardStats";
export { EmployeeCardDetailsDialog } from "@/features/attendance/components/EmployeeCard/EmployeeCardDetailsDialog";
export { useAttendanceData } from "@/features/attendance/hooks/useAttendanceData";
export { useAttendanceOps } from "@/features/attendance/hooks/useAttendanceOps";
export { default as DailySummary } from "@/features/attendance/components/DailySummary/DailySummary";
export { statusConfig as dailySummaryStatusConfig, aiConfig as dailySummaryAiConfig } from "@/features/attendance/components/DailySummary/constants";
export { formatTime, formatDateTime } from "@/features/attendance/components/DailySummary/utils";
