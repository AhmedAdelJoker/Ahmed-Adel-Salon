import { History, Clock, Plus, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn, formatNumber, formatDateTime } from "@/lib/core/utils";
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
  const { t } = useTranslation("owner");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-border bg-card p-0 shadow-premium">
        <DialogHeader className="border-b border-border/40 p-4 pb-3 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 sm:h-10 sm:w-10 sm:rounded-xl">
              <History size={16} className="text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-black sm:text-lg">{t("inventory.modal.historyTitle")}</DialogTitle>
              <DialogDescription className="text-[10px] font-medium text-muted">{productName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-2 overflow-y-auto p-4 sm:p-5">
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Clock className="animate-spin text-primary" size={24} />
              <p className="text-xs font-bold text-muted">{t("inventory.modal.loading")}</p>
            </div>
          ) : historyLogs.length > 0 ? (
            historyLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-xl border border-border bg-soft p-3">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", Number(log.change_amount) > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
                    {Number(log.change_amount) > 0 ? <Plus size={14} /> : <ArrowRight className="rotate-45" size={14} />}
                  </div>
                  <div>
                    <p className="text-xs font-black text-main">
                      {log.note || (Number(log.change_amount) > 0 ? t("inventory.modal.supplyIn") : t("inventory.modal.issueOut"))}
                    </p>
                    <p className="text-[9px] font-bold text-muted tabular-nums">{formatDateTime(log.created_at)}</p>
                  </div>
                </div>
                <div className={cn("text-sm font-black tabular-nums", Number(log.change_amount) > 0 ? "text-success" : "text-danger")}>
                  {Number(log.change_amount) > 0 ? "+" : ""}{formatNumber(log.change_amount)} {unitShortLabel}
                </div>
              </div>
            ))
          ) : (
            <EmptyState title={t("inventory.modal.noMovements")} message={t("inventory.modal.noMovementsHint")} icon={History} />
          )}
        </div>
        <DialogFooter className="border-t border-border bg-soft/10 p-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="h-10 rounded-xl px-5 text-xs">{t("inventory.modal.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HistoryModal;
