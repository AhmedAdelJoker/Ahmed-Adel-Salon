import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useDeferredValue,
  useRef,
} from "react";
import { Plus, Keyboard, CornerDownLeft } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import { scheduleService } from "@/features/bookings/services/scheduleService";
import { businessSettingsService } from "@/services/businessSettingsService";
import { useSocket } from "@/context/SocketContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { cn, formatTime12h } from "@/lib/core/utils";

import Toolbar, { useDebounce, shiftDate } from "@/pages/cashier/schedule/Toolbar";
import ScheduleStatsBar from "@/pages/cashier/schedule/ScheduleStatsBar";
import DayBoard from "@/pages/cashier/schedule/DayBoard";
import WeekBoard from "@/pages/cashier/schedule/WeekBoard";
import ListView from "@/pages/cashier/schedule/ListView";
import ScheduleModal from "@/pages/cashier/schedule/ScheduleModal";
import AgendaPanel from "@/pages/cashier/schedule/AgendaPanel";
import {
  exportSchedulePDF,
  exportScheduleCSV,
} from "@/pages/cashier/schedule/exportSchedule";
import {
  normalizeStatus,
  buildSlots,
  slotLabelToTime24,
} from "@/pages/cashier/schedule/scheduleUtils";
import { ContentPanel, PageHeader } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence } from "framer-motion";
import { CalendarDays } from "lucide-react";

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 22;

