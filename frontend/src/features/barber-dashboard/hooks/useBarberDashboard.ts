import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { barberService } from "@/services/barberService";
import payrollService from "@/services/payrollService";
import { adaptObject } from "@/services/apiAdapter";
import { loadErrorMessage } from "@/lib/core/asyncError";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { statusChangeMessage } from "@/lib/barberStatus";
import { useSocket } from "@/context/SocketContext";

export const useBarberDashboard = () => {
  const { user } = useAuth();
  const socketContext = useSocket();
  const socket = socketContext?.socket ?? null;

  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayCommission: 0,
    weeklyTotal: 0,
    customersCount: 0,
    servicesToday: 0,
    pendingCommission: 0,
    receivedAdvances: 0,
  });

  const [projectedSalary, setProjectedSalary] = useState<any>(null);

  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("queue");

  const load = useCallback(
    async (silent: boolean) => {
      // A poll must not flip `loading`: that empties the queue and blanks the
      // dashboard every 30 seconds, which reads as the page breaking rather
      // than as fresh data. Silent refreshes leave what is on screen alone.
      try {
        if (!silent) setLoading(true);
        setLoadError(null);
      /**
       * Five calls, all independent.
       *
       * `earnings-summary` is what makes the weekly figure real; the two that
       * are decorative (payroll projection, performance history) keep their own
       * fallbacks so a failure in one does not blank the queue the barber
       * actually works from. `stats` and `queue` remain fatal — the page has an
       * error state for those.
       */
      const [statsRes, queueRes, projectedRes, performanceRes, weeklySummary] =
        await Promise.all([
          barberService.getStats(),
          barberService.getQueue(),
          payrollService.expectedNet(undefined).catch(() => null),
          barberService.getPerformance().catch(() => ({ data: [] })),
          barberService
            .getEarningsSummary()
            .then((res: any) => (adaptObject(res, {}) as any))
            .catch(() => null),
        ]);

      const statsData: any = adaptObject(statsRes, {});
      setStats({
        todayCommission: statsData.earned_commission ?? 0,
        /**
         * Weekly production.
         *
         * This used to be:
         *
         *   statsData.weekly_total || statsData.weeklyTotal || statsData.earned_commission || 0
         *
         * The final fallback is the trap: `/barber/stats` is scoped to today
         * and never sends a `weekly_total`, so the chain always landed on
         * `earned_commission`. The card labelled "إنتاجية الأسبوع" therefore
         * displayed today's commission, every day, indefinitely.
         *
         * It now comes from the weekly figure the API does send, on
         * `/earnings-summary`. If that call fails the card reads 0 rather than
         * showing a confidently wrong number.
         */
        weeklyTotal: weeklySummary?.week ?? 0,
        customersCount: statsData.total_customers ?? 0,
        servicesToday: statsData.services_today ?? 0,
        /**
         * The two numbers that explain a monthly paycheque.
         *
         * `pending` is commission on sales that are not closed yet, and
         * `received_advances` is money already taken against the month. The API
         * computed both and the dashboard displayed neither, so a barber whose
         * net is below their production had no way to see why.
         */
        pendingCommission: weeklySummary?.pending ?? 0,
        receivedAdvances: statsData.received_advances ?? 0,
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
      if (!silent) setLoading(false);
    }
  },
    [],
  );

  /**
   * Full refresh. Zero-argument on purpose: it is passed straight to `onRetry`
   * and `onClick` in `BarberDashboard`, and a handler that takes an options bag
   * silently receives a `MouseEvent` there instead.
   */
  const fetchDashboardData = useCallback(() => load(false), [load]);

  /** Background poll: never touches `loading`. */
  const refreshSilently = useCallback(() => load(true), [load]);

  // A poll that lands mid status-change would race it: the queue could be
  // re-rendered from a snapshot taken before the write, putting the row back
  // where the barber just moved it. One in-flight flag, checked by both sides.
  const statusChangeInFlight = useRef(false);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useAutoRefresh(() => {
    if (statusChangeInFlight.current) return;
    void refreshSilently();
  }, 30_000);

  /**
   * The live path. The 30s timer above is the floor; this is what makes the queue
   * move when something actually happens.
   *
   * `POST /barber/update-status` now broadcasts `appointment_status_changed`
   * (it did not before -- the equivalent writes in `appointments.py` and
   * `invoices.py` did, which is why the cashier's board was live and the
   * barber's was not). So a customer started at reception, or finished at the
   * POS, lands in the barber's queue immediately instead of up to 30 seconds
   * later.
   *
   * Events for other barbers are filtered out by `barber_id`: the broadcast is
   * shop-wide, and a busy shop produces a constant stream of them.
   */
  useEffect(() => {
    if (!socket) return;
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.event !== "appointment_status_changed") return;
        if (
          msg.barber_id != null &&
          Number(msg.barber_id) !== Number(user?.barber_id ?? user?.employee_id)
        ) {
          return; // somebody else's customer
        }
        if (statusChangeInFlight.current) return;
        void refreshSilently();
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };
    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, refreshSilently, user?.barber_id, user?.employee_id]);

  const handleStatusChange = async (id: string | number, newStatus: string) => {
    statusChangeInFlight.current = true;
    try {
      await barberService.updateStatus(id, newStatus);
      // Read-back is deliberately not silent: the barber just acted, so this
      // is a consequence of their own click, not a background poll.
      await fetchDashboardData();
    } catch (error) {
      // A silently failed status update leaves the queue out of step with the
      // backend, so the barber needs to know the change did not stick.
      console.error("Status update error:", error);
      toast.error(statusChangeMessage(error));
    } finally {
      // `finally`, not the success path: a single failed status change would
      // otherwise leave the flag set and silently stop every future poll.
      statusChangeInFlight.current = false;
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
