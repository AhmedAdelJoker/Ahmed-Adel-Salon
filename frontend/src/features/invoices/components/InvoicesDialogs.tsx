import type { SetStateAction } from "react";
import {
  Ban,
  CreditCard,
  FileDown,
  Percent,
  Printer,
  Receipt,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  PAYMENT_METHOD_OPTIONS,
  formatCurrency,
  formatDate,
  invoiceBarber,
  invoiceCreatedAt,
  invoiceCustomer,
  invoiceDiscount,
  invoiceIsClosed,
  invoiceNo,
  invoicePaymentLabel,
  invoiceSubtotal,
  invoiceTotal,
  itemName,
  itemQty,
  itemTotal,
  rowsFromInvoice,
} from "@/features/invoices";

const ADJUSTMENT_PAYMENTS = PAYMENT_METHOD_OPTIONS.filter((method) =>
  ["cash", "card", "wallet", "bank_transfer"].includes(method.value),
);

export interface AdjustmentDialogState {
  open: boolean;
  invoice: Record<string, any> | null;
  type: string;
  reason: string;
  new_value: string;
  notes: string;
}

export interface InvoiceDetailsDialogProps {
  selectedInvoice: Record<string, any> | null;
  onClose: () => void;
  onPrintSelected: () => void;
  onOpenPdfSelected?: () => void;
}

