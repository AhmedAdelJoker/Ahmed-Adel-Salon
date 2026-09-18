import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { barberService } from "@/services/barberService";

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

export type StatusVariant = "warning" | "info" | "success" | "danger" | "secondary";

export const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  waiting: "في الانتظار",
  "in-service": "قيد الخدمة",
  completed: "مكتمل",
  ready_for_payment: "جاهز للدفع",
  cancelled: "ملغي",
};

export const statusColors: Record<string, StatusVariant> = {
  pending: "warning",
  waiting: "warning",
  "in-service": "info",
  completed: "success",
  ready_for_payment: "success",
  cancelled: "danger",
};

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

  const fetchAppointments = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const monthStr: string = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
      const getCalendar = barberService.getCalendar as unknown as (
        month: string | null,
      ) => Promise<{ appointments?: BarberAppointment[] }>;
      const res = await getCalendar(monthStr);
      setAppointments(res?.appointments || []);
    } catch (err) {
      console.error("Appointments fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [calendarMonth]);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  const handleStatusChange = async (
    id: string | number,
    newStatus: string,
  ): Promise<void> => {
    try {
      await barberService.updateStatus(id, newStatus);
      await fetchAppointments();
    } catch (err) {
      console.error("Status update error:", err);
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
