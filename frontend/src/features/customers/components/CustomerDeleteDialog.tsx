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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>نقل العميل إلى الأرشيف؟</DialogTitle>
            <DialogDescription>
              سيتم نقل بيانات{" "}
              {customer ? customerName(customer) : "العميل"} إلى أرشيف
              العملاء، ويمكن استعادته في أي وقت من صفحة الأرشيف.
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
              نقل للأرشيف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
