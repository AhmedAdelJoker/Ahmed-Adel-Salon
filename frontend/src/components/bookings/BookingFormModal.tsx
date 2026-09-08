import { useRef } from "react";
import {
  Clock,
  Phone,
  Save,
  AlertTriangle,
  Sparkles,
  Zap,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePresence } from "framer-motion";

const TODAY = new Date().toISOString().slice(0, 10);

export function BookingFormModal({
  isOpen,
  onClose,
  editingBooking,
  formData,
  setFormData,
  customerMode,
  foundCustomer,
  customerSuggestions,
  conflictMsg,
  duplicateBooking,
  availableSlots,
  employees,
  services,
  categories,
  groupedServices,
  selectedServiceCategory,
  setSelectedServiceCategory,
  onPhoneChange,
  onSelectCustomer,
  onTimeChange,
  onDateChange,
  onEmployeeChange,
  onServiceToggle,
  onToggleServiceCategory,
  onSave,
  saving,
  phoneInputRef,
}) {
  const internalPhoneRef = useRef(null);
  const inputRef = phoneInputRef || internalPhoneRef;

  const totalPrice = formData.services.reduce((sum, item) => {
    const s = services.find((srv) => srv.id === item.serviceId);
    return sum + Number(s?.price || 0);
  }, 0);

  const totalDuration = formData.services.reduce((sum, item) => {
    const s = services.find((srv) => srv.id === item.serviceId);
    return sum + Number(s?.duration_minutes || 30) * item.quantity;
  }, 0);

  const calculateEndTime = () => {
    if (!formData.appointmentTime || formData.services.length === 0)
      return null;
    const [h, m] = formData.appointmentTime.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0);
    const end = new Date(start.getTime() + totalDuration * 60000);
    return end.toTimeString().slice(0, 5);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-5xl rounded-[2.5rem] p-0 border-0 bg-card shadow-premium overflow-hidden flex flex-col"
        dir="rtl"
      >
        <DialogHeader className="p-8 pb-6 bg-[#020617] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <DialogTitle className="text-2xl font-black text-white relative z-10 flex items-center gap-3 leading-none">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-white">
              <Zap size={20} fill="currentColor" />
            </div>
            {editingBooking ? "تعديل بيانات الحجز" : "تسجيل حجز جديد"}
          </DialogTitle>
          <DialogDescription className="text-white/50 font-medium mt-1">
            منظومة الحجز الذكية: بحث بالرقم، كشف تضارب، وتنظيم خدمات.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {/* Left Column: Customer + Date/Time */}
          <div className="space-y-8">
            <div className="space-y-4">
              {/* Phone Search */}
              <div className="relative w-full">
                <Input
                  ref={inputRef}
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="h-14 rounded-2xl bg-soft border-border focus:bg-card font-black text-xl text-center"
                  value={formData.customerPhone}
                  onChange={(e) =>
                    onPhoneChange(e.target.value.replace(/\D/g, ""))
                  }
                />
                {customerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-2xl shadow-premium overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                    {customerSuggestions.map((cus) => (
                      <button
                        key={cus.customer_id}
                        onClick={() => onSelectCustomer(cus)}
                        className="w-full p-3 text-right flex items-center gap-3 hover:bg-soft border-b border-border/40 last:border-0 transition-colors"
                      >
                        <EmployeeAvatar name={cus.first_name} size="xs" />
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-main">
                            {cus.first_name} {cus.last_name}
                          </span>
                          <span className="text-[9px] font-bold text-muted">
                            {cus.phone}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Found */}
              <AnimatePresence mode="wait">
                {customerMode === "found" && foundCustomer && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-5 rounded-[2rem] bg-gradient-to-br from-emerald-500/10 to-accent/5 border border-emerald-500/20 flex items-center gap-5 shadow-sm relative overflow-hidden group"
                  >
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl transition-all group-hover:scale-150" />
                    <div className="relative">
                      <EmployeeAvatar
                        name={foundCustomer.first_name || foundCustomer.name}
                        size="lg"
                        className="ring-4 ring-white shadow-lg"
                      />
                      {foundCustomer.visit_count > 10 && (
                        <div
                          className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center shadow-sm"
                          title="VIP"
                        >
                          <Sparkles size={10} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                          العميل المسجل
                        </p>
                        {foundCustomer.visit_count > 10 && (
                          <Badge className="bg-amber-500 text-white text-[7px] font-black px-1.5 h-4 border-none animate-pulse">
                            VIP
                          </Badge>
                        )}
                      </div>
                      <h5 className="text-lg font-black text-main truncate leading-tight">
                        {foundCustomer.first_name || foundCustomer.name}
                      </h5>
                      <div className="flex items-center gap-3 mt-1 text-muted">
                        <span className="text-[10px] font-bold flex items-center gap-1">
                          <Phone size={10} /> {foundCustomer.phone}
                        </span>
                      </div>
                    </div>
                    {foundCustomer.cancellation_count >= 3 && (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600">
                          <AlertTriangle size={12} />
                          <span className="text-[9px] font-black">
                            تنبيه سجل إلغاء
                          </span>
                        </div>
                        <p className="text-[8px] font-bold text-rose-500/70">
                          {foundCustomer.cancellation_count} إلغاء سابق
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {customerMode === "new" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-200 space-y-4 relative overflow-hidden"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
                        <Sparkles size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-700">
                          عميل جديد
                        </p>
                        <p className="text-xs text-blue-500">
                          العميل غير مسجل — أدخل بياناته لإتمام الحجز
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600">
                        اسم العميل *
                      </label>
                      <Input
                        placeholder="أحمد"
                        className="h-11 rounded-xl bg-white border-gray-200 font-bold text-sm"
                        value={formData.customerName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerName: e.target.value,
                          })
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Duplicate Warning */}
              {duplicateBooking && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-start gap-3 shadow-sm"
                >
                  <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] font-black leading-tight">
                      {duplicateBooking.message}
                    </p>
                    <p className="text-[9px] font-bold opacity-80">
                      يمكنك الاستمرار في إضافة حجز جديد أو تعديل الموعد الحالي.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Date & Time */}
            <div className="space-y-6 pt-6 border-t border-border/40">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted mr-1 uppercase">
                    التاريخ
                  </label>
                  <Input
                    type="date"
                    min={TODAY}
                    className="h-12 rounded-xl bg-soft border-border font-black text-sm px-4"
                    value={formData.appointmentDate}
                    onChange={(e) => onDateChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted mr-1 uppercase flex justify-between items-center">
                    <span>تحديد الموعد</span>
                    <div className="flex items-center gap-1 bg-soft/50 p-1 rounded-lg border border-border/50">
                      <button
                        type="button"
                        onClick={() => {
                          if (!formData.appointmentTime) return;
                          const [h, m] = formData.appointmentTime
                            .split(":")
                            .map(Number);
                          const d = new Date();
                          d.setHours(h, m - 15);
                          onTimeChange(d.toTimeString().slice(0, 5));
                        }}
                        className="h-6 w-8 rounded-md bg-card text-main hover:text-accent hover:bg-soft transition-all text-[9px] font-black flex items-center justify-center border border-border/40 shadow-sm"
                      >
                        -15
                      </button>
                      <div className="w-px h-3 bg-border/50 mx-0.5" />
                      <button
                        type="button"
                        onClick={() => {
                          if (!formData.appointmentTime) return;
                          const [h, m] = formData.appointmentTime
                            .split(":")
                            .map(Number);
                          const d = new Date();
                          d.setHours(h, m + 15);
                          onTimeChange(d.toTimeString().slice(0, 5));
                        }}
                        className="h-6 w-8 rounded-md bg-card text-main hover:text-accent hover:bg-soft transition-all text-[9px] font-black flex items-center justify-center border border-border/40 shadow-sm"
                      >
                        +15
                      </button>
                    </div>
                  </label>

                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => onTimeChange(slot.time)}
                          className={cn(
                            "p-2 rounded-xl text-[10px] font-black border transition-all text-center shadow-sm",
                            formData.appointmentTime === slot.time
                              ? "bg-accent border-accent text-white shadow-accent/30 scale-[1.02]"
                              : slot.available
                                ? "bg-card border-border text-main hover:border-accent hover:text-accent"
                                : "bg-soft text-muted border-transparent opacity-40 cursor-not-allowed",
                          )}
                          disabled={!slot.available}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Input
                      type="time"
                      className="h-12 rounded-xl bg-soft border-border font-black text-sm px-4"
                      value={formData.appointmentTime}
                      onChange={(e) => onTimeChange(e.target.value)}
                    />
                  )}

                  {formData.appointmentTime && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-accent/5 border border-accent/15 mt-1">
                      <Clock size={14} className="text-accent" />
                      <p className="text-[10px] font-black text-muted uppercase">
                        الوقت المتوقع للنهاية:{" "}
                        <span className="text-accent">
                          {calculateEndTime() || "جاري الحساب..."}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Employee Select */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted mr-1 uppercase">
                  الخبير المسؤول
                </label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(v) => onEmployeeChange(v)}
                >
                  <SelectTrigger
                    className={cn(
                      "h-14 rounded-xl bg-soft border-border font-bold",
                      conflictMsg && "border-rose-500 bg-rose-50",
                    )}
                  >
                    <SelectValue placeholder="اختر الحلاق..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border shadow-premium">
                    {employees.map((e) => (
                      <SelectItem
                        key={e.id}
                        value={String(e.id)}
                        className="font-bold py-3"
                      >
                        {e.display_name || e.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {conflictMsg && (
                  <p className="text-[10px] font-black text-rose-600 flex items-center gap-2 bg-rose-50 p-2 rounded-lg border border-rose-100">
                    <AlertTriangle size={12} /> {conflictMsg}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Services + Notes */}
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                باقة الخدمات
              </label>
              <Tabs
                value={selectedServiceCategory}
                onValueChange={setSelectedServiceCategory}
                className="w-full"
              >
                <TabsList className="bg-soft p-1 rounded-xl flex flex-wrap gap-1 mb-4 h-auto border border-border">
                  <TabsTrigger
                    value="all"
                    className="rounded-lg px-4 py-2 text-[10px] font-black data-[state=active]:bg-card data-[state=active]:text-accent data-[state=active]:shadow-sm"
                  >
                    الكل
                  </TabsTrigger>
                  {categories.map((c) => (
                    <TabsTrigger
                      key={c.id}
                      value={String(c.id)}
                      className="rounded-lg px-4 py-2 text-[10px] font-black data-[state=active]:bg-card"
                    >
                      {c.name_ar || c.name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="bg-soft/50 rounded-2xl border border-border p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {(groupedServices[selectedServiceCategory] || []).map(
                      (s) => {
                        const active = formData.services.some(
                          (item) => item.serviceId === s.id,
                        );
                        return (
                          <button
                            key={s.id}
                            onClick={() => onServiceToggle(s.id)}
                            className={cn(
                              "p-3 rounded-xl text-[10px] font-black border transition-all text-right flex flex-col gap-0.5",
                              active
                                ? "bg-accent border-accent text-white shadow-lg"
                                : "bg-card border-border/40 text-muted hover:border-accent/40",
                            )}
                          >
                            <span className="truncate">
                              {s.name_ar || s.name}
                            </span>
                            <span
                              className={cn(
                                "text-[9px] font-bold opacity-60",
                                active ? "text-white" : "text-accent",
                              )}
                            >
                              {s.price} ج.م
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>

                  <div className="pt-6 border-t border-border/40 flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-muted uppercase">
                        الحساب المتوقع
                      </p>
                      <p className="text-3xl font-black text-accent tabular-nums">
                        {totalPrice}{" "}
                        <span className="text-xs font-bold opacity-40 mr-1 uppercase font-sans">
                          EGP
                        </span>
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      <Zap size={24} />
                    </div>
                  </div>
                </div>
              </Tabs>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2 mr-1">
                <AlertCircle size={12} /> ملاحظات خاصة
              </label>
              <textarea
                placeholder="أي رغبات إضافية للعميل..."
                className="w-full h-20 rounded-xl bg-soft border border-border p-4 font-bold text-xs focus:bg-card focus:border-accent outline-none resize-none transition-all shadow-inner"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 bg-soft/20 flex items-center justify-between border-t border-border/40">
          <Button
            variant="secondary"
            onClick={() => onClose(false)}
            className="rounded-xl font-black px-8 h-12 text-xs"
          >
            إلغاء الأمر
          </Button>
          <Button
            onClick={onSave}
            loading={saving}
            disabled={conflictMsg !== "" || customerMode === "search"}
            className="rounded-xl font-black px-12 h-12 shadow-lg shadow-accent/20 text-sm flex gap-2"
          >
            <Save size={18} />{" "}
            {editingBooking ? "حفظ التعديلات" : "تأكيد وتسجيل الحجز"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
