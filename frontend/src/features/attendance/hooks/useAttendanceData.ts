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
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours>({});
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
  }, [fetchAttendance]);

  useEffect(() => {
    setArchivePage(1);
  }, [searchTerm, startDate, endDate, employeeIdFilter]);

  const todayRecords = useMemo(
    () => deriveTodayRecords(records, employees),
    [records, employees],
  );

  const processedData = useMemo(
    () => deriveMonthlyData(records, employees),
    [records, employees],
  );

  const filteredArchiveRecords = useMemo(
    () =>
      filterArchiveRecords(records, {
        startDate,
        endDate,
        searchTerm,
        employeeIdFilter,
      }),
    [records, searchTerm, employeeIdFilter, startDate, endDate],
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
    employees,
    workingHours,
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
    fetchLeaves,
    todayRecords,
    processedData,
    archiveRecords,
    filteredArchiveRecords,
    lateEmployees,
  };
}
