import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { barberService } from "@/services/barberService";
import payrollService from "@/services/payrollService";
import { adaptObject } from "@/services/apiAdapter";

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
  const [activeTab, setActiveTab] = useState("queue");

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
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
      console.error("Dashboard fetch error:", err);
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
      console.error("Status update error:", error);
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
