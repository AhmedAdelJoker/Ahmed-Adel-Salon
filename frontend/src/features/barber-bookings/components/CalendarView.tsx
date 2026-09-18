import { Calendar, ChevronLeft, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";
import type {
  BarberAppointment,
  CalendarDay,
  StatusVariant,
} from "@/features/barber-bookings/hooks/useBarberBookings";

interface CalendarViewProps {
  calendarMonth: Date;
  setCalendarMonth: (date: Date) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  getCalendarDays: () => (CalendarDay | null)[];
  appointments: BarberAppointment[];
  statusLabels: Record<string, string>;
  statusColors: Record<string, StatusVariant>;
}

export const CalendarView = ({
  calendarMonth,
  setCalendarMonth,
  selectedDate,
  setSelectedDate,
  getCalendarDays,
  appointments,
  statusLabels,
  statusColors,
}: CalendarViewProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() =>
              setCalendarMonth(
                new Date(
                  calendarMonth.getFullYear(),
                  calendarMonth.getMonth() - 1,
                ),
              )
            }
            className="h-9 w-9 rounded-lg border border-border hover:bg-soft flex items-center justify-center"
          >
            <ChevronRight size={16} />
          </button>
          <span className="text-sm font-black text-main">
            {calendarMonth.toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "long",
            })}
          </span>
          <button
            onClick={() =>
              setCalendarMonth(
                new Date(
                  calendarMonth.getFullYear(),
                  calendarMonth.getMonth() + 1,
                ),
              )
            }
            className="h-9 w-9 rounded-lg border border-border hover:bg-soft flex items-center justify-center"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"].map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-black text-muted py-2"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {getCalendarDays().map((day, i) => (
            <button
              key={i}
              onClick={() => day && setSelectedDate(day.date)}
              className={cn(
                "min-h-[50px] rounded-lg border p-1 text-center transition-all",
                day
                  ? day.isToday
                    ? "border-primary bg-primary/5"
                    : "border-border/50 hover:bg-soft"
                  : "border-transparent",
                selectedDate === day?.date && "ring-2 ring-primary",
              )}
            >
              {day && (
                <>
                  <span
                    className={cn(
                      "text-[10px] font-black",
                      day.isToday ? "text-primary" : "text-main",
                    )}
                  >
                    {day.day}
                  </span>
                  {day.count > 0 && (
                    <div className="mt-1 flex justify-center gap-0.5 flex-wrap">
                      {day.hasPending && (
                        <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                      )}
                      {day.hasCompleted && (
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      )}
                      <span className="text-[8px] font-bold text-muted">
                        {day.count}
                      </span>
                    </div>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedDate && (
        <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-black text-main">
              مواعيد{" "}
              {new Date(selectedDate).toLocaleDateString("ar-EG", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {appointments.filter((a) => a.appointment_date === selectedDate).length >
            0 ? (
              appointments
                .filter((a) => a.appointment_date === selectedDate)
                .map((apt) => (
                  <div key={apt.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-soft flex items-center justify-center">
                          <User size={14} className="text-muted" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-main">
                            {apt.customer_name}
                          </p>
                          <p className="text-[10px] font-bold text-muted">
                            {apt.service_name} • {apt.start_time}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={statusColors[apt.status] || "secondary"}
                        className="h-6 px-3 text-[9px] font-black"
                      >
                        {statusLabels[apt.status] || apt.status}
                      </Badge>
                    </div>
                  </div>
                ))
            ) : (
              <div className="p-8 text-center">
                <Calendar size={32} className="mx-auto mb-2 text-muted" />
                <p className="text-xs font-bold text-muted">لا توجد مواعيد في هذا اليوم</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
