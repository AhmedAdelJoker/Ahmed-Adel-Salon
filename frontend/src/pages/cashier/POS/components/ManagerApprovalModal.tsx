import { ShieldAlert } from "lucide-react";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_DISCOUNT_RATE = 0.4; // mirrors the server-side discount cap (40%)

const ManagerApprovalModal = () => {
  const { showApprovalModal, setShowApprovalModal } = usePOS();

  return (
    <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
      <DialogContent className="max-w-md rounded-[2rem]">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <ShieldAlert size={24} />
          </div>
          <DialogTitle className="text-center text-xl font-black">
            الخصم يتجاوز الحد المسموح
          </DialogTitle>
          <DialogDescription className="text-center text-xs font-bold text-muted leading-relaxed">
            تم رفض الفاتورة لأن مبلغ الخصم المُدخل يتجاوز النسق المسموح به (
            {Math.round(MAX_DISCOUNT_RATE * 100)}% من إجمالي الفاتورة).
            عدّل الخصم وأعد الإصدار، أو اطلب اعتماد الخصم الأكبر من شاشة
            الإدارة.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => setShowApprovalModal(false)}
            className="h-11 w-full rounded-xl font-black"
          >
            تعديل الخصم وإعادة المحاولة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerApprovalModal;
