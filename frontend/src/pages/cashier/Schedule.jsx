import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  GripVertical,
  LayoutGrid,
  ListTree,
  Move,
  Plus,
  RefreshCcw,
  Scissors,
} from "lucide-react";

import { scheduleService } from "../../services/scheduleService";
import PageHero from "../../components/common/PageHero";
import DashboardPanel from "../../components/common/DashboardPanel";
import MetricCard from "../../components/common/MetricCard";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";

const DAY_START_HOUR = 9;
const DAY_END_HOUR = 18;
const SLOT_MINUTES = 30;

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInput(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatTimeLabel(date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSlots() {
  const slots = [];
  const start = new Date();
  start.setHours(DAY_START_HOUR, 0, 0, 0);

  const totalSlots = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES;
  for (let i = 0; i < totalSlots; i += 1) {
    const current = new Date(start.getTime() + i * SLOT_MINUTES * 60 * 1000);
    slots.push(formatTimeLabel(current));
  }
  return slots;
}

function normalizeStatus(status) {
  const value = String(status || "pending").toLowerCase();
  if (["pending", "confirmed", "completed", "cancelled"].includes(value))
    return value;
  return "pending";
}

function getStatusTheme(status) {
  switch (normalizeStatus(status)) {
    case "confirmed":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "pending":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getStatusAccent(status) {
  switch (normalizeStatus(status)) {
    case "confirmed":
      return "bg-sky-500";
    case "completed":
      return "bg-emerald-500";
    case "cancelled":
      return "bg-rose-500";
    case "pending":
    default:
      return "bg-amber-500";
  }
}

function formatDayTitle(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function minutesFromTime(value) {
  if (!value) return 0;
  const [hh = "0", mm = "0"] = String(value).split(":");
  return Number(hh) * 60 + Number(mm);
}

function sortAppointments(items) {
  return [...items].sort(
    (a, b) =>
      minutesFromTime(a.appointment_time) - minutesFromTime(b.appointment_time),
  );
}

function safeDurationMinutes(item) {
  return Number(item?.total_estimated_duration_minutes || 30) || 30;
}

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("day");
  const [barberFilter, setBarberFilter] = useState("all");
  const [draggingId, setDraggingId] = useState(null);

  const slots = useMemo(() => buildSlots(), []);
  const selectedDateObj = useMemo(
    () => parseDateInput(selectedDate),
    [selectedDate],
  );
  const weekStart = useMemo(
    () => startOfWeek(selectedDateObj),
    [selectedDateObj],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [appointmentsData, barbersData] = await Promise.all([
        scheduleService.listAppointments(),
        scheduleService.listBarbers(),
      ]);

      setAppointments(appointmentsData);
      setBarbers(barbersData);
    } catch (err) {
      console.error("Load schedule data error:", err);
      setError("تعذر تحميل جدول المواعيد");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return appointments.filter((item) => {
      const sameStatus =
        statusFilter === "all"
          ? true
          : normalizeStatus(item.status) === statusFilter;
      const sameBarber =
        barberFilter === "all"
          ? true
          : Number(item.barber_id) === Number(barberFilter);
      const sameQuery = !q
        ? true
        : [item.customer_name, item.barber_name, item.notes, item.status]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));
      return sameStatus && sameBarber && sameQuery;
    });
  }, [appointments, barberFilter, search, statusFilter]);

  const dayAppointments = useMemo(() => {
    return baseFiltered.filter(
      (item) => item.appointment_date === selectedDate,
    );
  }, [baseFiltered, selectedDate]);

  const weekAppointments = useMemo(() => {
    const weekValues = weekDays.map((d) => formatDateInput(d));
    return baseFiltered.filter((item) =>
      weekValues.includes(item.appointment_date),
    );
  }, [baseFiltered, weekDays]);

  const barbersWithAppointments = useMemo(() => {
    return barbers.map((barber) => ({
      ...barber,
      appointments: sortAppointments(
        dayAppointments.filter(
          (item) => Number(item.barber_id) === Number(barber.id),
        ),
      ),
    }));
  }, [barbers, dayAppointments]);

  const summary = useMemo(() => {
    const items = viewMode === "day" ? dayAppointments : weekAppointments;
    return {
      total: items.length,
      pending: items.filter(
        (item) => normalizeStatus(item.status) === "pending",
      ).length,
      confirmed: items.filter(
        (item) => normalizeStatus(item.status) === "confirmed",
      ).length,
      completed: items.filter(
        (item) => normalizeStatus(item.status) === "completed",
      ).length,
    };
  }, [dayAppointments, viewMode, weekAppointments]);

  async function updateAppointmentStatus(id, status) {
    setMessage("");
    setError("");

    try {
      const updated = await scheduleService.moveAppointment(id, { status });
      setAppointments((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
      setMessage("تم تحديث حالة الحجز بنجاح");
    } catch (err) {
      console.error("Update appointment status error:", err);
      setError(err?.response?.data?.detail || "تعذر تحديث حالة الحجز");
    }
  }

  async function moveAppointment(id, payload) {
    setMessage("");
    setError("");

    const previous = appointments;
    setAppointments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...payload } : item)),
    );

    try {
      const updated = await scheduleService.moveAppointment(id, payload);
      setAppointments((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
      setMessage("تم نقل الموعد بنجاح");
    } catch (err) {
      console.error("Move appointment error:", err);
      setAppointments(previous);
      setError(
        err?.response?.data?.detail ||
          "تعذر نقل الموعد — تأكد من دعم الـ backend للتعديل",
      );
    }
  }

  function handleDragStart(appointmentId) {
    setDraggingId(appointmentId);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  function handleDrop(barberId, slot, dateValue) {
    if (!draggingId) return;
    moveAppointment(draggingId, {
      barber_id: Number(barberId),
      appointment_date: dateValue,
      appointment_time: `${slot}:00`,
    });
    setDraggingId(null);
  }

  function navigateDay(offset) {
    const next = addDays(selectedDateObj, offset);
    setSelectedDate(formatDateInput(next));
  }

  return (
    <div className="app-limit space-y-5">
      <PageHero
        eyebrow="Schedule"
        title="Salon Schedule V2"
        subtitle="Day view + Week view مع سحب وإفلات للمواعيد ونقلها بين الحلاقين والأوقات بشكل أسرع."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black ${viewMode === "day" ? "bg-slate-950 text-white" : "text-slate-600"}`}
              >
                <LayoutGrid size={16} />
                Day view
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black ${viewMode === "week" ? "bg-slate-950 text-white" : "text-slate-600"}`}
              >
                <ListTree size={16} />
                Week view
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-2 py-2 shadow-sm">
              <button
                type="button"
                onClick={() => navigateDay(-1)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
              >
                <ChevronRight size={16} />
              </button>
              <input
                type="date"
                className="field-control w-[170px] rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button
                type="button"
                onClick={() => navigateDay(1)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            <Button type="button" variant="secondary" onClick={loadData}>
              <RefreshCcw size={16} />
              تحديث
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          title="Total"
          value={summary.total}
          helper={viewMode === "day" ? "مواعيد اليوم" : "مواعيد الأسبوع"}
          accent="from-fuchsia-500 to-rose-500"
          icon={<CalendarDays size={18} />}
        />
        <MetricCard
          title="Pending"
          value={summary.pending}
          helper="بانتظار التأكيد"
          accent="from-amber-400 to-orange-500"
          icon={<Clock3 size={18} />}
        />
        <MetricCard
          title="Confirmed"
          value={summary.confirmed}
          helper="مواعيد مؤكدة"
          accent="from-sky-500 to-cyan-500"
          icon={<Filter size={18} />}
        />
        <MetricCard
          title="Completed"
          value={summary.completed}
          helper="مواعيد مكتملة"
          accent="from-emerald-500 to-teal-500"
          icon={<Scissors size={18} />}
        />
      </div>

      <DashboardPanel
        title={
          viewMode === "day"
            ? "Interactive Day Board"
            : "Weekly Schedule Overview"
        }
        subtitle={
          viewMode === "day"
            ? "اسحب الموعد من خلية إلى أخرى لتغيير الحلاق أو الوقت (يتطلب backend update endpoint)."
            : "عرض أسبوعي مضغوط للمواعيد مع توزيعها على الأيام."
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="field-control min-w-[230px] rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم العميل أو الحلاق"
            />

            <select
              className="field-control rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900"
              value={barberFilter}
              onChange={(e) => setBarberFilter(e.target.value)}
            >
              <option value="all">كل الحلاقين</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.display_name}
                </option>
              ))}
            </select>

            <select
              className="field-control rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">كل الحالات</option>
              <option value="pending">قيد الانتظار</option>
              <option value="confirmed">مؤكد</option>
              <option value="completed">مكتمل</option>
              <option value="cancelled">ملغي</option>
            </select>

            <Button
              type="button"
              variant="primary"
              onClick={() => window.location.assign("/booking")}
            >
              <Plus size={16} />
              New booking
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="empty-state">جارٍ تحميل الجدول...</div>
        ) : viewMode === "day" ? (
          <DayBoard
            slots={slots}
            barbers={barbersWithAppointments}
            selectedDate={selectedDate}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            draggingId={draggingId}
            onStatusChange={updateAppointmentStatus}
          />
        ) : (
          <WeekBoard
            weekDays={weekDays}
            appointments={weekAppointments}
            barbers={barbers}
            onStatusChange={updateAppointmentStatus}
          />
        )}

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        ) : null}
      </DashboardPanel>
    </div>
  );
}

