import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import {
  QUERY_KEYS,
  useAppointments,
  useEmployees,
  useServices,
  useServiceCategories,
} from "@/hooks/useAppointments";
import {
  TODAY,
  TAB_CATEGORIES,
  getBookingCustomerName,
  isOpenBooking,
  matchesTab,
  normalizeStatus,
  rawStatus,
} from "@/features/bookings/utils/board";
import type { BookingRecord } from "@/features/bookings/types";

/**
 * Board listing data: filters, queries, derived lists and stats.
 * Extracted from pages/cashier/Bookings (Phase 3).
 */
export function useBookingsBoard() {
  // UI & Filter States
  const [dateFilter, setDateFilter] = useState("today");
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);
  const [activeTab, setActiveTab] = useState("الكل");
  const [quickFilter, setQuickFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const queryClient = useQueryClient();

  // React Query data sources
   
  const appointmentsQuery = useAppointments({ dateFilter, startDate, endDate } as any);
  const employeesQuery = useEmployees();
  const servicesQuery = useServices();
  const categoriesQuery = useServiceCategories();

  const bookings: BookingRecord[] = useMemo(
    () => appointmentsQuery.data || [],
    [appointmentsQuery.data],
  );
  const employees: BookingRecord[] = useMemo(
    () => employeesQuery.data || [],
    [employeesQuery.data],
  );
  const services: BookingRecord[] = useMemo(
    () => servicesQuery.data || [],
    [servicesQuery.data],
  );
  const categories: BookingRecord[] = useMemo(
    () => categoriesQuery.data || [],
    [categoriesQuery.data],
  );

  const invalidateAppointments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
  }, [queryClient]);

  const refreshBookings = useCallback(async () => {
    if (dateFilter === "today") {
      try {
        await api.post("/appointments/auto-cancel-expired");
      } catch (e) {
        console.debug("auto-cancel-expired failed:", e);
      }
    }
    setRefreshing(true);
    try {
      await appointmentsQuery.refetch();
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
     
  }, [dateFilter, appointmentsQuery.refetch]);

  // Salon Capacity & Busyness Gauge Stats
  const salonCapacity = useMemo(() => {
    const todayList = (bookings || []).filter(
      (b) => b.appointment_date === TODAY,
    );
    const activeCount = todayList.filter((b) => isOpenBooking(b)).length;

    const maxCapacity = Math.max(employees.length * 8, 20);
    const percentage = Math.min(
      Math.round((activeCount / maxCapacity) * 100),
      100,
    );

    return {
      percentage,
      activeCount,
      isBusy: percentage >= 70,
    };
  }, [bookings, employees]);

  const stats = useMemo(() => {
    const list = Array.isArray(bookings) ? bookings : [];
    return {
      total: list.length,
      online: list.filter(
        (b) => isOpenBooking(b) && b.booking_source === "online",
      ).length,
      waiting: list.filter((b) =>
        ["pending", "confirmed", "waiting"].includes(rawStatus(b)),
      ).length,
      reception: list.filter((b) =>
        [
          "in_progress",
          "ready_for_payment",
          "ready_for_pos",
          "completed",
        ].includes(rawStatus(b)),
      ).length,
      cancelled: list.filter((b) => rawStatus(b) === "cancelled").length,
    };
  }, [bookings]);

  // Per-tab counters shown on the tab bar
  const tabCounts = useMemo(() => {
    const list = Array.isArray(bookings) ? bookings : [];
     
    const counts: Record<string, any> = {};
     
    (TAB_CATEGORIES as any[]).forEach((t) => {
      counts[t.id] = list.filter((b) => matchesTab(b, t.id)).length;
    });
    return counts;
  }, [bookings]);

  // Filtered Bookings Logic
  const filteredBookings = useMemo(() => {
    const list = Array.isArray(bookings) ? bookings : [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const afterTomorrow = new Date();
    afterTomorrow.setDate(afterTomorrow.getDate() + 2);
    const afterTomorrowStr = afterTomorrow.toISOString().slice(0, 10);
    const now = new Date();

    return list.filter((b) => {
      const status = normalizeStatus(b.status);
      const bDate = b.appointment_date;

      let matchesDate = true;
      if (dateFilter === "today") matchesDate = bDate === todayStr;
      else if (dateFilter === "tomorrow") matchesDate = bDate === tomorrowStr;
      else if (dateFilter === "after_tomorrow")
        matchesDate = bDate === afterTomorrowStr;
      else if (dateFilter === "this_week") {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        matchesDate =
          bDate >= todayStr && bDate <= nextWeek.toISOString().slice(0, 10);
      } else if (dateFilter === "custom" && startDate && endDate) {
        matchesDate = bDate >= startDate && bDate <= endDate;
      } else if (dateFilter === "all") {
        matchesDate = true;
      }

      const matchesTabResult = matchesTab(b, activeTab);

      let matchesQuick = true;
      if (quickFilter === "late") {
        const [h, m] = String(b.appointment_time).split(":");
        const apptTime = new Date();
        apptTime.setHours(parseInt(h || "0"), parseInt(m || "0"), 0);
        const isLate =
          bDate === todayStr &&
          apptTime < now &&
          (status === "WAITING" || status === "CONFIRMED");
        matchesQuick = isLate;
      } else if (quickFilter === "walkin") {
        matchesQuick = b.booking_source === "walkin";
      } else if (quickFilter === "pending") {
        matchesQuick = ["pending", "confirmed"].includes(rawStatus(b));
      } else if (quickFilter === "online") {
        matchesQuick = b.booking_source === "online";
      }

      const matchesSearch =
        !searchTerm ||
        getBookingCustomerName(b)
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (b.customer_phone || "").includes(searchTerm);

      const matchesEmployee =
        selectedEmployeeId === "all" ||
        String(b.barber_id) === String(selectedEmployeeId);

      return (
        matchesDate &&
        matchesTabResult &&
        matchesQuick &&
        matchesSearch &&
        matchesEmployee
      );
    });
  }, [
    bookings,
    activeTab,
    quickFilter,
    searchTerm,
    dateFilter,
    startDate,
    endDate,
    selectedEmployeeId,
  ]);

  return {
    dateFilter,
    setDateFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    activeTab,
    setActiveTab,
    quickFilter,
    setQuickFilter,
    searchTerm,
    setSearchTerm,
    selectedEmployeeId,
    setSelectedEmployeeId,
    refreshing,
    lastUpdated,
    setLastUpdated,
    bookings,
    employees,
    services,
    categories,
    appointmentsQuery,
    salonCapacity,
    stats,
    tabCounts,
    filteredBookings,
    invalidateAppointments,
    refreshBookings,
  };
}
