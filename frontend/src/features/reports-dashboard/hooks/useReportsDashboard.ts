import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { useAuth } from "@/context/AuthContext";
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/owner/dashboard-stats", {
        params: { scope: reportScope, employee_id: employeeId, period },
      });
      const data = adaptObject(res.data) as DashboardApiPayload;

      const hasRealRevenue = data.stats && Number(data.stats.todayRevenue) > 0;
      const hasRealWeekly = Array.isArray(data.weekly_data) && data.weekly_data.some(d => Number(d.revenue) > 0);
      const isEmpty = !hasRealRevenue && !hasRealWeekly;
      setIsDemo(isEmpty);

      const mergedStats = isEmpty ? DEMO_STATS : {
        ...DEMO_STATS,
        ...Object.fromEntries(Object.entries(data.stats || {}).filter(([_, v]) => Number(v) !== 0)),
        occupancy: data.stats?.occupancy ?? DEMO_STATS.occupancy,
      };

      setStats((prev) => ({ ...prev, ...mergedStats }));
      setWeeklyData(hasRealWeekly && Array.isArray(data.weekly_data) ? data.weekly_data : FALLBACK_WEEKLY);

      if (data.service_distribution?.length) {
        setServiceDistribution(data.service_distribution);
      } else if (data.stats?.service_breakdown?.length) {
        setServiceDistribution(data.stats.service_breakdown);
      } else {
        setServiceDistribution(FALLBACK_SERVICES);
      }
    } catch (_err) {
      console.error("Dashboard load error:", _err);
      setStats(DEMO_STATS);
      setWeeklyData(FALLBACK_WEEKLY);
      setServiceDistribution(FALLBACK_SERVICES);
      setIsDemo(true);
      toast.error("تعذر تحميل البيانات - يتم عرض بيانات توضيحية");
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
