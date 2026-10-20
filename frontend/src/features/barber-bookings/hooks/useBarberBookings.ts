import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { barberService } from "@/services/barberService";
import { loadErrorMessage } from "@/lib/core/asyncError";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import {
  statusChangeMessage,
  STATUS_LABELS,
  STATUS_VARIANTS,
} from "@/lib/barberStatus";

export interface BarberAppointment {
  id: string | number;
  customer_name?: string | null;
  service_name?: string | null;
  appointment_date: string;
  start_time?: string | null;
  status: string;
  total_amount?: number | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface CalendarDay {
  day: number;
  date: string;
  isToday: boolean;
  count: number;
  hasCompleted: boolean;
  hasPending: boolean;
}

/**
 * Re-exported from `lib/barberStatus` rather than declared here.
 *
 * This local copy covered six statuses. The API writes ten, so `confirmed`,
 * `in_progress`, `done` and `no_show` fell through to `apt.status` -- the raw
 * English key rendered inside an Arabic badge, coloured `secondary` regardless
 * of meaning. `no_show` in particular is a no-show, and it was being presented
 * in the same neutral grey as a routine pending booking.
 */
export type StatusVariant =
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "outline"
  | "secondary";

export const statusLabels = STATUS_LABELS;
export const statusColors = STATUS_VARIANTS;

export const useBarberBookings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("list");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [appointments, setAppointments] = useState<BarberAppointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAppointments = useCallback(
    async (silent = false): Promise<void> => {
      try {
        // A background poll must not blank the list it is refreshing.
        if (!silent) setLoading(true);
        setLoadError(null);
        const monthStr: string = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
        const getCalendar = barberService.getCalendar as unknown as (
          month: string | null,
        ) => Promise<{ appointments?: BarberAppointment[] }>;
        const res = await getCalendar(monthStr);
        setAppointments(res?.appointments || []);
      } catch (err) {
        // Console-only: a failed load showed the barber an empty day with no
        // indication that the request failed rather than the day being free.
        console.error("Appointments fetch error:", err);
        setLoadError(loadErrorMessage(err, "الحجوزات"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [calendarMonth],
  );

  // Same guard as the dashboard: a poll must not race a status write.
  const statusChangeInFlight = useRef(false);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  useAutoRefresh(() => {
    if (statusChangeInFlight.current) return;
    void fetchAppointments(true);
  }, 30_000);

  const handleStatusChange = async (
    id: string | number,
    newStatus: string,
  ): Promise<void> => {
    statusChangeInFlight.current = true;
    try {
      await barberService.updateStatus(id, newStatus);
      await fetchAppointments();
    } catch (err) {
      // Silent status updates leave the barber's list disagreeing with the
      // backend, so surface it instead of logging.
      console.error("Status update error:", err);
      toast.error(statusChangeMessage(err));
    } finally {
      statusChangeInFlight.current = false;
    }
  };

  const filteredAppointments: BarberAppointment[] = appointments.filter(
    (apt) => {
      const matchesSearch =
        (apt.customer_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (apt.service_name || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
      const matchesDate = !selectedDate || apt.appointment_date === selectedDate;
      return matchesSearch && matchesStatus && matchesDate;
    },
  );

  const groupedByDate: Record<string, BarberAppointment[]> =
    filteredAppointments.reduce<Record<string, BarberAppointment[]>>(
      (acc, apt) => {
        const date = apt.appointment_date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(apt);
        return acc;
      },
      {},
    );

  const getCalendarDays = (): (CalendarDay | null)[] => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();

    const days: (CalendarDay | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const dayAppointments = appointments.filter(
        (a) => a.appointment_date === dateStr,
      );
      days.push({
        day: i,
        date: dateStr,
        isToday: dateStr === new Date().toISOString().split("T")[0],
        count: dayAppointments.length,
        hasCompleted: dayAppointments.some(
          (a) => a.status === "completed" || a.status === "ready_for_payment",
        ),
        hasPending: dayAppointments.some(
          (a) => a.status === "waiting" || a.status === "in-service",
        ),
      });
    }
    return days;
  };

  return {
    user,
    activeTab,
    setActiveTab,
    selectedDate,
    setSelectedDate,
    appointments,
    loading,
    loadError,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    calendarMonth,
    setCalendarMonth,
    fetchAppointments,
    handleStatusChange,
    filteredAppointments,
    groupedByDate,
    getCalendarDays,
    statusLabels,
    statusColors,
  };
};
