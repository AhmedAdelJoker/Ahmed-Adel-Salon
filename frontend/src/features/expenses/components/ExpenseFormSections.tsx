import { Image as ImageIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
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
import { currencyLabel } from "@/lib/core/currency";

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
  const { t } = useTranslation("owner");
  const receiptRequired = ["إيجار", "مشتريات"].includes(formData.category);
  const readOnlyForVisitor = isEditing && !isOwner;

  return (
    <>
      {/* Section 1: Basic */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">1</div>
          <span className="text-[11px] font-black uppercase tracking-widest text-muted">{t("expenses.sectionBasic")}</span>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="expense-title" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldTitle")}</label>
          <Input id="expense-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} disabled={readOnlyForVisitor} className="h-11 rounded-xl bg-soft border-border font-bold" placeholder={t("expenses.fieldTitlePlaceholder")} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="expense-category" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldCategory")}</label>
            <Select disabled={readOnlyForVisitor} value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger id="expense-category" className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expense-amount" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldAmount")}</label>
            <div className="relative">
              <Input id="expense-amount" type="number" min="0" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} disabled={readOnlyForVisitor} className="h-11 rounded-xl bg-soft border-border font-black pe-4 ps-12" placeholder="0.00" />
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">{currencyLabel()}</span>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="expense-recipient" className="text-[10px] font-black text-muted uppercase tracking-widest">
            {t("expenses.fieldRecipient")} {receiptRequired && <span className="text-rose-500">*</span>}
          </label>
          <Input id="expense-recipient" value={formData.recipient_name} onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })} disabled={readOnlyForVisitor} className={cn("h-11 rounded-xl bg-soft border-border font-bold", receiptRequired && !formData.recipient_name?.trim() && "border-rose-300 focus:border-rose-500")} placeholder={receiptRequired ? t("expenses.recipientPlaceholderRequired") : t("expenses.recipientPlaceholderOptional")} aria-invalid={receiptRequired && !formData.recipient_name?.trim()} />
          {receiptRequired && !formData.recipient_name?.trim() && <p className="text-[10px] font-bold text-rose-600">{t("expenses.recipientRequiredHint")}</p>}
        </div>
      </div>

      {/* Section 2: Payment */}
      <div className="space-y-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-sky-600 text-white flex items-center justify-center text-[10px] font-black">2</div>
          <span className="text-[11px] font-black uppercase tracking-widest text-muted">{t("expenses.sectionPayment")}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="expense-payment" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldPaymentMethod")}</label>
            <Select disabled={readOnlyForVisitor} value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
              <SelectTrigger id="expense-payment" className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value} className="font-bold">{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expense-date" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldExpenseDate")}</label>
            <Input id="expense-date" type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} disabled={readOnlyForVisitor} className="h-11 rounded-xl bg-soft border-border font-bold" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="expense-description" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldDescription")}</label>
          <textarea id="expense-description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={readOnlyForVisitor} className="w-full min-h-[72px] rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none focus:border-slate-900 focus:ring-0 outline-none" placeholder={t("expenses.descPlaceholder")} />
        </div>
      </div>

      {/* Section 3: Linking + Internal */}
      <div className="space-y-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">3</div>
          <span className="text-[11px] font-black uppercase tracking-widest text-muted">{t("expenses.sectionLinking")}</span>
          <Badge variant="outline" className="me-auto rounded-full text-[9px] font-black">{t("expenses.optionalBadge")}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="expense-reference-type" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldReferenceType")}</label>
            <Select disabled={readOnlyForVisitor} value={formData.reference_type || "none"} onValueChange={(v) => setFormData({ ...formData, reference_type: v === "none" ? "" : v, reference_id: v === "none" ? "" : formData.reference_id })}>
              <SelectTrigger id="expense-reference-type" className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">{t("expenses.referenceNone")}</SelectItem>
                <SelectItem value="payroll">{t("expenses.referencePayroll")}</SelectItem>
                <SelectItem value="invoice">{t("expenses.referenceInvoice")}</SelectItem>
                <SelectItem value="product">{t("expenses.referenceProduct")}</SelectItem>
                <SelectItem value="booking">{t("expenses.referenceBooking")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expense-reference-id" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldReferenceId")}</label>
            <Input id="expense-reference-id" inputMode="numeric" value={formData.reference_id} onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })} disabled={readOnlyForVisitor || !formData.reference_type} className="h-11 rounded-xl bg-soft border-border font-bold" placeholder={!formData.reference_type ? t("expenses.referencePickTypeFirst") : t("expenses.referencePlaceholder")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="expense-internal-notes" className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldInternalNotes")}</label>
          <textarea id="expense-internal-notes" value={formData.internal_notes} onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })} disabled={readOnlyForVisitor} className="w-full min-h-[64px] rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-sm font-bold resize-none focus:border-amber-300 outline-none" placeholder={t("expenses.internalNotesPlaceholder")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.fieldInvoiceImage")}</label>
        <input type="file" id="expense-invoice-input" ref={invoiceInputRef as React.RefObject<HTMLInputElement>} onChange={onInvoiceUpload} className="hidden" accept="image/*" />
         <div
           role="button"
           tabIndex={!readOnlyForVisitor ? 0 : -1}
           onClick={() => !readOnlyForVisitor && invoiceInputRef.current?.click()}
           onKeyDown={(event) => {
             if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ") && !readOnlyForVisitor) {
               event.preventDefault();
               invoiceInputRef.current?.click();
             }
           }}
           className={cn("flex items-center gap-3 rounded-xl border-2 border-dashed p-3", !readOnlyForVisitor ? "cursor-pointer hover:bg-soft border-border" : "cursor-default border-border/50 bg-soft/50")}
         >

          {formData.invoice_image_url ? (
            <img src={formData.invoice_image_url.startsWith("http") ? formData.invoice_image_url : `${staticURL}${formData.invoice_image_url}`} alt="" className="h-16 w-16 rounded-xl object-cover border border-border" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <div className="h-16 w-16 rounded-xl border border-border bg-soft flex items-center justify-center">
              <ImageIcon size={20} className="text-muted/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-main">{formData.invoice_image_url ? t("expenses.invoiceAttachedReplace") : t("expenses.invoiceUploadCta")}</div>
            <div className="text-[10px] font-bold text-muted">{uploading ? t("expenses.uploading") : t("expenses.invoiceUploadHint")}</div>
          </div>
          {formData.invoice_image_url && !readOnlyForVisitor && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={(e) => { e.stopPropagation(); setFormData((p) => ({ ...p, invoice_image_url: "" })); }} aria-label={t("expenses.removeInvoice")}>
              <X size={14} />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
