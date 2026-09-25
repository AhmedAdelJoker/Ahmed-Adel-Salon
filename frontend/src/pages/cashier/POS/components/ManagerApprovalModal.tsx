import React from "react";
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
            تعديل الفاتورة غير متاح
          </DialogTitle>
          <DialogDescription className="text-center text-xs font-bold text-muted">
            يتم التعامل مع التعديلات المالية عبر طلبات مراجعة موثقة بدل تجاوز
            الحماية من شاشة الدفع.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => setShowApprovalModal(false)}
            className="h-11 w-full rounded-xl font-black"
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerApprovalModal;
