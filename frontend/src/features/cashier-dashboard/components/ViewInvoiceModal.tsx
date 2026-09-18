import type { Dispatch, SetStateAction } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/core/utils";
import type {
  InvoiceDialogState,
  TodayInvoice,
} from "@/features/cashier-dashboard/types";

export interface ViewInvoiceModalProps {
  viewInvoice: InvoiceDialogState;
  setViewInvoice: Dispatch<SetStateAction<InvoiceDialogState>>;
  onPrint: (invoice: TodayInvoice | null) => void;
}

export function ViewInvoiceModal({
  viewInvoice,
  setViewInvoice,
  onPrint,
}: ViewInvoiceModalProps) {
  return (
    <Dialog
      open={viewInvoice.open}
      onOpenChange={(open) => setViewInvoice({ open, data: null })}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            تفاصيل الفاتورة #{viewInvoice.data?.invoice_no || "---"}
          </DialogTitle>
        </DialogHeader>
        {viewInvoice.data && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-soft p-4 border border-border">
                <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
                  العميل
                </p>
                <p className="font-black text-main">
                  {viewInvoice.data.customer_name || "عميل عام"}
                </p>
              </div>
              <div className="rounded-xl bg-soft p-4 border border-border">
                <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
                  وسيلة الدفع
                </p>
                <p className="font-black text-main">
                  {viewInvoice.data.payment_method === "cash"
                    ? "نقدي"
                    : "شبكة"}
                </p>
              </div>
              <div className="rounded-xl bg-soft p-4 border border-border">
                <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
                  الإجمالي
                </p>
                <p className="text-xl font-black text-primary tabular-nums">
                  {formatCurrency(viewInvoice.data.total_amount)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                البنود
              </h4>
              <div className="rounded-2xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-soft/30">
                    <TableRow>
                      <TableHead className="text-[10px]">البند</TableHead>
                      <TableHead className="text-[10px] text-center">
                        الكمية
                      </TableHead>
                      <TableHead className="text-[10px] text-left">
                        السعر
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewInvoice.data.items?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-bold text-main">
                          {item.service_name}
                        </TableCell>
                        <TableCell className="text-center text-xs font-black tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-left text-xs font-black text-main tabular-nums">
                          {formatCurrency(item.total_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setViewInvoice({ open: false, data: null })}
            className="h-11 rounded-xl px-6"
          >
            إغلاق
          </Button>
          <Button
            onClick={() => onPrint(viewInvoice.data)}
            className="h-11 rounded-xl px-6 premium-button"
          >
            <Printer size={16} className="ml-2" /> طباعة إيصال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
