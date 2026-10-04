import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { useAuth } from "@/context/AuthContext";
import { loadErrorMessage } from "@/lib/core/asyncError";
import {
  DEFAULT_STATS,
  DEMO_STATS,
  FALLBACK_SERVICES,
  FALLBACK_WEEKLY,
} from "@/features/reports-dashboard/constants";
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
  const [weeklyData, setWeeklyData] = useState<WeeklyRow[]>(FALLBACK_WEEKLY);
  const [serviceDistribution, setServiceDistribution] = useState<ServiceSlice[]>(FALLBACK_SERVICES);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [chartType, setChartType] = useState("area");
  const [isDemo, setIsDemo] = useState(false);
  // Kept separate from isDemo: "the request failed" and "the period genuinely
  // has no numbers" are different facts, and only one of them justifies
  // showing illustrative figures.
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/owner/dashboard-stats", {
        params: { scope: reportScope, employee_id: employeeId, period },
      });
      const data = adaptObject(res.data) as DashboardApiPayload;

      const hasRealRevenue = data.stats && Number(data.stats.todayRevenue) > 0;
      const hasRealWeekly = Array.isArray(data.weekly_data) && data.weekly_data.some(d => Number(d.revenue) > 0);
      const isEmpty = !hasRealRevenue && !hasRealWeekly;
      setIsDemo(isEmpty);

      // Over a real response, the demo figures are the *base* and the response
      // overrides what it provides. That means any field the API does not
      // return keeps a demo value -- a silent, unlabelled fabrication, because
      // `isDemo` is false when there was revenue, so no banner appears.
      //
      // A missing field is zero, not 18,750. The demo set is used only when the
      // whole period is empty, where it is labelled.
      const mergedStats = isEmpty
        ? DEMO_STATS
        : ({
            ...DEFAULT_STATS,
            ...Object.fromEntries(
              Object.entries(data.stats || {}).filter(
                ([_, v]) => v != null && typeof v !== "object" && String(v) !== "" && !Number.isNaN(Number(v as any))
              )
            ),
            occupancy: data.stats?.occupancy != null ? data.stats.occupancy : DEFAULT_STATS.occupancy,
          } as DashboardStats);

      setStats(mergedStats);
      setWeeklyData(hasRealWeekly && Array.isArray(data.weekly_data) ? data.weekly_data : FALLBACK_WEEKLY);

      if (data.service_distribution?.length) {
        setServiceDistribution(data.service_distribution);
      } else if (data.stats?.service_breakdown?.length) {
        setServiceDistribution(data.stats.service_breakdown);
      } else {
        setServiceDistribution(FALLBACK_SERVICES);
      }
    } catch (err) {
      // Previously this fell back to DEMO_STATS and told the owner "no real
      // data for this period", which reads as a silent zero-sales day when the
      // truth is the request failed. Keep the numbers off the screen instead.
      console.error("Dashboard load error:", err);
      setLoadError(loadErrorMessage(err, "بيانات لوحة التقارير"));
      setIsDemo(false);
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

  const chartRows = useMemo(() => (Array.isArray(weeklyData) ? weeklyData : []), [weeklyData]);
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
    isDemo,
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
