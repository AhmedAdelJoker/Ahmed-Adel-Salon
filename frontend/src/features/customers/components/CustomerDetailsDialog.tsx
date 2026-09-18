/** Customers CustomerDetailsDialog (moved from Customers page, no logic changes). */
import { Archive, Clock, CreditCard, History, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/core/utils";
import CustomerMiniStat from "@/features/customers/components/CustomerMiniStat";
import { customerName, getInitials, secondPhone } from "@/features/customers/utils/customer";

export default function CustomerDetailsDialog({
  open,
  onOpenChange,
  customer,
  loading,
  onEdit,
  onClose,
  archived = false,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  loading: boolean;
  onEdit?: () => void;
  onClose: () => void;
  /** Archive mode: hides editing, shows archive metadata + restore action. */
  archived?: boolean;
  onRestore?: () => void;
}) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {archived ? "ملف العميل المؤرشف" : "الملف الاستراتيجي للعميل"}
            </DialogTitle>
            <DialogDescription>
              {archived
                ? "مراجعة بيانات العميل وسجل ولائه قبل الاستعادة أو الحذف النهائي."
                : "مراجعة بيانات العميل وسجل التعاملات."}
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
              {archived ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <CustomerMiniStat
                    label="تاريخ الأرشفة"
                    value={
                      customer.deleted_at
                        ? formatDateTime(customer.deleted_at)
                        : "---"
                    }
                    icon={Archive}
                  />
                  <CustomerMiniStat
                    label="فئة الولاء"
                    value={customer.current_tier || "Bronze"}
                    icon={ShieldCheck}
                  />
                  <CustomerMiniStat
                    label="نقاط الولاء"
                    value={`${customer.loyalty_points || 0} نقطة`}
                    icon={History}
                  />
                </div>
              ) : null}
              {customer.email || customer.address || customer.notes ? (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4 text-sm">
                  {customer.email ? (
                    <p className="font-bold text-main" dir="ltr">
                      {customer.email}
                    </p>
                  ) : null}
                  {customer.address ? (
                    <p className="font-bold text-muted">{customer.address}</p>
                  ) : null}
                  {customer.notes ? (
                    <p className="text-xs font-bold leading-relaxed text-muted">
                      {customer.notes}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            {archived ? (
              <Button
                disabled={loading}
                onClick={() => onRestore?.()}
                className="gap-1.5"
              >
                <RotateCcw size={16} /> استعادة العميل
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  customer && onEdit?.()
                }
              >
                تحديث الملف
              </Button>
            )}
            <Button
              variant={archived ? "outline" : undefined}
              disabled={loading && !archived}
              onClick={() => onClose()}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
