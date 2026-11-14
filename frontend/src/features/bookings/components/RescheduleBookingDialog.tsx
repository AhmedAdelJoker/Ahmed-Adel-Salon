import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn, formatTime12h } from "@/lib/core/utils";
import { timeOnly } from "@/features/bookings";

export default function RescheduleBookingDialog({
  open,
  onOpenChange,
  booking,
  employees,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  employees: any[];
  onSave: (
    bookingId: string | number,
    newDate: string,
    newTime: string,
    barberId?: string | number
  ) => void;
  saving: boolean;
}) {
  const { t } = useTranslation("bookings");
  const [newDate, setNewDate] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const [newBarberId, setNewBarberId] = React.useState("");
  const [availableSlots, setAvailableSlots] = React.useState<string[]>([]);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);

  // The dialog stays mounted even while closed (booking is then null), and
  // the same instance may be re-opened for a different booking — so state
  // must be re-derived from the current booking every time it opens.
  React.useEffect(() => {
    if (!open || !booking) return;
    setNewDate(booking.appointment_date || "");
    setNewTime(timeOnly(booking.appointment_time));
    setNewBarberId(String(booking.barber_id));
    setAvailableSlots([]);
    setSlotsError(null);
  }, [open, booking]);

  if (!open || !booking) return null;

  const handleDateChange = async (date: string) => {
    setNewDate(date);
    setSlotsError(null);
    if (newBarberId) {
      try {
        const res = await fetch(
          `/api/v1/appointments/available-slots?barber_id=${newBarberId}&date=${date}`
        );
        const data = await res.json();
        setAvailableSlots(data.slots || []);
      } catch {
        setSlotsError(t("reschedule.slotsError"));
      }
    }
  };

  const handleBarberChange = (id: string) => {
    setNewBarberId(id);
    setSlotsError(null);
    if (newDate) {
      fetch(
        `/api/v1/appointments/available-slots?barber_id=${id}&date=${newDate}`
      )
        .then((r) => r.json())
        .then((data) => setAvailableSlots(data.slots || []))
        .catch(() => setSlotsError(t("reschedule.slotsError")));
    }
  };

  const handleSave = () => {
    if (!newDate || !newTime) return;
    onSave(booking.id, newDate, newTime, newBarberId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] rounded-[2rem] p-0 border-0 bg-card shadow-premium overflow-hidden flex flex-col max-h-[90vh]"
      >
        <DialogHeader
          className="p-6 sm:p-8 pb-5 bg-gradient-to-br from-accent to-accent-strong relative overflow-hidden shrink-0"
        >
          <div
            className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl"
          />
          <DialogTitle
            className="text-xl sm:text-2xl font-black text-white relative z-10 flex items-center gap-3 leading-none"
          >
            <div
              className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0"
            >
              <Calendar size={20} fill="currentColor" />
            </div>
            <span>{t("reschedule.title")}</span>
          </DialogTitle>
          <DialogDescription
            className="text-white/70 font-medium text-xs sm:text-sm mt-1.5"
          >
            {t("reschedule.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 overflow-y-auto custom-scrollbar flex-1">
          {/* Left: Date & Barber */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label
                className="text-xs font-black text-muted uppercase tracking-wider block"
              >
                {t("reschedule.newDate")}
              </label>
              <Input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                className="h-12 rounded-xl bg-soft border-border font-black text-xs px-3"
                value={newDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label
                className="text-xs font-black text-muted uppercase tracking-wider block"
              >
                {t("reschedule.barber")}
              </label>
              <Select value={newBarberId} onValueChange={handleBarberChange}>
                <SelectTrigger
                  className="h-12 rounded-xl bg-soft border-border font-bold text-xs"
                >
                  <SelectValue placeholder={t("reschedule.barberPlaceholder")} />
                </SelectTrigger>
                <SelectContent
                  className="rounded-xl border-border shadow-premium"
                >
                  {employees.map((e: any) => (
                    <SelectItem
                      key={e.id}
                      value={String(e.id)}
                      className="font-bold text-xs py-2.5"
                    >
                      {e.display_name || e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {slotsError && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] font-black text-rose-600"
              >
                {slotsError}
              </div>
            )}

            {availableSlots.length > 0 && (
              <div className="space-y-2">
                <label
                  className="text-xs font-black text-muted uppercase tracking-wider block"
                >
                  {t("reschedule.availableSlots")}
                </label>
                <div
                  className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar p-1 border border-border/40 rounded-xl bg-soft/30"
                >
                  {availableSlots.map((slot: string) => (
                    <button
                      key={slot}
                      onClick={() => setNewTime(slot)}
                      className={cn(
                        "p-2 rounded-lg text-xs font-bold border transition-all text-center dir-ltr",
                        newTime === slot
                          ? "bg-accent border-accent text-white shadow-sm"
                          : "bg-card border-border text-main hover:border-accent/50",
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!availableSlots.length &&
              !slotsError &&
              newDate &&
              newBarberId && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-black text-amber-600"
                >
                  <RefreshCw size={14} className="animate-spin shrink-0" />
                  {t("reschedule.noSlots")}
                </div>
              )}
          </div>

          {/* Right: Time preview & Summary */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label
                className="text-xs font-black text-muted uppercase tracking-wider block"
              >
                {t("reschedule.chosenTime")}
              </label>
              <div
                className="flex items-center gap-3 p-4 rounded-xl bg-soft border border-border"
              >
                <Clock size={24} className="text-primary shrink-0" />
                <div>
                  <p
                    className="text-[11px] font-black text-muted uppercase"
                  >
                    {t("reschedule.appointmentTime")}
                  </p>
                  <p className="text-2xl font-black text-main tabular-nums dir-ltr shrink-0">
                    {newTime || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-muted">
                  {t("reschedule.currentAppointment")}
                </span>
                <span className="text-xs font-bold text-muted dir-ltr">
                  {formatTime12h(timeOnly(booking.appointment_time))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-muted">
                  {t("reschedule.newAppointment")}
                </span>
                <span className="text-xs font-bold text-primary dir-ltr">
                  {t("reschedule.newDateTime", {
                    date: newDate,
                    time: newTime || "—",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter
          className="p-4 sm:p-6 bg-soft/40 border-t border-border/50 flex flex-row items-center justify-between gap-3 shrink-0"
        >
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl font-black text-xs h-11"
          >
            {t("reschedule.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={
              !newDate || !newTime || availableSlots.length === 0
            }
            className="flex-1 rounded-xl font-black text-xs h-11 shadow-accent text-xs flex items-center gap-2"
          >
            <Zap size={16} />
            <span>{t("reschedule.confirm")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
