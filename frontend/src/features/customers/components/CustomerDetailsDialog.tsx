/** Customers CustomerDetailsDialog (moved from Customers page, no logic changes). */
import { Clock, CreditCard, History } from "lucide-react";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/core/utils";
import CustomerMiniStat from "@/features/customers/components/CustomerMiniStat";
import { customerName, getInitials, secondPhone } from "@/features/customers/utils/customer";

export default function CustomerDetailsDialog({
  open,
  onOpenChange,
  customer,
  loading,
  onEdit,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  loading: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>الملف الاستراتيجي للعميل</DialogTitle>
            <DialogDescription>
              مراجعة بيانات العميل وسجل التعاملات.
            </DialogDescription>
          </DialogHeader>
          {customer ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-5 bg-soft">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6D28D9] text-2xl font-black text-white dark:bg-[#22D3EE] dark:text-[#121212]">
                  {getInitials(customerName(customer))}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-950 dark:text-gray-50">
                    {customerName(customer)}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-gray-500" dir="ltr">
                    {customer.phone || "---"}
                  </p>
                  {secondPhone(customer) ? (
                    <p
                      className="mt-1 text-xs font-bold text-gray-400"
                      dir="ltr"
                    >
                      رقم آخر: {secondPhone(customer)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <CustomerMiniStat
                  label="الزيارات"
                  value={`${customer.visits_count || customer.visits || 0} زيارة`}
                  icon={History}
                />
                <CustomerMiniStat
                  label="إجمالي الإنفاق"
                  value={
                    formatCurrency(
                      customer.lifetime_spend ||
                        customer.total_spend ||
                        customer.totalSpend ||
                        0,
                    ) || ""
                  }
                  icon={CreditCard}
                />
                <CustomerMiniStat
                  label="آخر زيارة"
                  value={
                    customer.last_visit
                      ? new Date(
                          customer.last_visit,
                        ).toLocaleDateString("ar-EG")
                      : "---"
                  }
                  icon={Clock}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                customer && onEdit()
              }
            >
              تحديث الملف
            </Button>
            <Button disabled={loading} onClick={() => onClose()}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
