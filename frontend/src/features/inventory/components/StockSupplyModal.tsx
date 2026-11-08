import { motion, AnimatePresence } from "framer-motion";
import { Plus, Database, AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, formatNumber } from "@/lib/core/utils";
import { formatQuantity, getAvailablePacks } from "@/features/inventory/design-tokens";
import { FormField } from "@/features/inventory";
import { currencyLabel } from "@/lib/core/currency";
import type {
  InventoryProductAny,
  StockFormData,
} from "@/features/inventory/hooks/useInventoryForm";

export interface StockSupplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: InventoryProductAny | null;
  stockUnitValue: string;
  stockUnitShortLabel: string;
  stockFormData: StockFormData;
  setStockFormData: React.Dispatch<React.SetStateAction<StockFormData>>;
  showPriceAlert: boolean;
  newSellPrice: string;
  setNewSellPrice: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  onConfirmSupply: () => void;
  onUpdateSellPrice: () => void;
}

export function StockSupplyModal({
  open,
  onOpenChange,
  editingProduct,
  stockUnitValue,
  stockUnitShortLabel,
  stockFormData,
  setStockFormData,
  showPriceAlert,
  newSellPrice,
  setNewSellPrice,
  saving,
  onConfirmSupply,
  onUpdateSellPrice,
}: StockSupplyModalProps) {
  const { t } = useTranslation("owner");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-border bg-card p-0 shadow-premium">
        <DialogHeader className="border-b border-border/40 p-4 pb-3 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 sm:h-10 sm:w-10 sm:rounded-xl">
              <Plus size={16} className="text-success" />
            </div>
            <div>
              <DialogTitle className="text-base font-black sm:text-lg">{t("inventory.modal.supplyTitle")}</DialogTitle>
              <DialogDescription className="text-[10px] font-medium text-muted">{editingProduct?.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-5">
          <AnimatePresence>
            {!showPriceAlert ? (
              <motion.div key="supply-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="rounded-xl border border-border bg-soft p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[8px] font-bold uppercase text-muted">{t("inventory.modal.currentBalance")}</p>
                      <p className="text-xs font-black text-main">
                        {editingProduct?.weight
                          ? `${formatNumber(getAvailablePacks(editingProduct))} ${t("inventory.modal.pack")}`
                          : formatQuantity(editingProduct?.quantity || 0, stockUnitValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold uppercase text-muted">{t("inventory.modal.packSize")}</p>
                      <p className="text-xs font-black text-main">
                        {editingProduct?.weight ? `${formatNumber(editingProduct.weight)} ${stockUnitShortLabel}` : "---"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("inventory.modal.qtyPacks")}>
                    <div className="relative">
                      <Input type="number" value={stockFormData.amount} onChange={(e) => setStockFormData((p) => ({ ...p, amount: e.target.value }))} className="h-10 rounded-xl border-border bg-soft ps-10 font-black sm:h-12 sm:ps-12" />
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:start-4">{t("inventory.modal.pack")}</span>
                    </div>
                  </FormField>
                  <FormField label={t("inventory.modal.supplier")}>
                    <Input value={stockFormData.note} onChange={(e) => setStockFormData((p) => ({ ...p, note: e.target.value }))} placeholder={t("inventory.modal.supplierPlaceholder")} className="h-10 rounded-xl border-border bg-soft font-bold sm:h-12" />
                  </FormField>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-soft p-3">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-success" />
                    <div>
                      <div className="text-[10px] font-black text-main">{t("inventory.modal.recordExpense")}</div>
                      <div className="text-[8px] font-bold text-muted">{t("inventory.modal.recordExpenseHint")}</div>
                    </div>
                  </div>
                  <Switch checked={stockFormData.create_expense} onCheckedChange={(v) => setStockFormData((p) => ({ ...p, create_expense: v }))} className="data-[state=checked]:bg-success" />
                </div>
                <FormField label={t("inventory.modal.purchasePrice")}>
                  <div className="relative">
                    <Input type="number" value={stockFormData.purchase_price} onChange={(e) => setStockFormData((p) => ({ ...p, purchase_price: e.target.value }))} placeholder={String(editingProduct?.cost_price || "0.00")} className="h-10 rounded-xl border-border bg-soft ps-10 font-black text-success sm:h-12 sm:ps-12" />
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:start-4">{currencyLabel()}</span>
                  </div>
                </FormField>
              </motion.div>
            ) : (
              <motion.div key="price-alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="rounded-xl border border-warning/20 bg-warning/5 p-5 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10"><AlertTriangle size={24} className="text-warning" /></div>
                  <h3 className="text-base font-black text-warning sm:text-lg">{t("inventory.modal.costChanged")}</h3>
                  <p className="mt-2 text-xs font-bold text-muted">{t("inventory.modal.costChangedDesc")}</p>
                </div>
                <FormField label={t("inventory.modal.newSellPrice")}>
                  <div className="relative">
                    <Input type="number" value={newSellPrice} onChange={(e) => setNewSellPrice(e.target.value)} className="h-10 rounded-xl border-primary/40 bg-primary/5 ps-10 font-black text-primary sm:h-12 sm:ps-12" autoFocus />
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-primary/40 sm:start-4">{currencyLabel()}</span>
                  </div>
                </FormField>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <DialogFooter className="gap-2 border-t border-border bg-soft/10 p-4 sm:p-5">
          {!showPriceAlert ? (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)} className="h-10 rounded-xl px-5 text-xs">{t("inventory.modal.cancel")}</Button>
              <Button loading={saving} onClick={onConfirmSupply} className="h-10 rounded-xl px-6 text-xs">{t("inventory.modal.confirmSupply")}</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)} className="h-10 rounded-xl px-5 text-xs">{t("inventory.modal.skip")}</Button>
              <Button loading={saving} onClick={onUpdateSellPrice} className="h-10 rounded-xl bg-warning px-6 text-xs text-white hover:bg-warning/90">{t("inventory.modal.updatePrice")}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StockSupplyModal;
