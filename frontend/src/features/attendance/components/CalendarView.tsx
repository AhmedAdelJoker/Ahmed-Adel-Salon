import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { buildCalendarDays, type TranslateFn } from "@/features/attendance/utils/attendance";
import type { AttendanceRecord, WorkingHours } from "@/features/attendance/types";

export default function CalendarView({
  records,
  calendarMonth,
  setCalendarMonth,
  workingHours,
  t,
  locale,
}: {
  records: AttendanceRecord[];
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  workingHours: WorkingHours;
  t: TranslateFn;
  locale: string;
}) {
  const days = buildCalendarDays(records, calendarMonth, workingHours);
  const weekDayKeys = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: "short" }),
  );

  return (
    <div className="space-y-4" id="attendance-panel-calendar" role="tabpanel" aria-labelledby="attendance-tab-calendar">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-main">
            <CalendarDays size={18} className="text-primary" /> {t("attendance.calendarTitle")}
          </h3>
          <p className="mt-1 text-xs font-medium text-muted">{t("attendance.calendarHint")}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronRight size={16} className="rtl:rotate-180" />
          </Button>
          <div className="min-w-[140px] px-2 text-center text-sm font-black text-main">
            {calendarMonth.toLocaleDateString(locale, { month: "long", year: "numeric" })}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronLeft size={16} className="rtl:rotate-180" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {weekDayKeys.map((d, i) => (
            <div key={i} className="pb-1 text-center text-[10px] font-black uppercase tracking-wide text-muted">
              {d}
            </div>
          ))}
          {days.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="min-h-[92px] rounded-xl bg-muted/5" />;
            const closed = day.workingHours?.is_open === false;
            return (
              <div
                key={day.date}
                className={cn(
                  "min-h-[92px] rounded-xl border p-2 transition-colors",
                  day.isToday
                    ? "border-primary/30 bg-primary/5 ring-1 ring-primary/10"
                    : "border-border/70 bg-card hover:bg-muted/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-black tabular-nums", day.isToday ? "text-primary" : "text-main")}>{day.day}</span>
                  {closed && <span className="text-[9px] font-bold text-muted">{t("attendance.dayOff")}</span>}
                </div>
                {day.presentCount > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      {t("attendance.presentCount", { count: day.presentCount })}
                    </div>
                    {day.lateCount > 0 && (
                      <div className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                        {t("attendance.lateCount", { count: day.lateCount })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
