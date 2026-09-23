import {
  SLOT_MINUTES,
  getAppointmentDuration,
  timeToMinutes,
} from "@/pages/cashier/schedule/scheduleUtils";
import { MAX_LANES } from "@/features/schedule";

export function hourLineClass(index: number): boolean {
  return index % 2 === 0;
}

type AppointmentInput = {
  id: string | number;
  appointment_time?: string | null;
  appointmentTime?: string | null;
  [key: string]: unknown;
};

export function computeLanes(
  appointments: AppointmentInput[],
): { lanes: number; layout: Record<string, number> } {
  if (appointments.length === 0) return { lanes: 1, layout: {} };
  const sorted = [...appointments].sort((a, b) => {
    const ta =
      timeToMinutes(
        (a.appointment_time as string | undefined) ??
          (a.appointmentTime as string | undefined),
      ) ?? 0;
    const tb =
      timeToMinutes(
        (b.appointment_time as string | undefined) ??
          (b.appointmentTime as string | undefined),
      ) ?? 0;
    return ta - tb;
  });

  const laneEnds: number[][] = [];
  const layout: Record<string, number> = {};
  let maxLanes = 1;
  for (const appt of sorted) {
    const start =
      timeToMinutes(
        (appt.appointment_time as string | undefined) ??
          (appt.appointmentTime as string | undefined),
      ) ?? 0;
    const dur =
      getAppointmentDuration(
        appt as unknown as Parameters<typeof getAppointmentDuration>[0],
      ) ?? SLOT_MINUTES;
    const end = start + dur;
    let lane = laneEnds.findIndex((ends) => ends.every((e) => start >= e));
    if (lane === -1) {
      if (laneEnds.length < MAX_LANES) {
        lane = laneEnds.length;
        laneEnds.push([]);
      } else {
        lane = 0;
        laneEnds[0] = [];
      }
    }
    laneEnds[lane].push(end);
    layout[String(appt.id)] = lane;
    maxLanes = Math.max(maxLanes, lane + 1);
  }
  return { lanes: maxLanes, layout };
}

export function slotTo24(label: string): string {
  const [h] = label.split(" ");
  const [hh, mm] = h.split(":").map(Number);
  let hours = hh;
  if (label.includes("م") && hours < 12) hours += 12;
  if (label.includes("ص") && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