function DayBoard({
  slots,
  barbers,
  selectedDate,
  onDrop,
  onDragStart,
  onDragEnd,
  draggingId,
  onStatusChange,
}) {
  if (barbers.length === 0)
    return <div className="empty-state">لا يوجد حلاقون لعرض الجدول</div>;

  return (
    <div className="overflow-x-auto scrollbar-soft">
      <div className="min-w-[1260px]">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `110px repeat(${barbers.length}, minmax(240px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Time
          </div>

          {barbers.map((barber) => (
            <div
              key={barber.id}
              className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8b5cf6_0%,#ec4899_100%)] text-white shadow-lg">
                  <UserRound size={18} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-950">
                    {barber.display_name}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {barber.appointments.length} appointment(s)
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-4 grid gap-4"
          style={{
            gridTemplateColumns: `110px repeat(${barbers.length}, minmax(240px, 1fr))`,
          }}
        >
          <div className="space-y-3">
            {slots.map((slot) => (
              <div
                key={slot}
                className="flex h-28 items-start rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-black text-slate-500"
              >
                {slot}
              </div>
            ))}
          </div>

          {barbers.map((barber) => (
            <div key={barber.id} className="space-y-3">
              {slots.map((slot) => {
                const appointment = barber.appointments.find(
                  (item) =>
                    String(item.appointment_time || "").slice(0, 5) === slot,
                );
                const isDragging = draggingId === appointment?.id;

                return (
                  <div
                    key={`${barber.id}-${slot}`}
                    className={`h-28 rounded-[24px] border border-slate-200 bg-white/90 p-3 shadow-sm transition ${draggingId ? "ring-1 ring-slate-200" : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(barber.id, slot, selectedDate)}
                  >
                    {appointment ? (
                      <div
                        draggable
                        onDragStart={() => onDragStart(appointment.id)}
                        onDragEnd={onDragEnd}
                        className={`relative h-full rounded-[20px] border p-3 shadow-sm transition ${getStatusTheme(appointment.status)} ${isDragging ? "opacity-50" : "opacity-100"}`}
                      >
                        <div className="absolute left-3 top-3 text-slate-400">
                          <GripVertical size={14} />
                        </div>
                        <span
                          className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${getStatusAccent(appointment.status)}`}
                        />
                        <div className="pl-5 pr-4 text-sm font-black">
                          {appointment.customer_name || "Customer"}
                        </div>
                        <div className="mt-1 text-xs opacity-80">
                          {appointment.notes || "Appointment scheduled"}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <StatusBadge value={appointment.status} />
                          <div className="flex items-center gap-2">
                            {appointment.status !== "confirmed" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onStatusChange(appointment.id, "confirmed")
                                }
                                className="rounded-xl bg-white/70 px-2 py-1 text-[11px] font-black text-slate-700"
                              >
                                Confirm
                              </button>
                            ) : null}
                            {appointment.status !== "completed" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onStatusChange(appointment.id, "completed")
                                }
                                className="rounded-xl bg-slate-950 px-2 py-1 text-[11px] font-black text-white"
                              >
                                Complete
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold opacity-75">
                          <Move size={12} />
                          اسحب الموعد لتغيير الوقت/الحلاق
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-slate-200 text-xs font-semibold text-slate-300">
                        Drop here
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekBoard({ weekDays, appointments, barbers, onStatusChange }) {
  const daysWithAppointments = weekDays.map((dateObj) => {
    const dateValue = formatDateInput(dateObj);
    return {
      dateValue,
      label: formatDayTitle(dateObj),
      appointments: sortAppointments(
        appointments.filter((item) => item.appointment_date === dateValue),
      ),
    };
  });

  return (
    <div className="overflow-x-auto scrollbar-soft">
      <div className="min-w-[1180px] grid grid-cols-7 gap-4">
        {daysWithAppointments.map((day) => (
          <div
            key={day.dateValue}
            className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {day.label}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {day.dateValue}
                </div>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {day.appointments.length}
              </div>
            </div>

            <div className="space-y-3">
              {day.appointments.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-200 px-3 py-6 text-center text-xs font-semibold text-slate-300">
                  لا توجد مواعيد
                </div>
              ) : (
                day.appointments.map((appointment) => {
                  const barberName =
                    appointment.barber_name ||
                    barbers.find(
                      (b) => Number(b.id) === Number(appointment.barber_id),
                    )?.display_name ||
                    "Barber";
                  return (
                    <div
                      key={appointment.id}
                      className={`rounded-[20px] border p-3 ${getStatusTheme(appointment.status)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black">
                            {appointment.customer_name || "Customer"}
                          </div>
                          <div className="mt-1 text-xs opacity-80">
                            {barberName}
                          </div>
                        </div>
                        <div className="text-xs font-black opacity-80">
                          {String(appointment.appointment_time || "").slice(
                            0,
                            5,
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <StatusBadge value={appointment.status} />
                        <div className="flex gap-2">
                          {appointment.status !== "confirmed" ? (
                            <button
                              type="button"
                              onClick={() =>
                                onStatusChange(appointment.id, "confirmed")
                              }
                              className="rounded-xl bg-white/70 px-2 py-1 text-[11px] font-black text-slate-700"
                            >
                              Confirm
                            </button>
                          ) : null}
                          {appointment.status !== "completed" ? (
                            <button
                              type="button"
                              onClick={() =>
                                onStatusChange(appointment.id, "completed")
                              }
                              className="rounded-xl bg-slate-950 px-2 py-1 text-[11px] font-black text-white"
                            >
                              Complete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
