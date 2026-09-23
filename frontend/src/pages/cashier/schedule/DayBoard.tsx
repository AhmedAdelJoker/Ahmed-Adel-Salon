import { memo, useState, useEffect, useRef } from "react";
import { User, CalendarClock } from "lucide-react";
import { cn } from "@/lib/core/utils";
import {
  ROW_HEIGHT,
  ROW_GAP,
  ROW_BLOCK,
  isPastTime,
} from "@/pages/cashier/schedule/scheduleUtils";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { BarberColumn } from "@/features/schedule/components/DayBoard/BarberColumn";
import {
  BARBER_COL_MIN,
  TIME_COL_WIDTH,
} from "@/features/schedule/components/DayBoard/constants";
import { slotTo24 } from "@/features/schedule/components/DayBoard/utils";

type DayBoardBarber = {
  id: string | number;
  appointments: Array<Record<string, unknown> & { id: string | number }>;
  display_name?: string | null;
  full_name?: string | null;
  profile_image_url?: string | null;
  profileImageUrl?: string | null;
  [key: string]: unknown;
};

interface DayBoardProps {
  slots: string[];
  barbers: DayBoardBarber[];
  operatingHours?: { start?: number; end?: number; slots?: string[] } | null;
  onDrop: (barberId: string | number, slot: string) => void;
  onOpenDetails: (appointment: unknown) => void;
  isDraggingAny: boolean;
  draggingId?: unknown;
}

const DayBoard = memo(function DayBoard({
  slots,
  barbers,
  operatingHours,
  onDrop,
  onOpenDetails,
  isDraggingAny,
}: DayBoardProps) {
  const [now, setNow] = useState(() => new Date());

  const headerRef = useRef<HTMLDivElement>(null);

  const gutterRef = useRef<HTMLDivElement>(null);

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
    <div className="scroll-x overflow-y-auto custom-scrollbar max-h-[72vh] rounded-2xl">
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
                      (barber.profile_image_url as string | undefined) ??
                      (barber.profileImageUrl as string | undefined)
                    }
                    name={
                      (barber.display_name as string | undefined) ??
                      (barber.full_name as string | undefined) ??
                      ""
                    }
                    size="lg"
                    className="h-12 w-12 rounded-xl border-2 border-accent/20 group-hover:border-accent transition-all duration-500 shadow-md"
                    role={undefined}
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-card shadow-md" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-main truncate">
                      {(barber.display_name as string | undefined) ??
                        (barber.full_name as string | undefined)}
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
                  isPastTime(
                    { appointment_time: slotTo24(slot) } as unknown as Parameters<
                      typeof isPastTime
                    >[0],
                    now,
                  )
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
              barber={
                barber as unknown as Parameters<typeof BarberColumn>[0]["barber"]
              }
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

export default DayBoard;
