import { memo, useMemo, useState, useEffect, useRef } from "react";
import { Plus, User, CalendarClock } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
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
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";

const TIME_COL_WIDTH = 76;
const BARBER_COL_MIN = 232;
const dirIsRtl = true;

function hourLineClass(index) {
  return index % 2 === 0;
}

const MAX_LANES = 4;

function computeLanes(appointments) {
  if (appointments.length === 0) return { lanes: 1, layout: {} };
  const sorted = [...appointments].sort(
    (a, b) =>
      (timeToMinutes(a.appointment_time || a.appointmentTime) || 0) -
      (timeToMinutes(b.appointment_time || b.appointmentTime) || 0),
  );
   
  const laneEnds: any[] = [];
   
  const layout: Record<string, any> = {};
  let maxLanes = 1;
  for (const appt of sorted) {
    const start =
      timeToMinutes(appt.appointment_time || appt.appointmentTime) || 0;
    const dur = getAppointmentDuration(appt) || SLOT_MINUTES;
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

function SlotDropZone({
  barberId,
  slot,
  isDragActive,
  onDrop,
  hasAppointment,
  index,
}: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${barberId}:${slot}`,
    data: { type: "slot", barberId, slot },
  });

  const highlighted = isDragActive && isOver;

  return (
    <div
      ref={setNodeRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(barberId, slot);
      }}
      className={cn(
        "absolute right-0 left-0 rounded-xl border-l border-r border-dashed transition-all duration-200 group",
        highlighted
          ? "bg-accent/15 border-accent shadow-premium z-20"
          : "border-transparent hover:bg-accent/[0.04]",
        hasAppointment && "pointer-events-none",
      )}
      style={{ top: index * ROW_BLOCK, height: ROW_HEIGHT }}
      role="gridcell"
      aria-label={`خانة ${slot} - موظف رقم ${barberId}`}
    >
      {!hasAppointment && highlighted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="h-10 w-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30">
            <Plus size={20} strokeWidth={3} />
          </div>
          <span className="text-[9px] font-black text-accent mt-2 tracking-widest">
            أفلت هنا
          </span>
        </div>
      )}
    </div>
  );
}

const BarberColumn = memo(function BarberColumn({
  barber,
  slots,
  startHour,
  onDrop,
  isDragActive,
  onOpenDetails,
  now,
}: any) {
  const colHeight = useMemo(() => {
    const n = slots.length;
    return n * ROW_HEIGHT + (n - 1) * ROW_GAP;
  }, [slots]);

  const dayStartMinutes = startHour * 60;

  const { lanes, layout } = useMemo(
    () => computeLanes(barber.appointments),
    [barber.appointments],
  );

  const positioned = useMemo(() => {
    const dayEndMinutes = dayStartMinutes + slots.length * SLOT_MINUTES;
    return barber.appointments.map((appt) => {
      const start = timeToMinutes(
        appt.appointment_time || appt.appointmentTime,
      );
      const dur = getAppointmentDuration(appt) || SLOT_MINUTES;
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
          other.appointment_time || other.appointmentTime,
        );
        if (os === null || start === null) return false;
        const oe = os + (getAppointmentDuration(other) || SLOT_MINUTES);
        const e = start + dur;
        return start < oe && os < e;
      });
      const past = isPastTime(appt, now);
      return {
        appt,
        style: {
          top,
          height,
          width: `calc(${widthPct}% - 6px)`,
          [dirIsRtl ? "right" : "left"]: `calc(${leftPct}% + 3px)`,
          zIndex: lane + 5,
        },
        conflict: appt._conflict === true || overlaps,
        compact: height < 140,
        ultraCompact: height < 100,
        past,
        atDayEdge:
          start === null ||
          start < dayStartMinutes ||
          start + dur > dayEndMinutes,
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
              appointment={{ ...appt, _conflict: conflict }}
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

const DayBoard = memo(function DayBoard({
  slots,
  barbers,
  operatingHours,
  onDrop,
  onOpenDetails,
  isDraggingAny,
}: any) {
  const [now, setNow] = useState(() => new Date());
   
  const headerRef = useRef<any>(null);
   
  const gutterRef = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const startHour = operatingHours?.start ?? 9;

  if (barbers.length === 0) {
    return (
      <div className="py-32 text-center flex flex-col items-center gap-8">
        <div className="bg-soft p-12 rounded-[4rem] border border-border shadow-inner">
          <User size={80} className="text-muted/30" />
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-black text-main">لا توجد بيانات موظفين</p>
          <p className="text-muted font-bold max-w-md mx-auto">
            يرجى اختيار فلتر مختلف أو التأكد من إضافة الموظفين وجداول عملهم في
            النظام.
          </p>
        </div>
      </div>
    );
  }

  const totalSlots = slots.length;
  const bodyHeight = totalSlots * ROW_HEIGHT + (totalSlots - 1) * ROW_GAP;
  const gridTemplate = `${TIME_COL_WIDTH}px repeat(${barbers.length}, minmax(${BARBER_COL_MIN}px, 1fr))`;

  return (
    <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[72vh] rounded-2xl">
      <div className="min-w-[640px]">
        <div
          ref={headerRef}
          className="grid gap-3 mb-3 sticky top-0 z-40"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="sticky right-0 z-50 bg-card backdrop-blur-xl rounded-2xl border border-border shadow-sm flex items-center justify-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
            <CalendarClock size={14} className="text-accent" />
            <span className="hidden 2xl:inline">الجدول الزمني</span>
          </div>

          {barbers.map((barber) => {
            const loadPercent = Math.min(
              100,
              Math.round(
                (barber.appointments.length / Math.max(1, totalSlots)) * 100,
              ),
            );
            const loadColor =
              loadPercent >= 90
                ? "bg-rose-500"
                : loadPercent >= 70
                  ? "bg-amber-500"
                  : "bg-emerald-500";
            return (
              <div
                key={barber.id}
                className="bg-card/95 backdrop-blur-xl rounded-2xl border border-border shadow-sm px-4 py-3 flex items-center gap-4 group hover:border-accent/40 transition-all duration-300"
              >
                <div className="relative shrink-0">
                  <EmployeeAvatar
                    imageUrl={
                      barber.profile_image_url || barber.profileImageUrl
                    }
                    name={barber.display_name || barber.full_name}
                    size="lg"
                    className="h-12 w-12 rounded-xl border-2 border-accent/20 group-hover:border-accent transition-all duration-500 shadow-md"
                   role={undefined} />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-card shadow-md" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-main truncate">
                      {barber.display_name || barber.full_name}
                    </p>
                    <Badge
                      variant="secondary"
                      className="bg-accent/10 text-accent border-none font-black text-[9px] px-2 py-0.5 rounded-lg shrink-0"
                    >
                      {barber.appointments.length} موعد
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1.5 flex-1 rounded-full bg-border/60 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          loadColor,
                        )}
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-black text-muted tabular-nums w-7 text-left">
                      {loadPercent}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div
            ref={gutterRef}
            className="relative rounded-2xl sticky right-0 z-30 bg-card backdrop-blur-xl"
            style={{ height: bodyHeight }}
          >
            {slots.map((slot, i) => (
              <div
                key={slot}
                className={cn(
                  "absolute right-0 left-0 flex flex-col items-center justify-center rounded-xl transition-all",
                  isPastTime({ appointment_time: slotTo24(slot) }, now)
                    ? "text-muted/40"
                    : "text-muted group-hover:bg-card",
                )}
                style={{ top: i * ROW_BLOCK, height: ROW_HEIGHT }}
              >
                <span
                  className={cn(
                    "font-black tabular-nums",
                    i % 2 === 0
                      ? "text-[13px] text-main"
                      : "text-[10px] text-muted",
                  )}
                >
                  {slot.split(" ")[0]}
                </span>
                <span className="text-[8px] text-muted uppercase mt-0.5 tracking-widest">
                  {slot.split(" ")[1]}
                </span>
              </div>
            ))}
          </div>

          {barbers.map((barber) => (
            <BarberColumn
              key={barber.id}
              barber={barber}
              slots={slots}
              startHour={startHour}
              onDrop={onDrop}
              isDragActive={isDraggingAny}
              onOpenDetails={onOpenDetails}
              now={now}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

function slotTo24(label) {
  const [h] = label.split(" ");
  const [hh, mm] = h.split(":").map(Number);
  let hours = hh;
  if (label.includes("م") && hours < 12) hours += 12;
  if (label.includes("ص") && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default DayBoard;