const WEEKDAY_TO_KEY = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInput(value) {
  if (!value) return new Date();
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function SchedulePage() {
  const navigate = useNavigate();
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
    const handleMessage = (event) => {
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
    const handleKeyDown = (e) => {
      const target = e.target;
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

  async function moveAppointment(id, payload) {
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

  const handleDragStart = useCallback((event) => {
    const appt = event.active?.data?.current?.appointment;
    if (appt) {
      draggingRef.current = true;
      setDraggingId(String(appt.id));
    }
  }, []);

  function handleDragEnd(event) {
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
    (format) => {
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

  return (
    <div className="erp-page-container space-y-8 pb-16 relative" dir="rtl">
      <PageHeader className={undefined}
        title="مخطط المواعيد الذكي"
        subtitle="إدارة المواعيد اليومية بدقة واحترافية"
        badge="جدولة العمليات"
        icon={CalendarDays}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 rounded-xl px-4">
                  <Keyboard size={16} /> اختصارات
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[240px]">
                <DropdownMenuLabel>اختصارات لوحة المفاتيح</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  ["← / →", "تنقل بين الأيام"],
                  ["T", "العودة لليوم الحالي"],
                  ["D / W / V", "الجدول / الأسبوع / القائمة"],
                  ["L", "إظهار/إخفاء الشريط الجانبي"],
                ].map(([k, desc]) => (
                  <DropdownMenuItem
                    key={k}
                    className="justify-between gap-6"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span className="text-muted text-[10px] font-bold">
                      {desc}
                    </span>
                    <kbd className="px-2 py-0.5 rounded-md bg-soft border border-border/60 text-[9px] font-black tabular-nums">
                      {k}
                    </kbd>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => navigate("/bookings")}
              className="h-11 rounded-xl"
            >
              العودة للحجوزات
            </Button>
            <Button
              onClick={() => navigate("/bookings")}
              className="h-11 px-8 rounded-xl shadow-accent"
            >
              <Plus size={18} className="ml-2" /> حجز جديد
            </Button>
          </div>
        }
      />

      <ScheduleStatsBar stats={stats} />

      <ContentPanel noPadding title={undefined} subtitle={undefined} actions={undefined} className={undefined}>
        <div className="p-6">
          <Toolbar
            search={search}
            setSearch={setSearch}
            barberFilter={barberFilter}
            setBarberFilter={setBarberFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            barbers={barbers}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            viewMode={viewMode}
            setViewMode={setViewMode}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            onExport={handleExport}
            live={isConnected}
            lastUpdated={lastUpdated}
            onRefresh={loadData}
            range={range}
            setRange={setRange}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
          />
        </div>
      </ContentPanel>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          draggingRef.current = false;
          setDraggingId(null);
        }}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <ContentPanel
            title="الخريطة التشغيلية للمواعيد"
            subtitle={
              viewMode === "day"
                ? "خط زمني دقيق يعكس مدة كل خدمة. اسحب المواعيد لإعادة توزيعها بين الموظفين."
                : viewMode === "week"
                  ? "نظرة أسبوعية شاملة على توزيع المواعيد."
                  : "قائمة مفصلة بمواعيد اليوم مع كل التفاصيل."
            }
            className={cn("min-w-0")}
           actions={undefined}>
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="h-20 rounded-2xl bg-soft animate-pulse" />
                  <div className="flex gap-4">
                    <div
                      className="w-24 rounded-2xl bg-soft animate-pulse"
                      style={{ height: 500 }}
                    />
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-2xl bg-soft/60 animate-pulse"
                        style={{ height: 500 }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`${viewMode}-${selectedDate}-${range}`}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  {viewMode === "day" && (
                    <DayBoard
                      slots={rangeConfig.slots}
                      barbers={barbersWithAppointments}
                      operatingHours={rangeConfig}
                      onDrop={() => {}}
                      draggingId={draggingId}
                      isDraggingAny={!!draggingId}
                      onOpenDetails={setSelectedAppointment}
                    />
                  )}
                  {viewMode === "week" && (
                    <WeekBoard
                      appointments={filteredAppointments}
                      selectedDate={selectedDate}
                      onOpenDetails={setSelectedAppointment}
                    />
                  )}
                  {viewMode === "list" && (
                    <ListView
                      appointments={filteredAppointments}
                      selectedDate={selectedDate}
                      onOpenDetails={setSelectedAppointment}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </ContentPanel>

          {sidebarOpen && (
            <AnimatePresence>
              <motion.div
                key="sidebar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="min-w-0"
              >
                <AgendaPanel
                  selectedDate={selectedDate}
                  onSelectDay={setSelectedDate}
                  appointments={appointments}
                  barbers={barbers}
                  onOpenDetails={setSelectedAppointment}
                  isDragActive={!!draggingId}
                  onClose={() => setSidebarOpen(false)}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggedAppointment && (
            <div className="w-[260px] rounded-2xl p-4 shadow-2xl rotate-2 bg-white/95 dark:bg-[#171717]/95 opacity-95 backdrop-blur-sm ring-1 ring-accent/30">
              <div className="flex items-center justify-between gap-2">
                <Badge className="text-[9px] px-2.5 h-5 font-black uppercase tracking-widest rounded-lg shadow-sm border-none text-indigo-500 bg-indigo-500/10">
                  جاري النقل...
                </Badge>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-main bg-card/80 px-2.5 py-1 rounded-lg border border-border/40 tabular-nums shadow-sm">
                  <CornerDownLeft size={11} className="text-accent" />
                  {formatTime12h(
                    String(
                      draggedAppointment.appointment_time ||
                        draggedAppointment.appointmentTime ||
                        "",
                    ).slice(0, 5),
                  )}
                </div>
              </div>
              <h4 className="text-sm font-black text-main truncate mt-2">
                {draggedAppointment.customer_name || "عميل مجهول"}
              </h4>
              <p className="text-[9px] font-black text-muted mt-1">
                {draggedAppointment.barber_name ||
                  draggedAppointment.employee_name ||
                  "بدون موظف"}
              </p>
              <p className="text-[8px] font-bold text-accent mt-1.5">
                أفلت فوق موظف أو خانة لنقل الموعد، أو فوق يوم في التقويم الجانبي
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <ScheduleModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}

export default function SchedulePageSafe() {
  return (
    <ErrorBoundary>
      <SchedulePage />
    </ErrorBoundary>
  );
}
