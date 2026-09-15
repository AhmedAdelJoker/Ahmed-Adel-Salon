import type { SetStateAction } from "react";
import { Printer, ShieldCheck } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatDate,
  invoiceBarber,
  invoiceCreatedAt,
  invoiceCustomer,
  invoiceNo,
  invoicePayment,
  invoiceTotal,
  itemName,
  itemQty,
  itemTotal,
  paymentLabels,
  rowsFromInvoice,
} from "@/features/invoices";

export interface AdjustmentDialogState {
  open: boolean;
  invoice: Record<string, unknown> | null;
  type: string;
  reason: string;
  new_value: string;
  notes: string;
  manager_pin: string;
}

export interface InvoiceDetailsDialogProps {
  selectedInvoice: Record<string, unknown> | null;
  onClose: () => void;
  onPrintSelected: () => void;
}

export function InvoiceDetailsDialog({
  selectedInvoice,
  onClose,
  onPrintSelected,
}: InvoiceDetailsDialogProps) {
  return (
    <Dialog
      open={Boolean(selectedInvoice)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-lg sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black sm:text-xl">
            تفاصيل الفاتورة #{selectedInvoice && invoiceNo(selectedInvoice)}
          </DialogTitle>
          {selectedInvoice && (
            <DialogDescription className="text-[10px] font-bold text-muted">
              أُنشئت في {formatDate(invoiceCreatedAt(selectedInvoice))}
            </DialogDescription>
          )}
        </DialogHeader>

        {selectedInvoice && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-soft p-3 sm:p-4">
                <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[9px]">
                  العميل
                </p>
                <p className="truncate font-black text-main sm:text-sm">
                  {invoiceCustomer(selectedInvoice)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-soft p-3 sm:p-4">
                <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[9px]">
                  وسيلة الدفع
                </p>
                <p className="font-black text-main sm:text-sm">
                  {paymentLabels[invoicePayment(selectedInvoice)] ||
                    invoicePayment(selectedInvoice)}
                </p>
              </div>
              <div className="rounded-xl border border-primary-soft bg-primary-soft p-3 sm:p-4">
                <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-primary sm:text-[9px]">
                  الإجمالي
                </p>
                <p className="text-base font-black tabular-nums text-primary sm:text-xl">
                  {formatCurrency(invoiceTotal(selectedInvoice))}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-soft p-3 sm:p-4">
                <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[9px]">
                  الخبير
                </p>
                <p className="truncate font-black text-main sm:text-sm">
                  {invoiceBarber(selectedInvoice)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 sm:px-4 sm:py-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                  بنود الفاتورة
                </h4>
                <Badge size="sm">
                  {rowsFromInvoice(selectedInvoice).length} بند
                </Badge>
              </div>
              <div className="max-h-[300px] overflow-y-auto sm:max-h-[400px]">
                <Table>
                  <TableHeader className="bg-soft/30">
                    <TableRow>
                      <TableHead className="text-[10px]">البند</TableHead>
                      <TableHead className="text-center text-[10px]">
                        الكمية
                      </TableHead>
                      <TableHead className="text-left text-[10px]">
                        السعر
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsFromInvoice(selectedInvoice).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="text-xs font-black text-main sm:text-sm">
                            {itemName(item)}
                          </p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase text-primary sm:text-[9px]">
                            الخبير:{" "}
                            {item.barber_name ||
                              item.barberName ||
                              item.employee_name ||
                              invoiceBarber(selectedInvoice)}
                          </p>
                        </TableCell>
                        <TableCell className="text-center font-black tabular-nums">
                          {itemQty(item)}
                        </TableCell>
                        <TableCell className="text-left font-black tabular-nums text-main">
                          {formatCurrency(itemTotal(item))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-3 sm:pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-10 rounded-xl px-4 sm:h-11 sm:px-6"
          >
            إغلاق
          </Button>
          <Button
            onClick={onPrintSelected}
            className="h-10 rounded-xl px-4 sm:h-11 sm:px-6 premium-button"
          >
            <Printer size={14} className="ml-2 sm:hidden" />
            <Printer size={16} className="ml-2 hidden sm:block" /> طباعة
            إيصال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

export function AdjustmentRequestDialog({
  adjustmentDialog,
  onAdjustmentDialogChange,
  adjustmentSubmitting,
  onSubmit,
}: AdjustmentRequestDialogProps) {
  return (
    <Dialog
      open={adjustmentDialog.open}
      onOpenChange={(open) => onAdjustmentDialogChange((p) => ({ ...p, open }))}
    >
      <DialogContent className="max-w-sm sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-soft text-warning sm:h-12 sm:w-12">
            <ShieldCheck size={20} />
          </div>
          <DialogTitle className="text-center text-lg font-black sm:text-xl">
            تعديل مالي رقابي
          </DialogTitle>
          <DialogDescription className="text-center text-[10px] font-bold text-muted sm:text-[11px]">
            طلبات التعديل تمر بمراجعة المدير قبل الاعتماد
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-0.5 sm:space-y-5 sm:p-1">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted">
              نوع التعديل
            </label>
            <Select
              value={adjustmentDialog.type}
              onValueChange={(v) =>
                onAdjustmentDialogChange((p) => ({ ...p, type: v }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl font-black sm:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount" className="font-bold">
                  تعديل الخصم
                </SelectItem>
                <SelectItem value="payment_method" className="font-bold">
                  طريقة الدفع
                </SelectItem>
                <SelectItem value="void" className="font-bold">
                  إلغاء الفاتورة
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted">
              السبب
            </label>
            <textarea
              className="h-20 w-full rounded-xl border border-border bg-soft p-3 text-sm font-bold transition-all placeholder:text-muted/40 focus:outline-none focus:ring-4 focus:ring-primary/10 sm:h-24 sm:p-4"
              placeholder="لماذا يجب التعديل؟ يرجى ذكر التفاصيل..."
              value={adjustmentDialog.reason}
              onChange={(e) =>
                onAdjustmentDialogChange((p) => ({
                  ...p,
                  reason: e.target.value,
                }))
              }
            />
          </div>

          {adjustmentDialog.type !== "void" && (
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                القيمة الجديدة
              </label>
              <Input
                value={adjustmentDialog.new_value}
                onChange={(e) =>
                  onAdjustmentDialogChange((p) => ({
                    ...p,
                    new_value: e.target.value,
                  }))
                }
                placeholder="أدخل القيمة الجديدة..."
                className="h-10 text-center font-black sm:h-11"
              />
            </div>
          )}

          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted">
              كود المدير (للاعتماد)
            </label>
            <Input
              type="password"
              value={adjustmentDialog.manager_pin}
              onChange={(e) =>
                onAdjustmentDialogChange((p) => ({
                  ...p,
                  manager_pin: e.target.value,
                }))
              }
              className="h-10 text-center font-black tracking-[1em] sm:h-11"
              placeholder="••••"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4 sm:pt-6">
          <Button
            variant="ghost"
            onClick={() =>
              onAdjustmentDialogChange((p) => ({ ...p, open: false }))
            }
            className="h-10 rounded-xl sm:h-11"
          >
            تراجع
          </Button>
          <Button
            variant="warning"
            loading={adjustmentSubmitting}
            onClick={onSubmit}
            className="h-10 rounded-xl px-6 font-black sm:h-11 sm:px-8"
          >
            تأكيد الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
