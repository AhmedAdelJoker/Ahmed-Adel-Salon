import { AlertTriangle } from "lucide-react";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-[2rem] p-0 border-0 bg-card shadow-premium overflow-hidden"
        dir="rtl"
      >
        <div className="p-6 bg-rose-600 relative overflow-hidden text-center text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3 relative z-10">
            <AlertTriangle size={28} className="text-white" />
          </div>
          <DialogTitle className="text-lg font-black relative z-10 mb-1">
            تأكيد إلغاء الحجز
          </DialogTitle>
          <p className="text-white/80 text-xs font-medium relative z-10">
            يرجى تحديد سبب الإلغاء لضمان دقة البيانات والتحليلات.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-soft border border-border/50">
            <p className="text-[11px] font-black text-muted uppercase mb-0.5">
              العميل
            </p>
            <p className="font-bold text-xs text-main break-words">
              {getBookingCustomerName(bookingToCancel)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-soft border border-border/50">
              <p className="text-[11px] font-black text-muted uppercase mb-0.5">
                التاريخ
              </p>
              <p className="font-bold text-xs text-main">
                {bookingToCancel?.appointment_date}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-soft border border-border/50">
              <p className="text-[11px] font-black text-muted uppercase mb-0.5">
                الوقت
              </p>
              <p className="font-bold text-xs text-main dir-ltr text-right">
                {formatTime12h(timeOnly(bookingToCancel?.appointment_time))}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-muted uppercase block">
              سبب الإلغاء
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["تغيير الموعد", "حالة طارئة", "عدم الرد", "أخرى"].map(
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
            {cancellationReason === "أخرى" && (
              <Input
                placeholder="يرجى كتابة السبب..."
                className="h-10 rounded-xl bg-soft border-border text-xs mt-2"
                value={cancellationReason === "أخرى" ? "" : cancellationReason}
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
            تراجع
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
            تأكيد الإلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
