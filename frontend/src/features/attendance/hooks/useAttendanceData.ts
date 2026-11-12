import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { loadErrorMessage } from "@/lib/core/asyncError";
import type {
  AttendanceRecord,
  EmployeeRecord,
  LeaveRecord,
  WorkingHours,
} from "@/features/attendance/types";
import {
  deriveMonthlyData,
  deriveTodayRecords,
  effectiveShift,
  filterArchiveRecords,
  normalizeCurrentRecords,
  type TranslateFn,
} from "@/features/attendance/utils/attendance";

const PAGE_SIZE = 25;

export function useAttendanceData(opts?: { t?: TranslateFn }) {
  const t = opts?.t;
  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get("employeeId");

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours>({});
  const [penaltyRate, setPenaltyRate] = useState<number>(0.5);
  const [lateThreshold, setLateThreshold] = useState<number>(15);
  const [autoPenaltyEnabled, setAutoPenaltyEnabled] = useState<boolean>(true);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);

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
  const [leaveFilter, setLeaveFilter] = useState("all");
  const [archivePage, setArchivePage] = useState(1);

  const tt = useCallback(
    (key: string, fallback: string) => (t ? t(key) : fallback),
    [t],
  );

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [curRes, empRes, whRes] = await Promise.allSettled([
        api.get("/barber-presence/current"),
        api.get("/employees"),
        api.get("/barber-presence/working-hours"),
      ]);

      const empList =
        empRes.status === "fulfilled"
          ? adaptList(empRes.value).map((emp: any) => ({
              ...emp,
              id: emp.id,
              full_name: emp.full_name || emp.display_name || emp.name || "—",
            }))
          : [];
      setEmployees(empList);

      if (curRes.status === "fulfilled") {
        setRecords(normalizeCurrentRecords(curRes.value.data || [], empList));
      } else {
        setRecords([]);
        setLoadError(
          loadErrorMessage(curRes.reason, tt("attendance.loadFailed", "Attendance")),
        );
      }

      if (whRes.status === "fulfilled") {
        setWorkingHours(whRes.value.data?.working_hours || {});
        // The engine's own numbers — the payroll view used to hardcode 2
        // EGP/minute while the backend applied 0.5, so the monthly view and
        // /analytics disagreed 4x. Both sides now read the same value.
        setPenaltyRate(Number(whRes.value.data?.late_penalty_per_minute ?? 0.5));
        setLateThreshold(Number(whRes.value.data?.late_threshold_minutes ?? 15));
        setAutoPenaltyEnabled(whRes.value.data?.auto_penalty_enabled !== false);
      } else {
        setWorkingHours({});
      }

      const secondary: string[] = [];
      if (empRes.status === "rejected") {
        secondary.push(loadErrorMessage(empRes.reason, "Employees"));
      }
      if (whRes.status === "rejected") {
        secondary.push(loadErrorMessage(whRes.reason, "Working hours"));
      }
      setSecondaryError(secondary.length ? secondary.join(" · ") : null);
    } finally {
      setLoading(false);
    }
  }, [tt]);

  // Historical logs for the archive, calendar and monthly analytics.
  // Those tabs used to be derived from `/barber-presence/current`, which only
  // returns *today's* logs — the archive ignored its date filter, the calendar
  // showed empty days, and "monthly" analytics showed today's numbers.
  const fetchHistory = useCallback(
    async (range?: { start: string; end: string }) => {
      const start = range?.start || startDate;
      const end = range?.end || endDate;
      try {
        const res = await api.get("/barber-presence/history", {
          params: {
            start_date: start || undefined,
            end_date: end || undefined,
            employee_id: employeeIdFilter || undefined,
          },
        });
        const rows: AttendanceRecord[] = Array.isArray(res.data) ? res.data : [];
        setHistoryRecords(
          rows.map((row: any) => ({
            ...row,
            id: row.id,
            employee_id: row.employee_id,
            employee_name: row.employee_name || "—",
            status: row.status,
            created_at: row.created_at,
            is_late: Boolean(row.is_late),
            all_logs: [],
          })),
        );
      } catch {
        // The archive is a secondary view; the today tab stays functional.
        setHistoryRecords([]);
      }
    },
     
    [startDate, endDate, employeeIdFilter],
  );

  const fetchLeaves = useCallback(
    async (status = leaveFilter) => {
      try {
        setLeavesLoading(true);
        const res = await api.get("/barber-presence/leaves", {
          params: { status: status === "all" ? undefined : status },
        });
        setLeaves(Array.isArray(res.data) ? res.data : []);
      } catch {
        setLeaves([]);
      } finally {
        setLeavesLoading(false);
      }
    },
    [leaveFilter],
  );

  useEffect(() => {
    void fetchAttendance();
     
  }, []);

  // Reset pagination when any filter changes.
  useEffect(() => {
    setArchivePage(1);
  }, [searchTerm, startDate, endDate, employeeIdFilter]);

  // Re-fetch history when the archive range or employee filter changes.
  // (Runs on mount too — that is the initial history load.)
  useEffect(() => {
    void fetchHistory();
  }, [startDate, endDate, employeeIdFilter, fetchHistory]);

  const todayRecords = useMemo(
    () => deriveTodayRecords(records, employees),
    [records, employees],
  );

  // Monthly analytics over the *fetched history window*, not today's snapshot.
  // The real working hours drive the shift bounds and the backend's own
  // penalty rate drives payroll, so this view agrees with /analytics.
  const processedData = useMemo(
    () =>
      deriveMonthlyData(historyRecords, employees, {
        shift: effectiveShift(workingHours),
        penaltyPerMinute: penaltyRate,
      }),
    [historyRecords, employees, workingHours, penaltyRate],
  );

  const filteredArchiveRecords = useMemo(
    () =>
      filterArchiveRecords(historyRecords, {
        startDate,
        endDate,
        searchTerm,
        employeeIdFilter,
      }),
    [historyRecords, searchTerm, employeeIdFilter, startDate, endDate],
  );

  const archiveTotalPages = Math.max(
    1,
    Math.ceil(filteredArchiveRecords.length / PAGE_SIZE),
  );
  const safeArchivePage = Math.min(archivePage, archiveTotalPages);
  const archiveRecords = useMemo(
    () =>
      filteredArchiveRecords.slice(
        (safeArchivePage - 1) * PAGE_SIZE,
        safeArchivePage * PAGE_SIZE,
      ),
    [filteredArchiveRecords, safeArchivePage],
  );

  const lateEmployees = useMemo(
    () =>
      todayRecords.filter(
        (r) => Boolean(r.is_late) || Number(r.stats?.lateMinutes ?? 0) > 0,
      ),
    [todayRecords],
  );

  return {
    records,
    historyRecords,
    employees,
    workingHours,
    penaltyRate,
    lateThreshold,
    autoPenaltyEnabled,
    leaves,
    loading,
    leavesLoading,
    loadError,
    secondaryError,
    searchTerm,
    setSearchTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    calendarMonth,
    setCalendarMonth,
    leaveFilter,
    setLeaveFilter,
    archivePage: safeArchivePage,
    setArchivePage,
    archiveTotalPages,
    archiveTotal: filteredArchiveRecords.length,
    pageSize: PAGE_SIZE,
    employeeIdFilter,
    fetchAttendance,
    fetchHistory,
    fetchLeaves,
    todayRecords,
    processedData,
    archiveRecords,
    filteredArchiveRecords,
    lateEmployees,
  };
}
