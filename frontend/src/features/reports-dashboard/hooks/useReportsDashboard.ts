import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { useAuth } from "@/context/AuthContext";
import { loadErrorMessage } from "@/lib/core/asyncError";
import { DEFAULT_STATS } from "@/features/reports-dashboard/constants";
import type {
  DashboardStats,
  ServiceSlice,
  WeeklyRow,
} from "@/features/reports-dashboard/constants";

interface DashboardApiPayload {
  stats?: Record<string, number> & {
    occupancy?: number;
    service_breakdown?: ServiceSlice[];
  };
  weekly_data?: WeeklyRow[];
  service_distribution?: ServiceSlice[];
}

export function useReportsDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const reportScope = searchParams.get("scope");
  const employeeId = searchParams.get("employeeId");
  const employeeName = searchParams.get("employeeName");

  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [weeklyData, setWeeklyData] = useState<WeeklyRow[]>([]);
  const [serviceDistribution, setServiceDistribution] = useState<ServiceSlice[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [chartType, setChartType] = useState("area");
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/owner/dashboard-stats", {
        params: { scope: reportScope, employee_id: employeeId, period },
      });
      const data = adaptObject(res.data) as DashboardApiPayload;

      const hasRealWeekly =
        Array.isArray(data.weekly_data) &&
        data.weekly_data.some((d) => Number(d.revenue) > 0);

      // A missing field is zero, not an invented figure. `null` occupancy is
      // preserved: "the server could not compute it" must survive to the screen.
      const rawOccupancy = data.stats?.occupancy;
      const mergedStats = {
        ...DEFAULT_STATS,
        ...Object.fromEntries(
          Object.entries(data.stats || {}).filter(
            ([key, v]) =>
              key !== "occupancy" &&
              v != null &&
              typeof v !== "object" &&
              String(v) !== "" &&
              !Number.isNaN(Number(v as any)),
          ),
        ),
        occupancy: rawOccupancy ?? null,
      } as DashboardStats;

      setStats(mergedStats);
      setWeeklyData(hasRealWeekly && Array.isArray(data.weekly_data) ? data.weekly_data : []);

      if (data.service_distribution?.length) {
        setServiceDistribution(data.service_distribution);
      } else if (data.stats?.service_breakdown?.length) {
        setServiceDistribution(data.stats.service_breakdown);
      } else {
        setServiceDistribution([]);
      }
    } catch (err) {
      // The request failed, so keep the numbers off the screen and say so.
      console.error("Dashboard load error:", err);
      setLoadError(loadErrorMessage(err, "بيانات لوحة التقارير"));
    } finally {
      setLoading(false);
    }
  }, [reportScope, employeeId, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  const chartRows = useMemo(
    () => (Array.isArray(weeklyData) ? weeklyData : []),
    [weeklyData],
  );
  const displayName = user?.full_name || "المدير";
  const scopeLabel = employeeId
    ? `تقرير مخصص: ${employeeName || `الموظف #${employeeId}`}`
    : "نظرة عامة على المنشأة بالكامل";

  return {
    stats,
    weeklyData,
    serviceDistribution,
    loading,
    period,
    chartType,
    loadError,
    reportScope,
    employeeId,
    employeeName,
    displayName,
    scopeLabel,
    chartRows,
    loadData,
    handlePeriodChange,
    setPeriod,
    setChartType,
  };
}

export type UseReportsDashboardReturn = ReturnType<typeof useReportsDashboard>;
