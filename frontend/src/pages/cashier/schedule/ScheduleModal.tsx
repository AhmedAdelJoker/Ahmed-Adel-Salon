import { memo } from "react";
import {
  Phone,
  Clock3,
  CalendarDays,
  Scissors,
  StickyNote,
  User,
  ArrowUpRight,
  Globe,
  Home,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatTime12h } from "@/lib/core/utils";
import { getStatusConfig } from "@/pages/cashier/schedule/scheduleUtils";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

function getServiceList(appointment) {
  if (Array.isArray(appointment.services) && appointment.services.length > 0) {
    return appointment.services.map((s) => ({
      name: s.service_name || s.name || "خدمة",
      price: s.price || s.service_price,
    }));
  }
  if (appointment.service_name) {
    return [
      { name: appointment.service_name, price: appointment.service_price },
    ];
  }
  return [];
}

const ScheduleModal = memo(function ScheduleModal({ appointment, onClose }: any) {
  const navigate = useNavigate();
  if (!appointment) return null;

  const status = getStatusConfig(appointment.status);
  const services = getServiceList(appointment);
  const isOnline = appointment.booking_source === "online";
  const phone = appointment.customer_phone || appointment.phone || "";
  const barberName =
    appointment.barber_name || appointment.employee_name || "—";

  return (
    <Dialog open={!!appointment} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-black text-main flex items-center gap-2">
              <User size={18} className="text-accent" />
              {appointment.customer_name || "عميل مجهول"}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted mt-1">
              تفاصيل الموعد الكاملة
            </DialogDescription>
          </div>
          <Badge
            className={cn(
              "text-[10px] px-3 h-7 font-black uppercase tracking-widest rounded-xl shadow-sm border-none",
              status.color,
              status.bg,
            )}
          >
            {status.label}
          </Badge>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-soft rounded-2xl p-4 border border-border/60">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Clock3 size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-muted uppercase">
                  الوقت
                </p>
                <p className="text-sm font-black text-main tabular-nums">
                  {formatTime12h(
                    String(
                      appointment.appointment_time ||
                        appointment.appointmentTime ||
                        "",
                    ).slice(0, 5),
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-soft rounded-2xl p-4 border border-border/60">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <CalendarDays size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-muted uppercase">
                  التاريخ
                </p>
                <p className="text-sm font-black text-main tabular-nums">
                  {new Date(
                    appointment.appointment_date + "T00:00:00",
                  ).toLocaleDateString("ar-EG", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-soft rounded-2xl p-4 border border-border/60">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Scissors size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-muted uppercase">
                  الموظف
                </p>
                <p className="text-sm font-black text-main truncate">
                  {barberName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-soft rounded-2xl p-4 border border-border/60">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Phone size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-muted uppercase">
                  الهاتف
                </p>
                <p className="text-sm font-black text-main truncate" dir="ltr">
                  {phone || "—"}
                </p>
              </div>
            </div>
          </div>

          {services.length > 0 && (
            <div className="bg-soft rounded-2xl border border-border/60 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-card/60 border-b border-border/60">
                <Scissors size={14} className="text-accent" />
                <p className="text-[10px] font-black text-main">
                  الخدمات المطلوبة
                </p>
              </div>
              <div className="divide-y divide-border/40">
                {services.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-xs font-black text-main">
                      {s.name}
                    </span>
                    {s.price != null && (
                      <span className="text-[10px] font-black text-accent tabular-nums">
                        {s.price} ج.م
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 bg-soft rounded-2xl p-4 border border-border/60">
            <StickyNote size={16} className="text-accent mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-black text-muted uppercase mb-1">
                ملاحظات
              </p>
              <p className="text-xs font-bold text-main leading-relaxed">
                {appointment.notes || "لا توجد ملاحظات"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge
                variant="outline"
                className="text-sky-600 bg-sky-500/10 border-none gap-1.5"
              >
                <Globe size={11} /> حجز أونلاين
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-amber-600 bg-amber-500/10 border-none gap-1.5"
              >
                <Home size={11} /> حجز عادي
              </Badge>
            )}
            {appointment.created_at && (
              <span className="text-[9px] font-bold text-muted">
                أُنشئ في{" "}
                {new Date(appointment.created_at).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 pb-6 gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            إغلاق
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose?.();
              navigate("/bookings");
            }}
            className="rounded-xl gap-2"
          >
            إدارة الحجز <ArrowUpRight size={16} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default ScheduleModal;