export function InvoiceDetailsDialog({
  selectedInvoice,
  onClose,
  onPrintSelected,
  onOpenPdfSelected,
}: InvoiceDetailsDialogProps) {
  const closed = invoiceIsClosed(selectedInvoice);
  const items = selectedInvoice ? rowsFromInvoice(selectedInvoice) : [];
  const discount = selectedInvoice ? invoiceDiscount(selectedInvoice) : 0;

  return (
    <Dialog
      open={Boolean(selectedInvoice)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-lg p-0 sm:max-w-xl">
        <div className="border-b border-dashed border-border p-5 sm:p-6">
          <DialogHeader className="text-start">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Receipt size={20} />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-black sm:text-lg">
                    <span dir="ltr" className="whitespace-nowrap font-mono tracking-tight">
                      {selectedInvoice ? invoiceNo(selectedInvoice) : "—"}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-[10px] font-bold text-muted">
                    {selectedInvoice
                      ? formatDate(invoiceCreatedAt(selectedInvoice))
                      : ""}
                  </DialogDescription>
                </div>
              </div>
              <Badge variant={closed ? "danger" : "success"} size="sm">
                {closed ? "ملغاة" : "مكتملة"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="mt-5 rounded-2xl bg-primary-soft/70 p-4 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
              إجمالي الفاتورة
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-primary">
              {selectedInvoice ? formatCurrency(invoiceTotal(selectedInvoice)) : "—"}
            </p>
            {discount > 0 && (
              <p className="mt-1 text-[10px] font-bold text-muted">
                قبل الخصم {formatCurrency(invoiceSubtotal(selectedInvoice))} •
                خصم {formatCurrency(discount)}
              </p>
            )}
          </div>
        </div>

        {selectedInvoice && (
          <div className="max-h-[52vh] overflow-y-auto p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-2">
              <InfoCell
                icon={<User size={13} />}
                label="العميل"
                value={invoiceCustomer(selectedInvoice)}
              />
              <InfoCell
                icon={<User size={13} />}
                label="الخبير"
                value={invoiceBarber(selectedInvoice)}
              />
              <InfoCell
                icon={<Wallet size={13} />}
                label="طريقة الدفع"
                value={invoicePaymentLabel(selectedInvoice)}
              />
              <InfoCell
                icon={<Percent size={13} />}
                label="عدد البنود"
                value={`${items.length} بند`}
              />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  بنود الفاتورة
                </p>
                <Badge size="sm" variant="secondary">
                  {items.length} بند
                </Badge>
              </div>
              <div className="divide-y divide-dashed divide-border/70 rounded-2xl border border-border/60">
                {items.length === 0 && (
                  <p className="p-4 text-center text-xs font-bold text-muted">
                    لا توجد بنود مسجلة
                  </p>
                )}
                {items.map((item, index) => (
                  <div
                    key={item.id ?? index}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-main">
                        {itemName(item)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold text-muted">
                        {itemQty(item)} × {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-black tabular-nums text-main">
                      {formatCurrency(itemTotal(item))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-dashed border-border p-4 sm:p-5">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-10 rounded-xl px-4"
          >
            إغلاق
          </Button>
          {onOpenPdfSelected && (
            <Button
              variant="outline"
              onClick={onOpenPdfSelected}
              className="h-10 rounded-xl px-4"
            >
              <FileDown size={14} className="ms-1.5" /> PDF
            </Button>
          )}
          <Button
            onClick={onPrintSelected}
            className="h-10 rounded-xl px-5 premium-button"
          >
            <Printer size={14} className="ms-1.5" /> طباعة إيصال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-soft/50 p-2.5">
      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted">
        {icon} {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-main">{value}</p>
    </div>
  );
}

export interface AdjustmentRequestDialogProps {
  adjustmentDialog: AdjustmentDialogState;
  onAdjustmentDialogChange: (
    updater: SetStateAction<AdjustmentDialogState>,
  ) => void;
  adjustmentSubmitting: boolean;
  onSubmit: () => void;
}

const ADJUSTMENT_TYPES = [
  {
    value: "discount",
    label: "الخصم",
    description: "تعديل قيمة الخصم",
    icon: Percent,
  },
  {
    value: "payment_method",
    label: "طريقة الدفع",
    description: "تصحيح وسيلة التحصيل",
    icon: CreditCard,
  },
  {
    value: "void",
    label: "إلغاء الفاتورة",
    description: "إيقاف الفاتورة نهائيًا",
    icon: Ban,
  },
];

export function AdjustmentRequestDialog({
  adjustmentDialog,
  onAdjustmentDialogChange,
  adjustmentSubmitting,
  onSubmit,
}: AdjustmentRequestDialogProps) {
  const invoice = adjustmentDialog.invoice;
  const type = adjustmentDialog.type;
  const paymentValue = String(adjustmentDialog.new_value || "");
  const discountValue = Number(adjustmentDialog.new_value);
  const subtotal = invoice ? invoiceSubtotal(invoice) : 0;

  const invalidDiscount =
    type === "discount" &&
    (!adjustmentDialog.new_value ||
      !Number.isFinite(discountValue) ||
      discountValue < 0 ||
      discountValue > subtotal);
  const invalidPayment = type === "payment_method" && !paymentValue;
  const canSubmit =
    Boolean(adjustmentDialog.reason.trim()) &&
    !invalidDiscount &&
    !invalidPayment &&
    !adjustmentSubmitting;

  return (
    <Dialog
      open={adjustmentDialog.open}
      onOpenChange={(open) => onAdjustmentDialogChange((prev) => ({ ...prev, open }))}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-soft text-warning">
            <ShieldCheck size={20} />
          </div>
          <DialogTitle className="text-center text-lg font-black">
            طلب تعديل مالي
          </DialogTitle>
          <DialogDescription className="text-center text-[10px] font-bold text-muted">
            يمر الطلب بمراجعة المدير قبل الاعتماد
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="flex items-center justify-between rounded-xl bg-soft/70 px-3 py-2 text-[11px] font-bold">
            <span dir="ltr" className="font-mono text-main">
              {invoiceNo(invoice)}
            </span>
            <span className="text-primary">{formatCurrency(invoiceTotal(invoice))}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted">
              نوع التعديل
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {ADJUSTMENT_TYPES.map((option) => {
                const Icon = option.icon;
                const active = type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      onAdjustmentDialogChange((prev) => ({
                        ...prev,
                        type: option.value,
                        new_value: "",
                      }))
                    }
                    className={cn(
                      "rounded-xl border p-2.5 text-center transition-all",
                      active
                        ? "border-primary bg-primary-soft text-primary shadow-sm"
                        : "border-border bg-card text-muted hover:border-primary/40 hover:text-main",
                    )}
                    aria-pressed={active}
                  >
                    <Icon size={16} className="mx-auto" />
                    <span className="mt-1 block text-[10px] font-black">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {type === "discount" && (
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted">
                قيمة الخصم الجديدة
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={adjustmentDialog.new_value}
                  onChange={(event) =>
                    onAdjustmentDialogChange((prev) => ({
                      ...prev,
                      new_value: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  className="h-10 pe-12 text-center font-black tabular-nums"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">
                  ج.م
                </span>
              </div>
              <p className="mt-1 text-[9px] font-bold text-muted">
                الخصم الحالي {formatCurrency(invoiceDiscount(invoice))} • الحد
                الأقصى {formatCurrency(subtotal)}
              </p>
              {invalidDiscount && adjustmentDialog.new_value !== "" && (
                <p className="mt-1 text-[9px] font-bold text-danger">
                  أدخل قيمة بين صفر و{formatCurrency(subtotal)}
                </p>
              )}
            </div>
          )}

          {type === "payment_method" && (
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted">
                طريقة الدفع الصحيحة
              </label>
              <Select
                value={paymentValue}
                onValueChange={(value) =>
                  onAdjustmentDialogChange((prev) => ({
                    ...prev,
                    new_value: value,
                  }))
                }
              >
                <SelectTrigger className="h-10 rounded-xl font-bold">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_PAYMENTS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[9px] font-bold text-muted">
                الحالية: {invoicePaymentLabel(invoice)}
              </p>
            </div>
          )}

          {type === "void" && (
            <div className="rounded-xl border border-danger/20 bg-danger-soft p-3 text-[10px] font-bold leading-relaxed text-danger">
              سيتم إلغاء الفاتورة نهائيًا بعد اعتماد المدير، ولن تُحسب ضمن
              مبيعات الفترة.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted">
              سبب التعديل <span className="text-danger">*</span>
            </label>
            <textarea
              className="min-h-[76px] w-full rounded-xl border border-border bg-soft p-3 text-sm font-bold transition-all placeholder:text-muted/40 focus:outline-none focus:ring-4 focus:ring-primary/10"
              placeholder="اذكر سبب التعديل بالتفصيل..."
              value={adjustmentDialog.reason}
              onChange={(event) =>
                onAdjustmentDialogChange((prev) => ({
                  ...prev,
                  reason: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted">
              ملاحظات إضافية
            </label>
            <Input
              value={adjustmentDialog.notes}
              onChange={(event) =>
                onAdjustmentDialogChange((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="اختياري"
              className="h-10"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() =>
              onAdjustmentDialogChange((prev) => ({ ...prev, open: false }))
            }
            className="h-10 rounded-xl"
          >
            تراجع
          </Button>
          <Button
            variant="warning"
            loading={adjustmentSubmitting}
            disabled={!canSubmit}
            onClick={onSubmit}
            className="h-10 rounded-xl px-6 font-black"
          >
            إرسال الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
