import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { barberService } from "@/services/barberService";
import payrollService from "@/services/payrollService";
import { adaptObject } from "@/services/apiAdapter";
import { loadErrorMessage } from "@/lib/core/asyncError";

export const useBarberDashboard = () => {
  const { user } = useAuth();

  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayCommission: 0,
    weeklyTotal: 0,
    customersCount: 0,
    servicesToday: 0,
  });

  const [projectedSalary, setProjectedSalary] = useState<any>(null);

  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("queue");

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [statsRes, queueRes, projectedRes, performanceRes] =
        await Promise.all([
          barberService.getStats(),
          barberService.getQueue(),
          payrollService.expectedNet(undefined).catch(() => null),
          barberService.getPerformance().catch(() => ({ data: [] })),
        ]);

      const statsData: any = adaptObject(statsRes, {});
      setStats({
        todayCommission:
          statsData.earned_commission || statsData.todayCommission || 0,
        weeklyTotal:
          statsData.weekly_total ||
          statsData.weeklyTotal ||
          statsData.earned_commission ||
          0,
        customersCount:
          statsData.total_customers || statsData.customersCount || 0,
        servicesToday: statsData.services_today || 0,
      });

      const queueData: any = adaptObject(queueRes, {});
      const waitingQueue = Array.isArray(queueData?.waiting)
        ? queueData.waiting
        : [];
      const completedQueue = Array.isArray(queueData?.completed)
        ? queueData.completed
        : [];
      setQueue([
        ...waitingQueue.map((item: any) => ({ ...item, isWaiting: true })),
        ...completedQueue.map((item: any) => ({ ...item, isWaiting: false })),
      ]);

      setProjectedSalary(adaptObject(projectedRes, {}));
      setPerformanceData(performanceRes?.data || []);
    } catch (err) {
      // Was console-only: a failed load left the barber looking at an empty
      // queue, which reads as "no customers yet" rather than "the request
      // failed" and gives them no reason to retry.
      console.error("Dashboard fetch error:", err);
      setLoadError(loadErrorMessage(err, "بيانات اللوحة"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleStatusChange = async (id: string | number, newStatus: string) => {
    try {
      await barberService.updateStatus(id, newStatus);
      fetchDashboardData();
    } catch (error) {
      // A silently failed status update leaves the queue out of step with the
      // backend, so the barber needs to know the change did not stick.
      console.error("Status update error:", error);
      toast.error("تعذر تحديث الحالة. أعد المحاولة.");
    }
  };

  const queueRows = Array.isArray(queue) ? queue : [];

  const waitingCount = queueRows.filter((q: any) => q.isWaiting).length;

  const completedCount = queueRows.filter((q: any) => !q.isWaiting).length;

  const totalRevenue = performanceData.reduce(
    (s: number, d: any) => s + (d.revenue || 0),
    0,
  );
  const totalServices = performanceData.reduce(
    (s: number, d: any) => s + (d.services || 0),
    0,
  );

  return {
    user,
    queue,
    stats,
    projectedSalary,
    performanceData,
    loading,
    loadError,
    activeTab,
    setActiveTab,
    fetchDashboardData,
    handleStatusChange,
    queueRows,
    waitingCount,
    completedCount,
    totalRevenue,
    totalServices,
  };
};
