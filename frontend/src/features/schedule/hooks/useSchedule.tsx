import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "react-hot-toast";
import { scheduleService } from "@/features/bookings/services/scheduleService";
import { businessSettingsService } from "@/services/businessSettingsService";
import { useSocket } from "@/context/SocketContext";
import { useDebounce, shiftDate } from "@/pages/cashier/schedule/Toolbar";
import {
  exportScheduleCSV,
  exportSchedulePDF,
} from "@/pages/cashier/schedule/exportSchedule";
import {
  buildSlots,
  normalizeStatus,
  slotLabelToTime24,
} from "@/pages/cashier/schedule/scheduleUtils";
import {
  DEFAULT_END_HOUR,
  DEFAULT_START_HOUR,
  WEEKDAY_TO_KEY,
  formatDateInput,
  parseDateInput,
} from "@/features/schedule/utils";

export function useSchedule() {
  const socketContext = useSocket?.();
  const socket = socketContext?.socket || null;
  const isConnected = socketContext?.connected ?? false;

  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));

  const [appointments, setAppointments] = useState<any[]>([]);

  const [barbers, setBarbers] = useState<any[]>([]);

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("day");
  const [barberFilter, setBarberFilter] = useState("all");
  const [range, setRange] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [draggingId, setDraggingId] = useState<any>(null);

  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const [lastUpdated, setLastUpdated] = useState<any>(null);

  const draggingRef = useRef(false);
  const loadPendingRef = useRef(false);

  const lastMoveRef = useRef<any>(null);

  const operatingHours = useMemo(() => {
    if (!settings?.working_hours)
      return { start: DEFAULT_START_HOUR, end: DEFAULT_END_HOUR };
    const date = parseDateInput(selectedDate);
    const dayKey = WEEKDAY_TO_KEY[date.getDay()];
    const config = settings.working_hours[dayKey];
    if (!config || !config.is_open)
      return { start: DEFAULT_START_HOUR, end: DEFAULT_END_HOUR };

    const startHour =
      parseInt(config.open_time?.split(":")[0]) || DEFAULT_START_HOUR;
    const endHour =
      parseInt(config.close_time?.split(":")[0]) || DEFAULT_END_HOUR;
    return { start: startHour, end: endHour };
  }, [settings, selectedDate]);

  const rangeConfig = useMemo(() => {
    const { start, end } = operatingHours;
    let s = start;
    let e = end;
    if (range === "morning") e = Math.max(s, Math.min(14, e));
    if (range === "evening") s = Math.min(e, Math.max(14, s));
    return { start: s, end: e, slots: buildSlots(s, e) };
  }, [range, operatingHours]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [appointmentsData, barbersData, settingsData] = await Promise.all([
        scheduleService.listAppointments(),
        scheduleService.listBarbers(),
        businessSettingsService.get(),
      ]);
      setAppointments(appointmentsData);
      setBarbers(barbersData);
      setSettings(settingsData);
      setLastUpdated(
        new Date().toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (err) {
      console.error("Load schedule data error:", err);
      toast.error("تعذر تحميل جدول المواعيد");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (draggingRef.current) {
      loadPendingRef.current = true;
      return;
    }
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleMessage = (event: any) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event?.startsWith("appointment_")) {
          refresh();
        }
      } catch (err) {
        console.error("WS Parse Error in Schedule", err);
      }
    };
    socket?.addEventListener("message", handleMessage);
    return () => socket?.removeEventListener("message", handleMessage);
  }, [socket, refresh]);

  useEffect(() => {
    if (loadPendingRef.current && !draggingRef.current) {
      loadPendingRef.current = false;
      loadData();
    }
  }, [draggingId, loadData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "arrowleft") {
        e.preventDefault();
        setSelectedDate((d) => shiftDate(d, -1));
      } else if (key === "arrowright") {
        e.preventDefault();
        setSelectedDate((d) => shiftDate(d, 1));
      } else if (key === "t") {
        setSelectedDate(formatDateInput(new Date()));
      } else if (key === "d") {
        setViewMode("day");
      } else if (key === "w") {
        setViewMode("week");
      } else if (key === "v") {
        setViewMode("list");
      } else if (key === "l") {
        setSidebarOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const deferredSearch = useDeferredValue(search);
  const debouncedSearch = useDebounce(deferredSearch, 200);

  const filteredAppointments = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return appointments.filter((item) => {
      const status = normalizeStatus(item.status);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesBarber =
        barberFilter === "all" ||
        Number(item.barber_id || item.employee_id) === Number(barberFilter);
      const matchesSearch =
        !q ||
        [
          item.customer_name,
          item.barber_name,
          item.employee_name,
          item.customer_phone,
          item.service_name,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(q),
        );
      return matchesStatus && matchesBarber && matchesSearch;
    });
  }, [appointments, barberFilter, debouncedSearch, statusFilter]);

  const dayAppointments = useMemo(
    () =>
      filteredAppointments.filter(
        (item) =>
          (item.appointment_date || item.appointmentDate) === selectedDate,
      ),
    [filteredAppointments, selectedDate],
  );

  const conflictIds = useMemo(() => {
    const seen: Record<string, any> = {};
    const ids = new Set();
    for (const appt of appointments) {
      const status = normalizeStatus(appt.status);
      if (["CANCELLED", "DONE", "NO_SHOW"].includes(status)) continue;
      const barberId = Number(appt.barber_id || appt.employee_id);
      const time = appt.appointment_time || appt.appointmentTime;
      const date = appt.appointment_date || appt.appointmentDate;
      const key = `${date}|${barberId}|${time}`;
      if (seen[key]) {
        ids.add(String(seen[key].id));
        ids.add(String(appt.id));
      } else {
        seen[key] = appt;
      }
    }
    return ids;
  }, [appointments]);

  const barbersWithAppointments = useMemo(() => {
    const filteredBarbers =
      barberFilter === "all"
        ? barbers
        : barbers.filter((b) => Number(b.id) === Number(barberFilter));

    return filteredBarbers.map((barber) => ({
      ...barber,
      appointments: dayAppointments
        .filter(
          (item) =>
            Number(item.barber_id || item.employee_id) === Number(barber.id),
        )
        .map((a) => ({
          ...a,
          _conflict: conflictIds.has(String(a.id)),
        }))
        .sort((a, b) =>
          (a.appointment_time || a.appointmentTime || "").localeCompare(
            b.appointment_time || b.appointmentTime || "",
          ),
        ),
    }));
  }, [barbers, dayAppointments, barberFilter, conflictIds]);

  const stats = useMemo(() => {
    let total = 0,
      confirmed = 0,
      inProgress = 0,
      reception = 0,
      done = 0,
      cancelled = 0;
    for (const a of dayAppointments) {
      const status = normalizeStatus(a.status);
      total += 1;
      if (["WAITING", "CONFIRMED"].includes(status)) confirmed += 1;
      else if (status === "IN_PROGRESS") inProgress += 1;
      else if (status === "AT_RECEPTION") reception += 1;
      else if (status === "DONE") done += 1;
      else if (status === "CANCELLED") cancelled += 1;
    }
    return { total, confirmed, inProgress, reception, done, cancelled };
  }, [dayAppointments]);

  const handleUndo = useCallback(async () => {
    const last = lastMoveRef.current;
    if (!last) return;
    try {
      await scheduleService.moveAppointment(last.id, last.before);
      lastMoveRef.current = null;
      toast.success("تم التراجع عن النقل بنجاح");
      loadData();
    } catch (_err) {
      toast.error("فشل التراجع عن النقل");
    }
  }, [loadData]);

  async function moveAppointment(id: any, payload: any) {
    const appt = appointments.find((a) => String(a.id) === String(id));
    if (!appt) return;

    const targetBarber = Number(
      payload.barber_id ?? appt.barber_id ?? appt.employee_id,
    );
    const targetTime =
      payload.appointment_time || appt.appointment_time || appt.appointmentTime;
    const targetDate =
      payload.appointment_date || appt.appointment_date || appt.appointmentDate;

    const conflict = appointments.some(
      (a) =>
        String(a.id) !== String(id) &&
        Number(a.barber_id || a.employee_id) === targetBarber &&
        (a.appointment_time || a.appointmentTime) === targetTime &&
        (a.appointment_date || a.appointmentDate) === targetDate &&
        !["CANCELLED", "DONE", "NO_SHOW"].includes(normalizeStatus(a.status)),
    );

    if (conflict) {
      toast.error(
        "تعارض: يوجد موعد آخر في نفس التوقيت والتاريخ مع هذا الموظف. اختر خانة فارغة.",
      );
      return;
    }

    const before = {
      barber_id: Number(appt.barber_id || appt.employee_id),
      appointment_time: appt.appointment_time || appt.appointmentTime,
      appointment_date: appt.appointment_date || appt.appointmentDate,
    };

    try {
      await scheduleService.moveAppointment(id, payload);
      lastMoveRef.current = { id: String(id), before };
      const targetLabel =
        payload.appointment_time && !payload.appointment_date
          ? ` الساعة ${payload.appointment_time}`
          : payload.appointment_date
            ? ` إلى ${payload.appointment_date === appt.appointment_date ? "نفس اليوم" : new Date(payload.appointment_date + "T00:00:00").toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}`
            : "";
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <span className="text-xs font-black">
              تم نقل موعد {appt.customer_name || "العميل"}
              {targetLabel}
            </span>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                handleUndo();
              }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-black hover:bg-accent/90 transition-colors"
            >
              تراجع
            </button>
          </div>
        ),
        { duration: 7000 },
      );
      loadData();
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr?.response?.data?.detail as string) || "فشل تحديث الموعد");
    }
  }

  const handleDragStart = useCallback((event: any) => {
    const appt = event.active?.data?.current?.appointment;
    if (appt) {
      draggingRef.current = true;
      setDraggingId(String(appt.id));
    }
  }, []);

  function handleDragEnd(event: any) {
    const over = event.over;
    const data = over?.data?.current;
    if (data) {
      if (data.type === "day") {
        moveAppointment(draggingId, { appointment_date: data.date });
      } else if (data.type === "slot" && draggingId) {
        moveAppointment(draggingId, {
          barber_id: Number(data.barberId),
          appointment_time: slotLabelToTime24(data.slot),
        });
      }
    }
    draggingRef.current = false;
    setDraggingId(null);
  }

  const handleDragCancel = useCallback(() => {
    draggingRef.current = false;
    setDraggingId(null);
  }, []);

  const draggedAppointment = useMemo(
    () => appointments.find((a) => String(a.id) === String(draggingId)),
    [appointments, draggingId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleExport = useCallback(
    (format: any) => {
      try {
        if (format === "pdf") {
          exportSchedulePDF({ appointments: dayAppointments, selectedDate });
        } else {
          exportScheduleCSV({ appointments: dayAppointments, selectedDate });
        }
        toast.success("تم تصدير الجدول بنجاح");
      } catch (err) {
        console.error("Export error:", err);
        toast.error("فشل تصدير الجدول");
      }
    },
    [dayAppointments, selectedDate],
  );

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setBarberFilter("all");
    setStatusFilter("all");
  }, []);

  const hasActiveFilters = useMemo(
    () => search !== "" || barberFilter !== "all" || statusFilter !== "all",
    [search, barberFilter, statusFilter],
  );

  return {
    selectedDate,
    setSelectedDate,
    appointments,
    setAppointments,
    barbers,
    setBarbers,
    settings,
    setSettings,
    loading,
    setLoading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    barberFilter,
    setBarberFilter,
    range,
    setRange,
    sidebarOpen,
    setSidebarOpen,
    draggingId,
    setDraggingId,
    selectedAppointment,
    setSelectedAppointment,
    lastUpdated,
    setLastUpdated,
    operatingHours,
    rangeConfig,
    deferredSearch,
    debouncedSearch,
    filteredAppointments,
    dayAppointments,
    conflictIds,
    barbersWithAppointments,
    stats,
    draggedAppointment,
    hasActiveFilters,
    loadData,
    refresh,
    moveAppointment,
    handleUndo,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    sensors,
    handleExport,
    handleClearFilters,
    isConnected,
  };
}

export type UseScheduleReturn = ReturnType<typeof useSchedule>;
