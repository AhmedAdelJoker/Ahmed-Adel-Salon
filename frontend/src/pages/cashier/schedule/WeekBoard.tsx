import { memo, useMemo } from "react";
import { cn, formatTime12h } from "@/lib/core/utils";
import { getStatusConfig } from "@/pages/cashier/schedule/scheduleUtils";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";

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

const WeekBoard = memo(function WeekBoard({
  appointments,
  selectedDate,
  onOpenDetails,
}: any) {
  const weekStart = useMemo(() => {
    const d = parseDateInput(selectedDate);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d;
  }, [selectedDate]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return {
          date: formatDateInput(d),
          label: d.toLocaleDateString("ar-EG", { weekday: "long" }),
          shortLabel: d.toLocaleDateString("ar-EG", {
            day: "2-digit",
            month: "short",
          }),
        };
      }),
    [weekStart],
  );

  const groupedByDay = useMemo(() => {
     
    const map: Record<string, any> = {};
    for (const day of weekDays) map[day.date] = [];
    for (const appt of appointments) {
      const date = appt.appointment_date || appt.appointmentDate;
      if (map[date]) {
        map[date].push(appt);
      }
    }
    for (const day of weekDays) {
      map[day.date].sort((a, b) =>
        (a.appointment_time || a.appointmentTime || "").localeCompare(
          b.appointment_time || b.appointmentTime || "",
        ),
      );
    }
    return map;
  }, [appointments, weekDays]);

  const todayStr = formatDateInput(new Date());

  return (
    <div className="overflow-x-auto custom-scrollbar pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 min-w-[720px] sm:min-w-0 xl:min-w-0">
        {weekDays.map((day) => {
          const dayAppts = groupedByDay[day.date];
          const isToday = day.date === todayStr;

          return (
            <div
              key={day.date}
              className={cn(
                "rounded-2xl p-4 flex flex-col gap-3 min-h-[420px] lg:min-h-[480px] transition-all",
                isToday
                  ? "bg-accent/5 ring-2 ring-accent/20 shadow-premium"
                  : "bg-soft/40 border border-border/60",
              )}
            >
              <div className="text-center space-y-0.5">
                <p
                  className={cn(
                    "text-[11px] font-black uppercase tracking-widest",
                    isToday ? "text-accent" : "text-muted",
                  )}
                >
                  {day.label}
                </p>
                <p className="text-lg font-black text-main">{day.shortLabel}</p>
                <p className="text-[9px] font-bold text-muted">
                  {dayAppts.length} موعد
                </p>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar pr-0.5">
                {dayAppts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <CalendarDays size={32} className="text-muted" />
                    <p className="text-[10px] font-bold mt-2">لا يوجد مواعيد</p>
                  </div>
                ) : (
                  dayAppts.map((appt) => {
                    const status = getStatusConfig(appt.status);
                    return (
                      <div
                        key={appt.id}
                        onClick={() => onOpenDetails?.(appt)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenDetails?.(appt);
                          }
                        }}
                        className="p-3.5 bg-card rounded-2xl shadow-sm border border-border/60 space-y-2.5 hover:shadow-md hover:border-accent/30 transition-all group relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        {appt.booking_source === "online" && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-sky-500" />
                        )}
                        <div className="flex justify-between items-start gap-2 min-w-0">
                          <p className="text-xs font-black text-main truncate">
                            {appt.customer_name || "عميل مجهول"}
                          </p>
                          <span className="text-[10px] font-black text-accent bg-accent/5 px-2 py-0.5 rounded-lg tabular-nums shrink-0">
                            {formatTime12h(
                              String(
                                appt.appointment_time || appt.appointmentTime,
                              ).slice(0, 5),
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            className={cn(
                              "text-[9px] h-5 px-2 font-black rounded-md border-none",
                              status.color,
                              status.bg,
                            )}
                          >
                            {status.label}
                          </Badge>
                          <p className="text-[9px] font-bold text-muted truncate max-w-[90px]">
                            {appt.barber_name || appt.employee_name || "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default WeekBoard;
