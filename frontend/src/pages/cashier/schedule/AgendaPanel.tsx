import { memo, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { cn, formatTime12h } from "@/lib/core/utils";
import MiniCalendar from "@/pages/cashier/schedule/MiniCalendar";
import { getStatusConfig } from "@/pages/cashier/schedule/scheduleUtils";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import { Activity, CalendarDays } from "lucide-react";

const AgendaPanel = memo(function AgendaPanel({
  selectedDate,
  onSelectDay,
  appointments,
  barbers,
  onOpenDetails,
  isDragActive,
  onClose,
}: any) {
  const dayAppts = useMemo(
    () =>
      appointments
        .filter(
          (a) => (a.appointment_date || a.appointmentDate) === selectedDate,
        )
        .sort((a, b) =>
          (a.appointment_time || a.appointmentTime || "").localeCompare(
            b.appointment_time || b.appointmentTime || "",
          ),
        ),
    [appointments, selectedDate],
  );

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return dayAppts.filter((a) => {
      if (!isToday) return true;
      const [h, m] = String(a.appointment_time || a.appointmentTime)
        .split(":")
        .map(Number);
      return h * 60 + m >= nowMin;
    });
  }, [dayAppts, isToday]);

  const summary = useMemo(() => {
    const done = dayAppts.filter(
      (a) => getStatusConfig(a.status).key === "DONE",
    ).length;
    return { total: dayAppts.length, done, active: dayAppts.length - done };
  }, [dayAppts]);

  const dateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString(
    "ar-EG",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  );

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
      aria-label="الشريط الجانبي للجدول"
    >
      <div className="bg-card rounded-3xl border border-border shadow-sm p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-l from-accent via-accent/50 to-transparent" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">
              التنقل السريع
            </p>
            <p className="text-sm font-black text-main mt-0.5">{dateLabel}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg bg-soft text-muted hover:text-accent transition-all"
              aria-label="إغلاق الشريط الجانبي"
            >
              <ArrowLeft size={16} />
            </button>
          )}
        </div>

        <MiniCalendar
          selectedDate={selectedDate}
          onSelectDay={onSelectDay}
          appointments={appointments}
          isDragActive={isDragActive}
        />

        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-border/60">
          <div className="rounded-2xl bg-soft p-3 text-center">
            <p className="text-xl font-black text-main tabular-nums">
              {summary.total}
            </p>
            <p className="text-[8px] font-black text-muted mt-0.5">
              إجمالي المواعيد
            </p>
          </div>
          <div className="rounded-2xl bg-soft p-3 text-center">
            <p className="text-xl font-black text-accent tabular-nums">
              {summary.active}
            </p>
            <p className="text-[8px] font-black text-muted mt-0.5">نشطة</p>
          </div>
          <div className="rounded-2xl bg-soft p-3 text-center">
            <p className="text-xl font-black text-emerald-500 tabular-nums">
              {summary.done}
            </p>
            <p className="text-[8px] font-black text-muted mt-0.5">مكتملة</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Activity size={15} />
            </div>
            <p className="text-sm font-black text-main">أجندة اليوم</p>
          </div>
          <Badge
            variant="outline"
            className="text-[9px] font-black bg-soft border-border/60"
          >
            {upcoming.length} قادمة
          </Badge>
        </div>

        <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pl-1">
          <AnimatePresence initial={false}>
            {upcoming.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-3 opacity-40">
                <CalendarDays size={28} className="text-muted" />
                <p className="text-[10px] font-bold text-muted">
                  لا توجد مواعيد قادمة
                </p>
              </div>
            ) : (
              upcoming.slice(0, 8).map((appt) => {
                const status = getStatusConfig(appt.status);
                const barber = barbers.find(
                  (b) =>
                    Number(b.id) === Number(appt.barber_id || appt.employee_id),
                );
                return (
                  <motion.button
                    key={appt.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => onOpenDetails?.(appt)}
                    className="w-full text-right flex items-center gap-3 p-3 rounded-2xl bg-soft/70 hover:bg-card hover:shadow-md border border-border/50 hover:border-accent/30 transition-all group cursor-pointer"
                  >
                    <div className="w-14 shrink-0 text-center rounded-xl py-2 border border-border/60 bg-card">
                      <p className="text-[11px] font-black text-main tabular-nums">
                        {
                          formatTime12h(
                            String(
                              appt.appointment_time || appt.appointmentTime,
                            ).slice(0, 5),
                          ).split(" ")[0]
                        }
                      </p>
                      <p className="text-[7px] font-black text-muted">
                        {
                          formatTime12h(
                            String(
                              appt.appointment_time || appt.appointmentTime,
                            ).slice(0, 5),
                          ).split(" ")[1]
                        }
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-main truncate">
                        {appt.customer_name || "عميل مجهول"}
                      </p>
                      <p className="text-[9px] font-bold text-muted truncate mt-0.5">
                        {barber?.display_name ||
                          barber?.full_name ||
                          appt.barber_name ||
                          "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        status.dot,
                      )}
                      title={status.label}
                    />
                  </motion.button>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
});

function Badge({ children, variant, className }: any) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold",
        variant === "outline" && "border",
        className,
      )}
    >
      {children}
    </span>
  );
}

export default AgendaPanel;
