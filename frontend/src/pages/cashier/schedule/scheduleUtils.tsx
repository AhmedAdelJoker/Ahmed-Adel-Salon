export const statusMap = {
  WAITING: {
    key: "WAITING",
    label: "قادم",
    variant: "info",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-300",
    dot: "bg-blue-500",
  },
  CONFIRMED: {
    key: "CONFIRMED",
    label: "مؤكد",
    variant: "warning",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-300",
    dot: "bg-amber-500",
  },
  IN_PROGRESS: {
    key: "IN_PROGRESS",
    label: "قيد التنفيذ",
    variant: ("accent" as any),
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-300",
    dot: "bg-indigo-500",
  },
  AT_RECEPTION: {
    key: "AT_RECEPTION",
    label: "عند الاستقبال",
    variant: ("successSoft" as any),
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-300",
    dot: "bg-emerald-500",
  },
  AT_CASHIER: {
    key: "AT_CASHIER",
    label: "عند الكاشير",
    variant: "success",
    color: "text-emerald-600",
    bg: "bg-emerald-600/10",
    border: "border-emerald-400",
    dot: "bg-emerald-600",
  },
  DONE: {
    key: "DONE",
    label: "مكتمل",
    variant: "secondary",
    color: "text-slate-400",
    bg: "bg-slate-400/10",
    border: "border-slate-300",
    dot: "bg-slate-400",
  },
  CANCELLED: {
    key: "CANCELLED",
    label: "ملغي",
    variant: "danger",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-300",
    dot: "bg-rose-500",
  },
  NO_SHOW: {
    key: "NO_SHOW",
    label: "لم يحضر",
    variant: "danger",
    color: "text-rose-700",
    bg: "bg-rose-700/10",
    border: "border-rose-500",
    dot: "bg-rose-700",
  },
  LATE: {
    key: "LATE",
    label: "متأخر",
    variant: "warning",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-300",
    dot: "bg-orange-500",
  },
};

export function normalizeStatus(status) {
  const value = String(status || "").toUpperCase();
  const map = {
    PENDING: "WAITING",
    SCHEDULED: "WAITING",
    WAITING: "WAITING",
    CONFIRMED: "CONFIRMED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "AT_RECEPTION",
    READY_FOR_PAYMENT: "AT_CASHIER",
    DONE: "DONE",
    CANCELLED: "CANCELLED",
    NO_SHOW: "NO_SHOW",
    NOSHOW: "NO_SHOW",
    LATE: "LATE",
  };
  return map[value] || "WAITING";
}

export function getStatusConfig(status) {
  const normalized = normalizeStatus(status);
  return statusMap[normalized] || statusMap.WAITING;
}

export const SLOT_MINUTES = 30;
export const ROW_HEIGHT = 108;
export const ROW_GAP = 12;
export const ROW_BLOCK = ROW_HEIGHT + ROW_GAP;

export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  const lower = String(timeStr);
  let hours = h;
  if ((lower.includes("م") && hours < 12) || lower.toLowerCase().includes("pm"))
    hours += 12;
  if (
    ((lower.includes("ص") && hours === 12) ||
      (lower.toLowerCase().includes("am") && hours === 12)) &&
    hours === 12
  )
    hours = 0;
  return hours * 60 + m;
}

export function minutesToTime24(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function slotLabelToTime24(slotLabel) {
  const minutes = timeToMinutes(slotLabel);
  return minutes === null ? slotLabel : minutesToTime24(minutes);
}

export function formatTimeLabel24(date) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function buildSlots(startHour, endHour) {
   
  const slots: any[] = [];
  const start = new Date();
  start.setHours(startHour, 0, 0, 0);
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  for (let i = 0; i <= totalSlots; i += 1) {
    const current = new Date(start.getTime() + i * SLOT_MINUTES * 60 * 1000);
    slots.push(formatTimeLabel24(current));
  }
  return slots;
}

export function getAppointmentDuration(appointment) {
  if (typeof appointment.duration_minutes === "number")
    return appointment.duration_minutes;
  if (typeof appointment.duration_min === "number")
    return appointment.duration_min;
  if (Array.isArray(appointment.services)) {
    const total = appointment.services.reduce(
      (sum, s) =>
        sum + (Number(s.duration_minutes || s.duration_min || s.duration) || 0),
      0,
    );
    if (total > 0) return total;
  }
  if (appointment.total_duration) {
    const n = parseInt(appointment.total_duration);
    if (!isNaN(n)) return n;
  }
  return null;
}

export function isPastTime(appointment, now) {
  const minutes = timeToMinutes(
    appointment.appointment_time || appointment.appointmentTime,
  );
  if (minutes === null) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return minutes < nowMinutes;
}
