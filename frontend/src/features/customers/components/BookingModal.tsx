/** Customers booking modal (moved from CustomerDetail page, no logic changes). */
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


import { formatCurrency } from "@/lib/core/utils";
import { cn } from "@/lib/core/utils";
import api from "@/services/api";
import { toast } from "react-hot-toast";

export default function BookingModal({ open, onOpenChange, customer, onSuccess }: any) {
   
  const [serviceIds, setServiceIds] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("none");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
   
  const [services, setServices] = useState<any[]>([]);
   
  const [barbers, setBarbers] = useState<any[]>([]);
   
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [conflictMsg, setConflictMsg] = useState("");
  const [isToday, setIsToday] = useState(true);

  useEffect(() => {
    if (!open) {
      setServiceIds([]);
      setEmployeeId("none");
      setDate(new Date().toISOString().split("T")[0]);
      setTime("");
      setNotes("");
      setConflictMsg("");
      setExistingBookings([]);
      return;
    }
    Promise.all([api.get("/services"), api.get("/employees")])
      .then(([s, b]) => {
        setServices(s.data || []);
        setBarbers(b.data || []);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!date || !time) {
      setConflictMsg("");
      return;
    }
    checkConflict();
  }, [date, time, employeeId]);

  useEffect(() => {
    if (!date || !customer?.customer_id) {
      setExistingBookings([]);
      return;
    }
    api
      .get("/appointments", {
        params: {
          customer_id: customer.customer_id,
          date_from: date,
          date_to: date,
        },
      })
      .then((res) => setExistingBookings(res.data || []))
      .catch(() => setExistingBookings([]));
  }, [date, customer?.customer_id]);

  const toggleService = (id) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const totalPrice = serviceIds.reduce((sum, id) => {
    const s = services.find((srv) => srv.id === id);
    return sum + (s ? Number(s.price || s.base_price || 0) : 0);
  }, 0);

  const totalDuration = serviceIds.reduce((sum, id) => {
    const s = services.find((srv) => srv.id === id);
    return sum + (s ? s.duration_minutes || 30 : 0);
  }, 0);

  const checkConflict = async () => {
    const duration = totalDuration || 30;
    try {
      const res = await api.get("/appointments/check-conflict", {
        params: {
          barber_id: employeeId === "none" ? null : employeeId,
          date,
          time,
          duration_minutes: duration,
        },
      });
      setConflictMsg(
        res.data?.has_conflict
          ? res.data?.message || "يوجد تعارض في الموعد"
          : "",
      );
    } catch (err) {
      setConflictMsg("");
    }
  };

  const handleDateChange = (newDate) => {
    setDate(newDate);
    setIsToday(newDate === new Date().toISOString().split("T")[0]);
    setTime("");
  };

  const isTimeInPast = (timeValue: string) => {
    if (!isToday) return false;
    const now = new Date();
    const [h, m] = timeValue.split(":").map(Number);
    const timeDate = new Date();
    timeDate.setHours(h, m, 0);
    return timeDate <= now;
  };

  const handleSubmit = async () => {
    if (serviceIds.length === 0)
      return toast.error("اختر خدمة واحدة على الأقل");
    if (!time) return toast.error("يرجى اختيار الوقت");
    if (isTimeInPast(time)) return toast.error("لا يمكن الحجز في وقت مضى");
    if (conflictMsg) return toast.error(conflictMsg);
    if (existingBookings.length > 0)
      return toast.error(
        "هذا العميل لديه حجز بالفعل في هذا اليوم. يرجى اختيار يوم آخر.",
      );

    try {
      setSubmitting(true);
      await api.post("/appointments/fast-walkin", {
        customer_id: customer?.customer_id,
        service_ids: serviceIds,
        employee_id: employeeId === "none" ? null : employeeId,
        appointment_date: date,
        appointment_time: time,
        notes,
        booking_source: "shop",
      });
      toast.success("تم حجز الموعد بنجاح");
      onSuccess?.();
    } catch (err) {
       
      const apiErr2 = err as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr2?.response?.data?.detail as string) || "فشل الحجز");
    } finally {
      setSubmitting(false);
    }
  };

  const generateTimeSlots = () => {
     
    const slots: any[] = [];
    for (let hour = 9; hour < 22; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const timeValue = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
        if (isTimeInPast(timeValue)) continue;
        slots.push(timeValue);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarClock size={14} className="text-primary" />
            </div>
            حجز جديد للعميل
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted">
            {customer?.first_name} {customer?.last_name}
          </DialogDescription>
        </DialogHeader>
        <div className="p-5 space-y-4">
          {/* Services */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              اختر الخدمات *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {services.map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => toggleService(srv.id)}
                  className={cn(
                    "p-2.5 rounded-xl border-2 cursor-pointer transition-all text-xs text-right",
                    serviceIds.includes(srv.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  <div className="font-black text-main truncate">
                    {srv.name}
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-primary font-black">
                      {formatCurrency(srv.price || srv.base_price || 0)}
                    </span>
                    <span className="text-muted">
                      {srv.duration_minutes || 30} د
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                التاريخ *
              </label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full h-10 rounded-xl bg-soft border border-border px-3 text-sm font-bold focus:border-primary focus:ring-0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                الوقت *
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-10 rounded-xl bg-soft border border-border px-3 text-sm font-bold focus:border-primary focus:ring-0"
              >
                <option value="">اختر الوقت</option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Barber */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              الخبير
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full h-10 rounded-xl bg-soft border border-border px-3 text-sm font-bold focus:border-primary focus:ring-0"
            >
              <option value="none">توزيع تلقائي</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name || b.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              ملاحظات
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات..."
              className="w-full h-10 rounded-xl bg-soft border border-border px-3 text-sm font-bold focus:border-primary focus:ring-0"
            />
          </div>

          {/* Warnings */}
          {conflictMsg && (
            <div className="rounded-lg bg-danger/5 border border-danger/20 p-2.5">
              <p className="text-[10px] font-black text-danger flex items-center gap-1.5">
                <AlertTriangle size={12} /> {conflictMsg}
              </p>
            </div>
          )}
          {existingBookings.length > 0 && (
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-2.5">
              <p className="text-[10px] font-black text-warning flex items-center gap-1.5">
                <AlertTriangle size={12} /> هذا العميل لديه حجز في هذا اليوم
                بالفعل
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-xl bg-success/5 border border-success/20 p-3">
            <div className="text-[10px] font-bold text-muted">
              الإجمالي ({serviceIds.length} خدمات • {totalDuration} دقيقة)
            </div>
            <div className="text-xl font-black text-success">
              {formatCurrency(totalPrice)}
            </div>
          </div>
        </div>
        <DialogFooter className="p-5 pt-3 border-t border-border/40 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 flex-1 rounded-xl text-xs"
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            className="h-10 flex-1 rounded-xl text-xs"
            disabled={
              serviceIds.length === 0 ||
              !time ||
              !!conflictMsg ||
              existingBookings.length > 0
            }
          >
            <Plus size={14} className="ml-1.5" /> تأكيد الحجز
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
