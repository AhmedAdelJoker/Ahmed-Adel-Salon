import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  Phone,
  Save,
  ShoppingCart,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { cn } from "@/lib/core/utils";
import { TODAY } from "@/features/bookings";

export default function BookingFormDialog({
  open,
  onOpenChange,
  editingBooking,
  formData,
  setFormData,
  customerMode,
  foundCustomer,
  customerSuggestions,
  duplicateBooking,
  conflictMsg,
  availableSlots,
  employees,
  services,
  categories,
  groupedServices,
  selectedServiceCategory,
  setSelectedServiceCategory,
  onPhoneChange,
  selectSuggestedCustomer,
  checkConflict,
  checkCustomerDuplicate,
  fetchAvailableSlots,
  calculateEndTime,
  onSave,
  saving,
  phoneInputRef,
}: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl w-[95vw] sm:w-full rounded-[2rem] p-0 border-0 bg-card shadow-premium overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <DialogHeader className="p-6 sm:p-8 pb-5 bg-gradient-to-br from-accent to-accent-strong relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <DialogTitle className="text-xl sm:text-2xl font-black text-white relative z-10 flex items-center gap-3 leading-none">
            <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Zap size={20} fill="currentColor" />
            </div>
            <span>
              {editingBooking ? "تعديل بيانات الحجز" : "تسجيل حجز جديد"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-white/70 font-medium text-xs sm:text-sm mt-1.5">
            منظومة الحجز الذكية: بحث بالرقم، كشف تضارب، وتنظيم الخدمات بحرفية.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Form Scrollable Area */}
        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 overflow-y-auto custom-scrollbar flex-1">
          {/* Left Column: Customer & Timing Details */}
          <div className="space-y-6">
            {/* Customer Phone Search */}
            <div className="space-y-3">
              <label className="text-xs font-black text-muted uppercase tracking-wider block">
                رقم هاتف العميل
              </label>
              <div className="relative w-full">
                <Input
                  ref={phoneInputRef}
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="h-12 sm:h-14 rounded-2xl bg-soft border-border focus:bg-card font-black text-lg text-center"
                  value={formData.customerPhone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                />

                {/* Phone Suggestions Popup */}
                {customerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-2xl shadow-premium overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                    {customerSuggestions.map((cus: any) => (
                      <button
                        key={cus.customer_id}
                        onClick={() => selectSuggestedCustomer(cus)}
                        className="w-full p-3 text-right flex items-center gap-3 hover:bg-soft border-b border-border/40 last:border-0 transition-colors"
                      >
                        <EmployeeAvatar
                          name={cus.first_name}
                          size="xs"
                          imageUrl={undefined}
                          role={undefined}
                          className={undefined}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-main truncate">
                            {cus.first_name} {cus.last_name}
                          </span>
                          <span className="text-[11px] font-bold text-muted dir-ltr">
                            {cus.phone}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Found State */}
              <AnimatePresence mode="wait">
                {customerMode === "found" && foundCustomer && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-accent/5 border border-emerald-500/20 flex items-center gap-4 shadow-sm relative overflow-hidden"
                  >
                    <EmployeeAvatar
                      name={foundCustomer.first_name || foundCustomer.name}
                      size="md"
                      className="ring-2 ring-emerald-500/30 shrink-0"
                      imageUrl={undefined}
                      role={undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          العميل المسجل
                        </p>
                        {foundCustomer.visit_count > 10 && (
                          <Badge className="bg-amber-500 text-white text-[10px] font-black px-1.5 h-4 border-none">
                            VIP
                          </Badge>
                        )}
                      </div>
                      <h5 className="text-base font-black text-main break-words">
                        {foundCustomer.first_name || foundCustomer.name}
                      </h5>
                      <p className="text-xs font-bold text-muted flex items-center gap-1 dir-ltr justify-end">
                        <Phone size={11} /> {foundCustomer.phone}
                      </p>
                    </div>
                  </motion.div>
                )}

                {customerMode === "new" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-accent/5 border-2 border-dashed border-accent/30 space-y-3"
                  >
                    <p className="text-xs font-black text-accent flex items-center gap-2">
                      <Sparkles size={14} /> عميل جديد! أدخل البيانات الأساسية:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="الاسم الأول..."
                        className="h-11 rounded-xl bg-card border-border font-bold text-xs"
                        value={formData.customerName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerName: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="اسم العائلة..."
                        className="h-11 rounded-xl bg-card border-border font-bold text-xs"
                        value={formData.customerLastName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerLastName: e.target.value,
                          })
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {duplicateBooking && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-2.5 text-xs font-bold">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black">{duplicateBooking.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Date & Time Selection */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted uppercase">
                    التاريخ
                  </label>
                  <Input
                    type="date"
                    min={TODAY}
                    className="h-11 rounded-xl bg-soft border-border font-black text-xs px-3"
                    value={formData.appointmentDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setFormData({ ...formData, appointmentDate: newDate });
                      checkConflict(
                        formData.employeeId,
                        newDate,
                        formData.appointmentTime,
                      );
                      checkCustomerDuplicate(
                        formData.customerId,
                        newDate,
                        editingBooking?.id,
                      );
                      fetchAvailableSlots(formData.employeeId, newDate);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-muted uppercase">
                      تحديد الموعد
                    </label>
                    {formData.appointmentTime && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const [h, m] = formData.appointmentTime
                              .split(":")
                              .map(Number);
                            const d = new Date();
                            d.setHours(h, m - 15);
                            const newTime = d.toTimeString().slice(0, 5);
                            setFormData({
                              ...formData,
                              appointmentTime: newTime,
                            });
                            checkConflict(
                              formData.employeeId,
                              formData.appointmentDate,
                              newTime,
                            );
                          }}
                          className="h-6 px-2 rounded-md bg-soft text-main hover:text-accent text-[11px] font-black border border-border"
                        >
                          -15 دقيقة
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const [h, m] = formData.appointmentTime
                              .split(":")
                              .map(Number);
                            const d = new Date();
                            d.setHours(h, m + 15);
                            const newTime = d.toTimeString().slice(0, 5);
                            setFormData({
                              ...formData,
                              appointmentTime: newTime,
                            });
                            checkConflict(
                              formData.employeeId,
                              formData.appointmentDate,
                              newTime,
                            );
                          }}
                          className="h-6 px-2 rounded-md bg-soft text-main hover:text-accent text-[11px] font-black border border-border"
                        >
                          +15 دقيقة
                        </button>
                      </div>
                    )}
                  </div>

                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-1 border border-border/40 rounded-xl bg-soft/30">
                      {availableSlots.map((slot: any) => (
                        <button
                          key={slot.time}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              appointmentTime: slot.time,
                            });
                            checkConflict(
                              formData.employeeId,
                              formData.appointmentDate,
                              slot.time,
                            );
                          }}
                          className={cn(
                            "p-2 rounded-lg text-xs font-black border transition-all text-center dir-ltr",
                            formData.appointmentTime === slot.time
                              ? "bg-accent border-accent text-white shadow-sm"
                              : slot.available
                                ? "bg-card border-border text-main hover:border-accent"
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
                      className="h-11 rounded-xl bg-soft border-border font-black text-xs px-3"
                      value={formData.appointmentTime}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          appointmentTime: e.target.value,
                        });
                        checkConflict(
                          formData.employeeId,
                          formData.appointmentDate,
                          e.target.value,
                        );
                      }}
                    />
                  )}
                </div>
              </div>

              {formData.appointmentTime && (
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between text-xs font-bold text-main">
                  <span className="flex items-center gap-1.5 text-accent font-black">
                    <Clock size={14} /> النهاية المتوقعة:
                  </span>
                  <span className="font-black text-accent dir-ltr">
                    {calculateEndTime() || "جاري الحساب..."}
                  </span>
                </div>
              )}

              {/* Barber Select */}
              <div className="space-y-2">
                <label className="text-xs font-black text-muted uppercase">
                  الخبير المسؤول
                </label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(v: string) => {
                    setFormData({ ...formData, employeeId: v });
                    checkConflict(
                      v,
                      formData.appointmentDate,
                      formData.appointmentTime,
                    );
                    fetchAvailableSlots(v, formData.appointmentDate);
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "h-12 rounded-xl bg-soft border-border font-bold text-xs",
                      conflictMsg &&
                        "border-rose-500 bg-rose-50 dark:bg-rose-950/20",
                    )}
                  >
                    <SelectValue placeholder="اختر الخبير..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border shadow-premium">
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

                {conflictMsg && (
                  <p className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-2 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                    <AlertTriangle size={14} /> {conflictMsg}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Service Selection & Notes */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-black text-muted uppercase tracking-wider block">
                اختيار الخدمات
              </label>

              {/* Category Tabs */}
              <Tabs
                value={selectedServiceCategory}
                onValueChange={setSelectedServiceCategory}
                className="w-full"
              >
                <TabsList className="bg-soft p-1 rounded-xl flex overflow-x-auto no-scrollbar gap-1 mb-3 h-auto border border-border">
                  <TabsTrigger
                    value="all"
                    className="rounded-lg px-3 py-1.5 text-xs font-black data-[state=active]:bg-card data-[state=active]:text-primary"
                  >
                    الكل
                  </TabsTrigger>
                  {categories.map((c: any) => (
                    <TabsTrigger
                      key={c.id}
                      value={String(c.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-black data-[state=active]:bg-card"
                    >
                      {c.name_ar || c.name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Services Grid */}
                <div className="bg-soft/40 rounded-2xl border border-border p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {(groupedServices[selectedServiceCategory] || []).map(
                      (s: any) => {
                        const active = formData.services.some(
                          (item: any) => item.serviceId === s.id,
                        );
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              if (active)
                                setFormData({
                                  ...formData,
                                  services: formData.services.filter(
                                    (i: any) => i.serviceId !== s.id,
                                  ),
                                });
                              else
                                setFormData({
                                  ...formData,
                                  services: [
                                    ...formData.services,
                                    { serviceId: s.id, quantity: 1 },
                                  ],
                                });
                            }}
                            className={cn(
                              "p-3 rounded-xl text-xs font-black border transition-all text-right flex items-center justify-between gap-2",
                              active
                                ? "bg-accent border-accent text-white shadow-md"
                                : "bg-card border-border/60 text-main hover:border-accent/50",
                            )}
                          >
                            <span className="break-words min-w-0">
                              {s.name_ar || s.name}
                            </span>
                            <span
                              className={cn(
                                "text-xs font-bold shrink-0",
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

                  {/* Cost Summary Box */}
                  <div className="pt-3 border-t border-border/40 flex justify-between items-center">
                    <div>
                      <p className="text-[11px] font-black text-muted uppercase">
                        المبلغ المتوقع
                      </p>
                      <p className="text-2xl font-black text-accent tabular-nums">
                        {formData.services.reduce((sum: number, item: any) => {
                          const s = services.find(
                            (srv: any) => srv.id === item.serviceId,
                          );
                          return sum + Number(s?.price || 0);
                        }, 0)}{" "}
                        <span className="text-xs font-bold opacity-60">
                          ج.م
                        </span>
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      <ShoppingCart size={20} />
                    </div>
                  </div>
                </div>
              </Tabs>
            </div>

            {/* Special Notes */}
            <div className="space-y-2">
              <label className="text-xs font-black text-muted uppercase tracking-wider block">
                ملاحظات خاصة
              </label>
              <textarea
                placeholder="أي رغبات إضافية للعميل..."
                className="w-full h-20 rounded-xl bg-soft border border-border p-3 font-bold text-xs focus:bg-card focus:border-accent outline-none resize-none transition-all"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 sm:p-6 bg-soft/40 border-t border-border/50 flex flex-row items-center justify-between gap-3 shrink-0">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-black px-6 h-11 text-xs"
          >
            إلغاء الأمر
          </Button>
          <Button
            onClick={onSave}
            loading={saving}
            disabled={conflictMsg !== "" || customerMode === "search"}
            className="rounded-xl font-black px-8 h-11 shadow-accent text-xs flex items-center gap-2"
          >
            <Save size={16} />
            <span>
              {editingBooking ? "حفظ التعديلات" : "تأكيد وتسجيل الحجز"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
