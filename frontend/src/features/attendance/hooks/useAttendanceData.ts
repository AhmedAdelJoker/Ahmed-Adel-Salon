import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { loadErrorMessage } from "@/lib/core/asyncError";
import type {
  AttendanceRecord,
  EmployeeRecord,
  WorkingHours,
} from "@/features/attendance/types";
import {
  deriveMonthlyData,
  deriveTodayRecords,
  filterArchiveRecords,
} from "@/features/attendance/utils/attendance";

/**
 * Attendance listing data: fetches, filters and derived lists.
 * Mirrors `useBookingsBoard` / `useInventoryData` conventions.
 */
export function useAttendanceData() {
  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get("employeeId");

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [workingHours, setWorkingHours] = useState<WorkingHours>({});
  // Non-fatal: the records themselves load fine, but the schedule that decides
  // who counts as late did not, so the totals need a caveat.
  const [secondaryError, setSecondaryError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/barber-presence/current");
      const data = res.data || [];
      setRecords(
        data.map((record: any) => ({
          id: record.employee_id,
          employee_id: record.employee_id,
          employee_name:
            record.employee_name ||
            record.employee?.full_name ||
            "موظف غير معروف",
          status: record.current_status,
          created_at: record.last_log?.created_at,
          stats: record.last_log?.stats || {
            totalHours: 0,
            lateMinutes: 0,
            overtime: 0,
            breakMinutes: 0,
          },
          isComplete: record.current_status === "out",
          is_late: record.is_late,
          late_reason: record.late_reason,
          all_logs: record.logs_today || [],
        })),
      );
    } catch (err) {
      console.error("Attendance fetch error:", err);
      toast.error("فشل تحميل سجلات الحضور");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get("/employees");
      setEmployees(
        adaptList(res).map((emp: any) => ({
          ...emp,
          full_name: emp.full_name || emp.display_name || emp.name || "موظف",
        })),
      );
    } catch (err) {
      // Without the roster the view cannot attribute records to anyone, so the
      // numbers on screen would be unattributable rather than merely incomplete.
      console.error("Failed to fetch employees", err);
      setSecondaryError(
        loadErrorMessage(err, "قائمة الموظفين") +
          " قد تظهر سجلات الحضور بدون أسماء.",
      );
    }
  }, []);
  const fetchWorkingHours = useCallback(async () => {
    try {
      const res = await api.get("/barber-presence/working-hours");
      setWorkingHours(res.data?.working_hours || {});
    } catch (err) {
      // Working hours decide which staff are counted late. Failing open to an
      // empty schedule silently marks everyone on time.
      console.error("Failed to fetch working hours:", err);
      setSecondaryError(
        loadErrorMessage(err, "ساعات العمل") +
          " قد تظهر نتائج الحضور غير دقيقة.",
      );
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
    fetchEmployees();
    fetchWorkingHours();
  }, [fetchAttendance, fetchEmployees, fetchWorkingHours]);

  const todayRecords = useMemo(
    () => deriveTodayRecords(records, employees),
    [records, employees],
  );

  const processedData = useMemo(
    () => deriveMonthlyData(records, employees),
    [records, employees],
  );

  const archiveRecords = useMemo(
    () =>
      filterArchiveRecords(records, {
        startDate,
        endDate,
        searchTerm,
        employeeIdFilter,
      }),
    [records, searchTerm, employeeIdFilter, startDate, endDate],
  );

  const lateEmployees = useMemo(
    () => todayRecords.filter((r) => (r.stats?.lateMinutes ?? 0) > 0),
    [todayRecords],
  );

  return {
    records,
    employees,
    workingHours,
    secondaryError,
    setWorkingHours,
    loading,
    searchTerm,
    setSearchTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    calendarMonth,
    setCalendarMonth,
    employeeIdFilter,
    fetchAttendance,
    fetchEmployees,
    fetchWorkingHours,
    todayRecords,
    processedData,
    archiveRecords,
    lateEmployees,
  };
}
