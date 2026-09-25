import { Image as ImageIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";
import { CATEGORIES, PAYMENT_METHODS } from "@/features/expenses/constants";
import type { ExpenseFormData } from "@/types/expenses";

interface ExpenseFormSectionsProps {
  formData: ExpenseFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExpenseFormData>>;
  isEditing: boolean;
  isOwner: boolean;
  uploading: boolean;
  invoiceInputRef: React.RefObject<HTMLInputElement | null>;
  onInvoiceUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function ExpenseFormSections({
  formData,
  setFormData,
  isEditing,
  isOwner,
  uploading,
  invoiceInputRef,
  onInvoiceUpload,
}: ExpenseFormSectionsProps) {
  return (
    <>
      {/* Section 1: Basic */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">1</div>
          <span className="text-[11px] font-black uppercase tracking-widest text-muted">البيانات الأساسية</span>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-muted uppercase tracking-widest">العنوان *</label>
          <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} disabled={isEditing && !isOwner} className="h-11 rounded-xl bg-soft border-border font-bold" placeholder="مثال: فاتورة الكهرباء..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">التصنيف *</label>
            <Select disabled={isEditing && !isOwner} value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">المبلغ *</label>
            <div className="relative">
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} disabled={isEditing && !isOwner} className="h-11 rounded-xl bg-soft border-border font-black pr-4 pl-12" placeholder="0.00" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">ج.م</span>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-muted uppercase tracking-widest">
            المستفيد / المورد {["إيجار", "مشتريات"].includes(formData.category) && <span className="text-rose-500">*</span>}
          </label>
          <Input value={formData.recipient_name} onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })} disabled={isEditing && !isOwner} className={cn("h-11 rounded-xl bg-soft border-border font-bold", ["إيجار", "مشتريات"].includes(formData.category) && !formData.recipient_name?.trim() && "border-rose-300 focus:border-rose-500")} placeholder={["إيجار", "مشتريات"].includes(formData.category) ? "مطلوب — اسم المالك أو المورد" : "اختياري — اسم الشخص أو الجهة"} />
          {["إيجار", "مشتريات"].includes(formData.category) && !formData.recipient_name?.trim() && <p className="text-[10px] font-bold text-rose-600">مطلوب لفئة الإيجار/المشتريات</p>}
        </div>
      </div>

      {/* Section 2: Payment */}
      <div className="space-y-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-sky-600 text-white flex items-center justify-center text-[10px] font-black">2</div>
          <span className="text-[11px] font-black uppercase tracking-widest text-muted">الدفع والوصف</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">طريقة الدفع</label>
            <Select disabled={isEditing && !isOwner} value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value} className="font-bold">{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">التاريخ</label>
            <Input type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} disabled={isEditing && !isOwner} className="h-11 rounded-xl bg-soft border-border font-bold" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-muted uppercase tracking-widest">الوصف العام</label>
          <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={isEditing && !isOwner} className="w-full min-h-[72px] rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none focus:border-slate-900 focus:ring-0 outline-none" placeholder="تفاصيل تظهر في الكشف..." />
        </div>
      </div>

      {/* Section 3: Linking + Internal */}
      <div className="space-y-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">3</div>
          <span className="text-[11px] font-black uppercase tracking-widest text-muted">الربط والملاحظات الداخلية</span>
          <Badge variant="outline" className="mr-auto rounded-full text-[9px] font-black">اختياري</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">نوع المرجع</label>
            <Select disabled={isEditing && !isOwner} value={formData.reference_type || "none"} onValueChange={(v) => setFormData({ ...formData, reference_type: v === "none" ? "" : v, reference_id: v === "none" ? "" : formData.reference_id })}>
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">بدون ربط</SelectItem>
                <SelectItem value="payroll">راتب</SelectItem>
                <SelectItem value="invoice">فاتورة</SelectItem>
                <SelectItem value="product">منتج/مخزون</SelectItem>
                <SelectItem value="booking">حجز</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">رقم المرجع</label>
            <Input value={formData.reference_id} onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })} disabled={isEditing && !isOwner || !formData.reference_type} className="h-11 rounded-xl bg-soft border-border font-bold" placeholder={!formData.reference_type ? "اختر النوع أولاً" : "مثال: 123"} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-muted uppercase tracking-widest">ملاحظات داخلية (لا تظهر في الكشف العام)</label>
          <textarea value={formData.internal_notes} onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })} disabled={isEditing && !isOwner} className="w-full min-h-[64px] rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-sm font-bold resize-none focus:border-amber-300 outline-none" placeholder="ملاحظة للمالك فقط..." />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-muted uppercase tracking-widest">صورة الفاتورة</label>
        <input type="file" ref={invoiceInputRef as React.RefObject<HTMLInputElement>} onChange={onInvoiceUpload} className="hidden" accept="image/*" />
         <div
           role="button"
           tabIndex={!isEditing || isOwner ? 0 : -1}
           onClick={() => (!isEditing || isOwner) && invoiceInputRef.current?.click()}
           onKeyDown={(event) => {
             if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ") && (!isEditing || isOwner)) {
               event.preventDefault();
               invoiceInputRef.current?.click();
             }
           }}
           className={cn("flex items-center gap-3 rounded-xl border-2 border-dashed p-3", (!isEditing || isOwner) ? "cursor-pointer hover:bg-soft border-border" : "cursor-default border-border/50 bg-soft/50")}
         >

          {formData.invoice_image_url ? (
            <img src={formData.invoice_image_url.startsWith("http") ? formData.invoice_image_url : `${staticURL}${formData.invoice_image_url}`} alt="" className="h-16 w-16 rounded-xl object-cover border border-border" />
          ) : (
            <div className="h-16 w-16 rounded-xl border border-border bg-soft flex items-center justify-center">
              <ImageIcon size={20} className="text-muted/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-main">{formData.invoice_image_url ? "صورة مرفقة - اضغط للتغيير" : "اضغط لرفع صورة الفاتورة"}</div>
            <div className="text-[10px] font-bold text-muted">JPG, PNG, WEBP • حتى 20MB • {uploading ? "جاري الرفع..." : "اختياري"}</div>
          </div>
          {formData.invoice_image_url && (!isEditing || isOwner) && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={(e) => { e.stopPropagation(); setFormData((p) => ({ ...p, invoice_image_url: "" })); }}>
              <X size={14} />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
