import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validatePhone } from "@/pages/cashier/customers/useCustomers";
import { Input } from "@/components/ui/input";
import { History, Phone, UserPlus } from "lucide-react";

export function CustomerFormDialog({
  isOpen,
  onClose,
  editingCustomer,
  form,
  onFormChange,
  onSubmit,
  isSaving,
}: any) {
  const phoneError = form.phone ? validatePhone(form.phone) : null;
  const phoneValid = form.phone && !phoneError;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-xl rounded-[2.5rem] p-0 border-0 bg-card shadow-premium overflow-hidden"
      >
        <DialogHeader className="p-8 pb-6 bg-[#020617] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 rounded-full -mr-24 -mt-24 blur-3xl" />
          <DialogTitle className="text-2xl font-black text-white relative z-10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            {editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
          </DialogTitle>
          <DialogDescription className="text-white/50 font-medium mt-1">
            حدّث بيانات العميل الأساسية لتظهر في الحجز ونقطة البيع.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-main flex items-center gap-1.5">
              <UserPlus size={14} className="text-accent" /> الاسم بالكامل
              (ثلاثي) *
            </label>
            <Input
              className="h-12 rounded-xl bg-soft border-border focus:bg-card font-bold"
              placeholder="محمد أحمد علي"
              value={form.firstName || ""}
              onChange={(e) =>
                onFormChange({ ...form, firstName: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-main flex items-center gap-1.5">
              <Phone size={14} className="text-accent" /> رقم الجوال *
            </label>
            <Input
              className="h-12 rounded-xl bg-soft border-border focus:bg-card font-bold"
              placeholder="01xxxxxxxxx"
              value={form.phone || ""}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
              dir="ltr"
            />
            {form.phone && phoneError && (
              <p className="text-[10px] font-bold text-rose-500">
                {phoneError}
              </p>
            )}
            {form.phone && phoneValid && (
              <p className="text-[10px] font-bold text-emerald-500">
                ✓ تنسيق صحيح
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-main flex items-center gap-1.5">
              <History size={14} className="text-accent" /> ملاحظات العميل
            </label>
            <textarea
              value={form.notes || ""}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              className="min-h-24 w-full rounded-xl border border-border bg-soft p-4 text-sm font-bold text-main outline-none transition focus:border-accent focus:bg-card resize-none"
              placeholder="أي تفاصيل إضافية أو تفضيلات للعميل..."
            />
          </div>
        </div>

        <DialogFooter className="p-8 border-t border-border bg-soft/10 gap-3">
          <Button
            variant="secondary"
            className="h-12 rounded-xl font-black uppercase text-xs"
            onClick={() => onClose(false)}
            disabled={isSaving}
          >
            إلغاء
          </Button>
          <Button
            className="h-12 rounded-xl px-10 font-black text-sm shadow-lg shadow-accent/20"
            onClick={onSubmit}
            loading={isSaving}
          >
            {editingCustomer ? "حفظ التغييرات" : "إضافة العميل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
