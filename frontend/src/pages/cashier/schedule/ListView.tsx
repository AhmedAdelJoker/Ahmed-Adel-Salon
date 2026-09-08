import { memo, useMemo } from "react";
import { Clock3 } from "lucide-react";
import { cn, formatTime12h } from "@/lib/core/utils";
import { getStatusConfig, getAppointmentDuration } from "@/pages/cashier/schedule/scheduleUtils";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Phone, Scissors } from "lucide-react";

const ListView = memo(function ListView({
  appointments,
  selectedDate,
  onOpenDetails,
}: any) {
  const sorted = useMemo(
    () =>
      [...appointments]
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

  const summary = useMemo(() => {
    const counts = {
      WAITING: 0,
      CONFIRMED: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      CANCELLED: 0,
    };
    for (const a of sorted) {
      const k = getStatusConfig(a.status).key;
      if (k in counts) counts[k] += 1;
    }
    return counts;
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-6">
        <div className="bg-soft p-10 rounded-[3rem] border border-border shadow-inner">
          <CalendarDays size={56} className="text-muted/30" />
        </div>
        <p className="text-xl font-black text-main">
          لا توجد مواعيد في هذا اليوم
        </p>
        <p className="text-muted font-bold text-sm">
          استخدم زر "حجز جديد" لإضافة أول موعد اليوم.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(summary)
          .filter(([, n]) => n > 0)
          .map(([key, n]) => {
            const cfg = getStatusConfig(key);
            return (
              <Badge
                key={key}
                className={cn(
                  "text-[10px] px-3 py-1 font-black rounded-xl border-none gap-1.5",
                  cfg.color,
                  cfg.bg,
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                {cfg.label}: {n}
              </Badge>
            );
          })}
      </div>

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3.5 bg-soft/70 border-b border-border/60 text-[9px] font-black text-muted uppercase tracking-widest">
          <div className="col-span-3">الوقت</div>
          <div className="col-span-3">العميل</div>
          <div className="col-span-2 hidden md:block">الموظف</div>
          <div className="col-span-2 hidden lg:block">الخدمة</div>
          <div className="col-span-2 hidden sm:block">الهاتف</div>
          <div className="col-span-2">الحالة</div>
        </div>
        <div className="divide-y divide-border/40">
          {sorted.map((appt, i) => {
            const status = getStatusConfig(appt.status);
            const dur = getAppointmentDuration(appt);
            const service =
              Array.isArray(appt.services) && appt.services.length > 0
                ? appt.services
                    .map((s) => s.service_name || s.name)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("، ")
                : appt.service_name || "—";
            return (
              <button
                key={appt.id}
                onClick={() => onOpenDetails?.(appt)}
                className={cn(
                  "w-full text-right grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-soft/60 transition-colors group cursor-pointer",
                  i % 2 === 1 && "bg-soft/30",
                )}
              >
                <div className="col-span-3 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Clock3 size={15} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-main tabular-nums">
                      {formatTime12h(
                        String(
                          appt.appointment_time || appt.appointmentTime,
                        ).slice(0, 5),
                      )}
                    </p>
                    {dur != null && (
                      <p className="text-[8px] font-bold text-muted">
                        {dur} دقيقة
                      </p>
                    )}
                  </div>
                </div>
                <div className="col-span-3 min-w-0">
                  <p className="text-xs font-black text-main truncate group-hover:text-accent transition-colors">
                    {appt.customer_name || "عميل مجهول"}
                  </p>
                  {appt.booking_source === "online" && (
                    <p className="text-[8px] font-bold text-sky-500">
                      حجز أونلاين
                    </p>
                  )}
                </div>
                <div className="col-span-2 hidden md:block">
                  <p className="text-[10px] font-bold text-muted truncate">
                    {appt.barber_name || appt.employee_name || "—"}
                  </p>
                </div>
                <div className="col-span-2 hidden lg:flex items-center gap-1.5 min-w-0">
                  <Scissors size={11} className="text-accent shrink-0" />
                  <p className="text-[10px] font-bold text-muted truncate">
                    {service}
                  </p>
                </div>
                <div className="col-span-2 hidden sm:flex items-center gap-1.5 min-w-0">
                  <Phone size={11} className="text-muted shrink-0" />
                  <p
                    className="text-[10px] font-bold text-muted truncate"
                    dir="ltr"
                  >
                    {appt.customer_phone || "—"}
                  </p>
                </div>
                <div className="col-span-2 flex justify-end">
                  <Badge
                    className={cn(
                      "text-[9px] px-2.5 py-1 font-black rounded-lg border-none",
                      status.color,
                      status.bg,
                    )}
                  >
                    {status.label}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default ListView;
