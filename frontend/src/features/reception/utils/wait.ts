/** Reception feature: waiting-time helpers (moved verbatim). */
export function getWaitMinutes(appt: Record<string, unknown> | null | undefined, now: number): number | null {
  if (!appt) return null;
  const status = String(appt.status || "").toLowerCase();
  let start: Date | null = null;
  if (status === "in_progress") {
    if (appt.updated_at) start = new Date(String(appt.updated_at));
  } else {
    const dateStr = appt.appointment_date;
    const timeStr = String(appt.appointment_time || "").slice(0, 5);
    if (dateStr && timeStr) start = new Date(`${dateStr}T${timeStr}:00`);
  }
  if (!start || isNaN(start.getTime())) return null;
  return Math.floor((now - start.getTime()) / 60000);
}

export function formatWait(mins: number | null | undefined): string | null {
  if (mins == null || mins < 0) return null;
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `منذ ${h} س ${m} د` : `منذ ${h} س`;
}
