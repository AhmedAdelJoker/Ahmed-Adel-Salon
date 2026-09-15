import { History, Clock, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import { cn, formatNumber } from "@/lib/core/utils";
import type { InventoryProductAny } from "@/features/inventory/hooks/useInventoryForm";

export interface HistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string | undefined;
  historyLoading: boolean;
  historyLogs: InventoryProductAny[];
  unitShortLabel: string;
}

export function HistoryModal({
  open,
  onOpenChange,
  productName,
  historyLoading,
  historyLogs,
  unitShortLabel,
}: HistoryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-2xl p-0 border-border bg-card shadow-premium"
        dir="rtl"
      >
        <DialogHeader className="border-b border-border/40 p-4 pb-3 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 sm:h-10 sm:w-10 sm:rounded-xl">
              <History size={16} className="text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-black sm:text-lg">
                سجل الحركات
              </DialogTitle>
              <DialogDescription className="text-[10px] font-medium text-muted">
                {productName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-2 overflow-y-auto p-4 sm:p-5">
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Clock className="animate-spin text-primary" size={24} />
              <p className="text-xs font-bold text-muted">جاري التحميل...</p>
            </div>
          ) : historyLogs.length > 0 ? (
            historyLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-xl border border-border bg-soft p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      log.change_amount > 0
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger",
                    )}
                  >
                    {log.change_amount > 0 ? (
                      <Plus size={14} />
                    ) : (
                      <ArrowRight className="rotate-45" size={14} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-main">
                      {log.note ||
                        (log.change_amount > 0 ? "توريد" : "صرف")}
                    </p>
                    <p className="text-[9px] font-bold text-muted">
                      {new Date(log.created_at).toLocaleString("ar-EG")}
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    "text-sm font-black",
                    log.change_amount > 0 ? "text-success" : "text-danger",
                  )}
                >
                  {log.change_amount > 0 ? "+" : ""}
                  {formatNumber(log.change_amount)} {unitShortLabel}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="لا توجد حركات"
              text="لم يتم تسجيل أي عمليات لهذا الصنف."
              icon={History}
            />
          )}
        </div>
        <DialogFooter className="border-t border-border bg-soft/10 p-4">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl px-5 text-xs"
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HistoryModal;
