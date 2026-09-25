import type { Dispatch, SetStateAction } from "react";
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
import { Input } from "@/components/ui/input";
import type {
  AdjustmentFormState,
  InvoiceDialogState,
} from "@/features/cashier-dashboard/types";

export interface AdjustmentRequestModalProps {
  adjInvoice: InvoiceDialogState;
  setAdjInvoice: Dispatch<SetStateAction<InvoiceDialogState>>;
  adjForm: AdjustmentFormState;
  setAdjForm: Dispatch<SetStateAction<AdjustmentFormState>>;
  submittingAdj: boolean;
  onSubmit: () => void;
}

export function AdjustmentRequestModal({
  adjInvoice,
  setAdjInvoice,
  adjForm,
  setAdjForm,
  submittingAdj,
  onSubmit,
}: AdjustmentRequestModalProps) {
  return (
    <Dialog
      open={adjInvoice.open}
      onOpenChange={(open) => setAdjInvoice({ open, data: null })}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            طلب تعديل مالي
          </DialogTitle>
          <DialogDescription className="text-[11px] font-bold text-muted">
            سيتم إرسال هذا الطلب للمراجعة والاعتماد من قبل الإدارة.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 p-1">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              نوع التعديل
            </label>
            <Select
              value={adjForm.type}
              onValueChange={(v) => setAdjForm((p) => ({ ...p, type: v }))}
            >
              <SelectTrigger className="font-black h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount" className="font-bold">
                  تعديل الخصم
                </SelectItem>
                <SelectItem value="payment_method" className="font-bold">
                  تغيير طريقة الدفع
                </SelectItem>
                <SelectItem value="void" className="font-bold">
                  إلغاء الفاتورة بالكامل
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              سبب التعديل
            </label>
            <textarea
              className="w-full h-24 rounded-xl bg-soft p-4 text-sm font-bold border border-border focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted/40"
              placeholder="يرجى كتابة تفاصيل السبب..."
              value={adjForm.reason}
              onChange={(e) =>
                setAdjForm((p) => ({ ...p, reason: e.target.value }))
              }
            />
          </div>
          {adjForm.type !== "void" && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                القيمة الجديدة
              </label>
              <Input
                value={adjForm.newValue}
                onChange={(e) =>
                  setAdjForm((p) => ({ ...p, newValue: e.target.value }))
                }
                placeholder="أدخل المبلغ الجديد..."
                className="text-center font-black h-11"
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 pt-6">
          <Button
            variant="ghost"
            onClick={() => setAdjInvoice({ open: false, data: null })}
            className="h-11 rounded-xl"
          >
            تراجع
          </Button>
          <Button
            variant="warning"
            loading={submittingAdj}
            onClick={onSubmit}
            className="h-11 rounded-xl px-8 font-black"
          >
            تأكيد وإرسال الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
