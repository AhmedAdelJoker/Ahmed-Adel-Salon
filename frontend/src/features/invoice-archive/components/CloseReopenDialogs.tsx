import { FileText, Lock, Trash2, Unlock } from "lucide-react";
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
import { formatCurrency } from "@/lib/core/utils";
import type { ArchiveMonth, MonthInvoice } from "@/features/invoice-archive/types";

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
              قفل شهر {confirmClose?.label_ar || ""}
            </DialogTitle>
            <DialogDescription className="text-center text-[11px] font-bold leading-relaxed text-muted">
              قفل الشهر يمنع أي تعديل على فواتيره (خصم، طريقة دفع، إلغاء) حتى
              تعيد فتحه للمراجعة. الفواتير الملغاة منفردة لا تتأثر.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-soft/50 p-3 text-center">
            <div>
              <p className="text-[9px] font-bold text-muted">فاتورة نهائية</p>
              <p className="mt-0.5 text-sm font-black tabular-nums text-main">
                {confirmClose?.invoice_count || 0}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted">ملغاة منفردة</p>
              <p className="mt-0.5 text-sm font-black tabular-nums text-red-500">
                {confirmClose?.voided_count || 0}
              </p>
            </div>
          </div>

          {confirmClose?.draft_count ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-bold leading-relaxed text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300">
              <FileText size={13} className="mt-0.5 shrink-0" />
              يوجد {confirmClose.draft_count} مسودة في هذا الشهر. أكملها أو
              احذفها قبل القفل.
            </div>
          ) : (
            <p className="text-center text-[9px] font-bold text-muted">
              لا توجد مسودات في هذا الشهر.
            </p>
          )}

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
              disabled={
                closingMonth === confirmClose?.key ||
                Boolean(confirmClose?.draft_count)
              }
            >
              {closingMonth === confirmClose?.key ? (
                <Loader className="ms-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock size={14} className="ms-2" />
              )}
              تأكيد القفل
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
              إعادة فتح شهر {confirmReopen?.label_ar || ""}
            </DialogTitle>
            <DialogDescription className="text-center text-[11px] font-bold leading-relaxed text-muted">
              ستتمكن من تعديل فواتير هذا الشهر مرة أخرى أثناء المراجعة. الفواتير
              الملغاة منفردة تبقى ملغاة. يمكنك قفله مجددًا بعد الانتهاء.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/60 bg-soft/50 p-3 text-center">
            <p className="text-[9px] font-bold text-muted">فواتير الشهر</p>
            <p className="mt-0.5 text-sm font-black tabular-nums text-main">
              {confirmReopen?.invoice_count || 0}
            </p>
          </div>

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
                <Loader className="ms-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock size={14} className="ms-2" />
              )}
              تأكيد إعادة الفتح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface DeleteDraftDialogProps {
  draft: MonthInvoice | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteDraftDialog({
  draft,
  busy,
  onCancel,
  onConfirm,
}: DeleteDraftDialogProps) {
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-900/30">
            <Trash2 size={26} />
          </div>
          <DialogTitle className="text-center text-lg font-black">
            حذف المسودة
          </DialogTitle>
          <DialogDescription className="text-center text-[11px] font-bold leading-relaxed text-muted">
            المسودة {draft?.invoice_no || ""} بقيمة{" "}
            {draft ? formatCurrency(Number(draft.total_amount || 0)) : ""} سيتم
            حذفها نهائيًا. استخدم «إتمام» لو كانت الفاتورة صحيحة.          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button
            variant="outline"
            className="h-10 flex-1 rounded-xl"
            onClick={onCancel}
          >
            إلغاء
          </Button>
          <Button
            className="h-10 flex-1 rounded-xl bg-red-600 hover:bg-red-700"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <Loader className="ms-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 size={14} className="ms-2" />
            )}
            حذف المسودة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
