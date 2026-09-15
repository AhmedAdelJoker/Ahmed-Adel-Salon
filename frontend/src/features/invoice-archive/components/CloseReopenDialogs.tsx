import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader } from "@/features/invoice-archive/components/ArchiveIcons";
import type { ArchiveMonth } from "@/features/invoice-archive/types";

export interface CloseReopenDialogsProps {
  confirmClose: ArchiveMonth | null;
  confirmReopen: ArchiveMonth | null;
  closingMonth: string | null;
  reopeningMonth: string | null;
  onCancelClose: () => void;
  onCancelReopen: () => void;
  onConfirmClose: (key: string) => void;
  onConfirmReopen: (key: string) => void;
}

export function CloseReopenDialogs({
  confirmClose,
  confirmReopen,
  closingMonth,
  reopeningMonth,
  onCancelClose,
  onCancelReopen,
  onConfirmClose,
  onConfirmReopen,
}: CloseReopenDialogsProps) {
  return (
    <>
      <Dialog
        open={!!confirmClose}
        onOpenChange={(open) => !open && onCancelClose()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30">
              <Lock size={26} />
            </div>
            <DialogTitle className="text-center text-lg font-black">
              إغلاق شهر {confirmClose?.label_ar || ""}
            </DialogTitle>
            <DialogDescription className="text-center text-[11px] font-bold leading-relaxed text-muted">
              بعد إغلاق هذا الشهر لن يمكن تعديل أو إلغاء فواتيره بعد الآن.
              {confirmClose?.invoice_count
                ? ` يحتوي على ${confirmClose.invoice_count} فاتورة.`
                : ""}
              هل أنت متأكد؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              onClick={() => onCancelClose()}
            >
              إلغاء
            </Button>
            <Button
              className="h-10 flex-1 rounded-xl bg-amber-600 hover:bg-amber-700"
              onClick={() => confirmClose && onConfirmClose(confirmClose.key)}
              disabled={closingMonth === confirmClose?.key}
            >
              {closingMonth === confirmClose?.key ? (
                <Loader className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock size={14} className="ml-2" />
              )}
              تأكيد الإغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmReopen}
        onOpenChange={(open) => !open && onCancelReopen()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
              <Unlock size={26} />
            </div>
            <DialogTitle className="text-center text-lg font-black">
              فتح شهر {confirmReopen?.label_ar || ""} للمراجعة
            </DialogTitle>
            <DialogDescription className="text-center text-[11px] font-bold leading-relaxed text-muted">
              ستتمكن من تعديل وإلغاء فواتير هذا الشهر مرة أخرى أثناء المراجعة.
              {confirmReopen?.invoice_count
                ? ` يحتوي على ${confirmReopen.invoice_count} فاتورة.`
                : ""}
              يمكنك إغلاقه مجددًا بعد الانتهاء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              onClick={() => onCancelReopen()}
            >
              إلغاء
            </Button>
            <Button
              className="h-10 flex-1 rounded-xl bg-blue-600 hover:bg-blue-700"
              onClick={() =>
                confirmReopen && onConfirmReopen(confirmReopen.key)
              }
              disabled={reopeningMonth === confirmReopen?.key}
            >
              {reopeningMonth === confirmReopen?.key ? (
                <Loader className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock size={14} className="ml-2" />
              )}
              تأكيد الفتح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
