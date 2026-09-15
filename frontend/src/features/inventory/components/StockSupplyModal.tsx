import { motion, AnimatePresence } from "framer-motion";
import { Plus, Database, AlertTriangle } from "lucide-react";
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
import { formatNumber } from "@/lib/core/utils";
import {
  formatQuantity,
  getAvailablePacks,
} from "@/features/inventory/design-tokens";
import { FormField } from "@/features/inventory/components/FormField";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-2xl p-0 border-border bg-card shadow-premium"
        dir="rtl"
      >
        <DialogHeader className="border-b border-border/40 p-4 pb-3 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 sm:h-10 sm:w-10 sm:rounded-xl">
              <Plus size={16} className="text-success" />
            </div>
            <div>
              <DialogTitle className="text-base font-black sm:text-lg">
                إذن توريد
              </DialogTitle>
              <DialogDescription className="text-[10px] font-medium text-muted">
                {editingProduct?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-5">
          <AnimatePresence mode="wait">
            {!showPriceAlert ? (
              <motion.div
                key="supply-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="rounded-xl border border-border bg-soft p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[8px] font-bold uppercase text-muted">
                        الرصيد الحالي
                      </p>
                      <p className="text-xs font-black text-main">
                        {editingProduct?.weight
                          ? `${formatNumber(getAvailablePacks(editingProduct))} عبوة`
                          : formatQuantity(
                              editingProduct?.quantity || 0,
                              stockUnitValue,
                            )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold uppercase text-muted">
                        سعة العبوة
                      </p>
                      <p className="text-xs font-black text-main">
                        {editingProduct?.weight
                          ? `${formatNumber(editingProduct.weight)} ${stockUnitShortLabel}`
                          : "---"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="الكمية (عبوات)">
                    <div className="relative">
                      <Input
                        type="number"
                        value={stockFormData.amount}
                        onChange={(e) =>
                          setStockFormData((p) => ({
                            ...p,
                            amount: e.target.value,
                          }))
                        }
                        className="h-10 rounded-xl bg-soft border-border font-black pl-10 sm:h-12 sm:pl-12"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:left-4">
                        عبوة
                      </span>
                    </div>
                  </FormField>
                  <FormField label="المورد">
                    <Input
                      value={stockFormData.note}
                      onChange={(e) =>
                        setStockFormData((p) => ({
                          ...p,
                          note: e.target.value,
                        }))
                      }
                      placeholder="اسم المورد..."
                      className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                    />
                  </FormField>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-soft p-3">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-success" />
                    <div>
                      <div className="text-[10px] font-black text-main">
                        تسجيل كمصروف
                      </div>
                      <div className="text-[8px] font-bold text-muted">
                        تحديث التكلفة تلقائياً
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={stockFormData.create_expense}
                    onCheckedChange={(v) =>
                      setStockFormData((p) => ({ ...p, create_expense: v }))
                    }
                    className="data-[state=checked]:bg-success"
                  />
                </div>
                <FormField label="سعر شراء العبوة">
                  <div className="relative">
                    <Input
                      type="number"
                      value={stockFormData.purchase_price}
                      onChange={(e) =>
                        setStockFormData((p) => ({
                          ...p,
                          purchase_price: e.target.value,
                        }))
                      }
                      placeholder={editingProduct?.cost_price || "0.00"}
                      className="h-10 rounded-xl bg-soft border-border font-black text-success pl-10 sm:h-12 sm:pl-12"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:left-4">
                      ج.م
                    </span>
                  </div>
                </FormField>
              </motion.div>
            ) : (
              <motion.div
                key="price-alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="rounded-xl bg-warning/5 border border-warning/20 p-5 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                    <AlertTriangle size={24} className="text-warning" />
                  </div>
                  <h3 className="text-base font-black text-warning sm:text-lg">
                    تغير في سعر التكلفة!
                  </h3>
                  <p className="mt-2 text-xs font-bold text-muted">
                    تم التوريد بسعر جديد ({stockFormData.purchase_price}{" "}
                    ج.م) بدلاً من ({editingProduct?.cost_price} ج.م). هل تود
                    تحديث سعر البيع؟
                  </p>
                </div>
                <FormField label="سعر البيع الجديد">
                  <div className="relative">
                    <Input
                      type="number"
                      value={newSellPrice}
                      onChange={(e) => setNewSellPrice(e.target.value)}
                      className="h-10 rounded-xl font-black text-primary border-primary/40 bg-primary/5 pl-10 sm:h-12 sm:pl-12"
                      autoFocus
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-primary/40 sm:left-4">
                      ج.م
                    </span>
                  </div>
                </FormField>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <DialogFooter className="border-t border-border bg-soft/10 p-4 gap-2 sm:p-5">
          {!showPriceAlert ? (
            <>
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl px-5 text-xs"
              >
                إلغاء
              </Button>
              <Button
                loading={saving}
                onClick={onConfirmSupply}
                className="h-10 rounded-xl px-6 text-xs"
              >
                تأكيد التوريد
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl px-5 text-xs"
              >
                تخطي
              </Button>
              <Button
                loading={saving}
                onClick={onUpdateSellPrice}
                className="h-10 rounded-xl px-6 text-xs bg-warning hover:bg-warning/90 text-white"
              >
                تحديث السعر
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StockSupplyModal;
