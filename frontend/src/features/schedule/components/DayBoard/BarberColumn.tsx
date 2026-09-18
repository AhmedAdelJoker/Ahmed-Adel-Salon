import { memo, useMemo } from "react";
import { cn } from "@/lib/core/utils";
import AppointmentCard from "@/pages/cashier/schedule/AppointmentCard";
import {
  SLOT_MINUTES,
  ROW_HEIGHT,
  ROW_GAP,
  ROW_BLOCK,
  timeToMinutes,
  getAppointmentDuration,
  isPastTime,
} from "@/pages/cashier/schedule/scheduleUtils";
import { SlotDropZone } from "@/features/schedule/components/DayBoard/SlotDropZone";
import { computeLanes, hourLineClass } from "@/features/schedule/components/DayBoard/utils";
import { dirIsRtl } from "@/features/schedule/components/DayBoard/constants";

type BarberAppointment = {
  id: string | number;
  appointment_time?: string | null;
  appointmentTime?: string | null;
  _conflict?: boolean;
  [key: string]: unknown;
};

type Barber = {
  id: string | number;
  appointments: BarberAppointment[];
  profile_image_url?: string | null;
  profileImageUrl?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  [key: string]: unknown;
};

export interface BarberColumnProps {
  barber: Barber;
  slots: string[];
  startHour: number;
  onDrop: (barberId: string | number, slot: string) => void;
  isDragActive: boolean;
  onOpenDetails: (appointment: BarberAppointment) => void;
  now: Date;
}

export const BarberColumn = memo(function BarberColumn({
  barber,
  slots,
  startHour,
  onDrop,
  isDragActive,
  onOpenDetails,
  now,
}: BarberColumnProps) {
  const colHeight = useMemo(() => {
    const n = slots.length;
    return n * ROW_HEIGHT + (n - 1) * ROW_GAP;
  }, [slots]);

  const dayStartMinutes = startHour * 60;

  const { lanes, layout } = useMemo(
    () => computeLanes(barber.appointments as unknown as Parameters<typeof computeLanes>[0]),
    [barber.appointments],
  );

  const positioned = useMemo(() => {
    const dayEndMinutes = dayStartMinutes + slots.length * SLOT_MINUTES;
    return barber.appointments.map((appt) => {
      const start = timeToMinutes(
        (appt.appointment_time as string | undefined) ??
          (appt.appointmentTime as string | undefined),
      );
      const dur =
        getAppointmentDuration(
          appt as unknown as Parameters<typeof getAppointmentDuration>[0],
        ) ?? SLOT_MINUTES;
      const clampedStart = Math.max(start ?? dayStartMinutes, dayStartMinutes);
      const startIndex = (clampedStart - dayStartMinutes) / SLOT_MINUTES;
      const blocks = Math.max(1, Math.ceil(dur / SLOT_MINUTES));
      const maxIndex = Math.max(1, slots.length - 1);
      const clampedIndex = Math.min(Math.max(startIndex, 0), maxIndex - 1);
      const spanBlocks = Math.min(
        blocks,
        Math.max(1, slots.length - clampedIndex),
      );
      const top = clampedIndex * ROW_BLOCK + 3;
      const height = spanBlocks * ROW_BLOCK - ROW_GAP - 6;
      const lane = layout[String(appt.id)] ?? 0;
      const widthPct = 100 / lanes;
      const leftPct = lane * widthPct;
      const overlaps = barber.appointments.some((other) => {
        if (String(other.id) === String(appt.id)) return false;
        const os = timeToMinutes(
          (other.appointment_time as string | undefined) ??
            (other.appointmentTime as string | undefined),
        );
        if (os === null || start === null) return false;
        const oe =
          os +
          (getAppointmentDuration(
            other as unknown as Parameters<typeof getAppointmentDuration>[0],
          ) ?? SLOT_MINUTES);
        const e = (start as number) + dur;
        return (start as number) < oe && (os as number) < e;
      });
      const past = isPastTime(
        appt as unknown as Parameters<typeof isPastTime>[0],
        now,
      );
      return {
        appt,
        style: {
          top,
          height,
          width: `calc(${widthPct}% - 6px)`,
          [dirIsRtl ? "right" : "left"]: `calc(${leftPct}% + 3px)`,
          zIndex: lane + 5,
        } as React.CSSProperties,
        conflict: appt._conflict === true || overlaps,
        compact: height < 140,
        ultraCompact: height < 100,
        past,
        atDayEdge:
          start === null ||
          start < dayStartMinutes ||
          (start as number) + dur > dayEndMinutes,
      };
    });
  }, [barber.appointments, slots, lanes, layout, dayStartMinutes, now]);

  const nowPos = useMemo(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const h = Number(startHour);
    if (hours < h || hours >= h + slots.length * (SLOT_MINUTES / 60))
      return null;
    return (((hours - h) * 60 + minutes) / SLOT_MINUTES) * ROW_BLOCK + 4;
  }, [now, startHour, slots]);

  return (
    <div className="relative" style={{ height: colHeight }}>
      {slots.map((slot, i) => (
        <div
          key={`line-${slot}`}
          className={cn(
            "absolute right-0 left-0 pointer-events-none",
            i === slots.length - 1 ? "hidden" : "",
          )}
          style={{
            top: i * ROW_BLOCK + ROW_HEIGHT + ROW_GAP / 2 - 0.5,
            height: 1,
          }}
        >
          <div
            className={cn(
              "w-full",
              hourLineClass(i + 1)
                ? "bg-border/80 border-t border-border/70"
                : "bg-border/40 border-t border-dashed border-border/40",
            )}
          />
        </div>
      ))}

      {slots.map((slot, i) => (
        <SlotDropZone
          key={`${barber.id}-${slot}`}
          barberId={barber.id}
          slot={slot}
          index={i}
          isDragActive={isDragActive}
          hasAppointment={false}
          onDrop={onDrop}
        />
      ))}

      {positioned.map(
        ({ appt, style, conflict, compact, ultraCompact, past, atDayEdge }) => (
          <div
            key={`card-wrap-${appt.id}`}
            className={cn(
              "absolute",
              past && "opacity-40 grayscale-[0.4]",
              atDayEdge && "opacity-70",
            )}
            style={style}
          >
            <AppointmentCard
              appointment={{ ...(appt as object), _conflict: conflict } as unknown as Parameters<typeof AppointmentCard>[0] extends { appointment: infer P } ? P : never}
              onOpenDetails={onOpenDetails}
              compact={compact}
              ultraCompact={ultraCompact}
              className={cn("inset-0")}
            />
          </div>
        ),
      )}

      {nowPos !== null && (
        <div
          className="absolute right-0 left-0 z-30 pointer-events-none flex items-center"
          style={{ top: nowPos }}
        >
          <div className="h-[2px] w-full bg-rose-500/80 rounded-full shadow-lg shadow-rose-500/30" />
          <div className="absolute right-[-6px] -translate-y-1/2 w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-lg shadow-rose-500/40" />
        </div>
      )}
    </div>
  );
});

export default BarberColumn;
