/** Customers CustomerDeleteDialog (moved from Customers page, no logic changes). */
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { customerName } from "@/features/customers/utils/customer";

export default function CustomerDeleteDialog({
  open,
  onOpenChange,
  customer,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
      <Dialog
        open={!!customer}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف العميل؟</DialogTitle>
            <DialogDescription>
              سيتم حذف بيانات{" "}
              {customer ? customerName(customer) : "العميل"} بشكل نهائي.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => onClose()}
            >
              إلغاء
            </Button>
            <Button variant="danger" disabled={loading} onClick={onConfirm}>
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
