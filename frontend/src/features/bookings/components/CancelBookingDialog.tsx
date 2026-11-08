import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatTime12h } from "@/lib/core/utils";
import {
  getBookingCustomerName,
  timeOnly,
} from "@/features/bookings";

export default function CancelBookingDialog({
  open,
  onOpenChange,
  bookingToCancel,
  cancellationReason,
  setCancellationReason,
  onConfirm,
  saving,
}: any) {
  const { t } = useTranslation("bookings");
  // Reasons are stored by their (translated) label — same shape the API
  // received before i18n, while the bilingual UI stays fully translatable.
  const otherReasonLabel = t("cancel.reasonOther");
  const reasonOptions = [
    t("cancel.reasonReschedule"),
    t("cancel.reasonEmergency"),
    t("cancel.reasonNoAnswer"),
    otherReasonLabel,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-[2rem] p-0 border-0 bg-card shadow-premium overflow-hidden"
      >
        <div className="p-6 bg-rose-600 relative overflow-hidden text-center text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3 relative z-10">
            <AlertTriangle size={28} className="text-white" />
          </div>
          <DialogTitle className="text-lg font-black relative z-10 mb-1">
            {t("cancel.title")}
          </DialogTitle>
          <p className="text-white/80 text-xs font-medium relative z-10">
            {t("cancel.description")}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-soft border border-border/50">
            <p className="text-[11px] font-black text-muted uppercase mb-0.5">
              {t("cancel.customer")}
            </p>
            <p className="font-bold text-xs text-main break-words">
              {getBookingCustomerName(bookingToCancel)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-soft border border-border/50">
              <p className="text-[11px] font-black text-muted uppercase mb-0.5">
                {t("cancel.date")}
              </p>
              <p className="font-bold text-xs text-main">
                {bookingToCancel?.appointment_date}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-soft border border-border/50">
              <p className="text-[11px] font-black text-muted uppercase mb-0.5">
                {t("cancel.time")}
              </p>
              <p className="font-bold text-xs text-main dir-ltr text-right">
                {formatTime12h(timeOnly(bookingToCancel?.appointment_time))}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-muted uppercase block">
              {t("cancel.reasonLabel")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {reasonOptions.map(
                (reason) => (
                  <button
                    key={reason}
                    onClick={() => setCancellationReason(reason)}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold border transition-all text-center",
                      cancellationReason === reason
                        ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                        : "bg-card text-muted border-border hover:border-rose-300",
                    )}
                  >
                    {reason}
                  </button>
                ),
              )}
            </div>
            {cancellationReason === otherReasonLabel && (
              <Input
                placeholder={t("cancel.otherPlaceholder")}
                className="h-10 rounded-xl bg-soft border-border text-xs mt-2"
                value={
                  cancellationReason === otherReasonLabel
                    ? ""
                    : cancellationReason
                }
                onChange={(e) => setCancellationReason(e.target.value)}
                onFocus={() => setCancellationReason("")}
              />
            )}
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl font-black text-xs h-11"
          >
            {t("cancel.back")}
          </Button>
          <Button
            onClick={onConfirm}
            loading={saving}
            disabled={!cancellationReason}
            className={cn(
              "flex-1 rounded-xl font-black text-xs h-11 shadow-md",
              cancellationReason
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t("cancel.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
