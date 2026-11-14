import { memo, useState } from "react";
import {
  Phone,
  Clock3,
  CalendarDays,
  Scissors,
  StickyNote,
  User,
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
import {
  cn,
  formatCurrency,
  formatTime12h,
} from "@/lib/core/utils";
import { getStatusConfig } from "@/pages/cashier/schedule/scheduleUtils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { Badge } from "@/components/ui/badge";

function getServiceList(appointment, t) {
  if (Array.isArray(appointment.services) && appointment.services.length > 0) {
    return appointment.services.map((s) => ({
      name: s.service_name || s.name || t("listView.service"),
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

const ScheduleModal = memo(function ScheduleModal({
  appointment,
  onClose,
  onEdit,
  onCancel,
  onTransferPOS,
  onStatusChange,
}: any) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("schedule");
  if (!appointment) return null;

  const status = getStatusConfig(appointment.status);
  const services = getServiceList(appointment, t);
  const isOnline = appointment.booking_source === "online";
  const phone = appointment.customer_phone || appointment.phone || "";
  const barberName =
    appointment.barber_name || appointment.employee_name || "—";
  const [statusOpen, setStatusOpen] = useState(false);

  const handleCancel = async () => {
    try {
      await api.patch(`/appointments/${appointment.id}/status`, {
        status: "cancelled",
        cancellation_reason: t("toasts.noReasonGiven"),
      });
      toast.success(t("toasts.cancelled"));
      onClose?.();
      onCancel?.();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail || t("toasts.cancelFailed"),
      );
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.patch(`/appointments/${appointment.id}/status`, {
        status: newStatus,
      });
      toast.success(t("toasts.statusUpdated"));
      onClose?.();
      onStatusChange?.(newStatus);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail || t("toasts.statusUpdateFailed"),
      );
    }
  };

  const handleTransferPOS = () => {
    onClose?.();
    navigate("/pos", {
      state: {
        appointmentId: appointment.id,
        customerId: appointment.customer_id,
        barberId: appointment.barber_id || appointment.employee_id,
        services: appointment.services,
      },
    });
    onTransferPOS?.();
  };

  const handleEdit = () => {
    onClose?.();
    navigate("/bookings", {
      state: { appointmentId: appointment.id },
    });
    onEdit?.();
  };

  const statusOptions = [
    { key: "waiting", label: t("scheduleModal.statusWaiting"), color: "text-blue-500" },
    { key: "in_progress", label: t("scheduleModal.statusInProgress"), color: "text-indigo-500" },
    { key: "done", label: t("scheduleModal.statusDone"), color: "text-emerald-600" },
    { key: "cancelled", label: t("scheduleModal.statusCancelled"), color: "text-rose-500" },
  ];

  return (
    <Dialog open={!!appointment} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-black text-main flex items-center gap-2">
              <User size={18} className="text-accent" />
              {appointment.customer_name || t("appointmentCard.unknownCustomer")}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted mt-1">
              {t("scheduleModal.title")}
            </DialogDescription>
          </div>
          <Badge
            className={cn(
              "text-[10px] px-3 h-7 font-black uppercase tracking-widest rounded-xl shadow-sm border-none",
              status.color,
              status.bg,
            )}
          >
            {i18n.t("schedule:" + status.label)}
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
                  {t("scheduleModal.time")}
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
                  {t("scheduleModal.date")}
                </p>
                <p className="text-sm font-black text-main tabular-nums">
                  {new Date(
                    appointment.appointment_date + "T00:00:00",
                  ).toLocaleDateString(
                    i18n.language === "ar" ? "ar-EG" : "en-US",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    },
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-soft rounded-2xl p-4 border border-border/60">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Scissors size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-muted uppercase">
                  {t("scheduleModal.barber")}
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
                  {t("scheduleModal.phone")}
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
                  {t("scheduleModal.servicesRequired")}
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
                        {formatCurrency(s.price)}
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
                {t("scheduleModal.notes")}
              </p>
              <p className="text-xs font-bold text-main leading-relaxed">
                {appointment.notes || t("scheduleModal.noNotes")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge
                variant="outline"
                className="text-sky-600 bg-sky-500/10 border-none gap-1.5"
              >
                <Globe size={11} /> {t("scheduleModal.bookingSourceOnline")}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-amber-600 bg-amber-500/10 border-none gap-1.5"
              >
                <Home size={11} /> {t("scheduleModal.bookingSourceRegular")}
              </Badge>
            )}
            {appointment.created_at && (
              <span className="text-[9px] font-bold text-muted">
                {t("scheduleModal.createdAt")}{" "}
                {new Date(appointment.created_at).toLocaleDateString(
                  i18n.language === "ar" ? "ar-EG" : "en-US",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  },
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 pb-6 gap-3">
          <div className="flex items-center gap-2">
            {status.key !== "CANCELLED" && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                className="rounded-xl"
              >
                {t("scheduleModal.cancel")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTransferPOS}
              className="rounded-xl gap-2"
            >
              {t("scheduleModal.transferPOS")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="rounded-xl gap-2"
            >
              {t("scheduleModal.edit")}
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusOpen(true)}
              className="rounded-xl gap-1"
            >
              {t("scheduleModal.changeStatus")}
            </Button>
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              {t("scheduleModal.close")}
            </Button>
          </div>
        </div>

        {/* Quick status change buttons */}
        {statusOpen && (
          <div className="absolute top-0 right-0 mt-2 w-48 bg-card border border-border rounded-2xl shadow-lg p-2 z-50">
            <p className="text-xs font-black text-muted uppercase tracking-widest mb-2 px-2">
              {t("scheduleModal.changeStatus")}
            </p>
            {statusOptions.map((opt) => (
              <Button
                key={opt.key}
                variant={status.key === opt.key.toUpperCase() ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  handleStatusChange(opt.key);
                  setStatusOpen(false);
                }}
                className="w-full justify-between text-left rounded-xl gap-2"
              >
                <span className={`font-bold ${opt.color}`}>{opt.label}</span>
                {status.key === opt.key.toUpperCase() && (
                  <span className="text-[10px]">✓</span>
                )}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default ScheduleModal;
