import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/core/utils";
import {
  Plus,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Package,
  Database,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getAvailablePacks,
  getEstimatedUnitCost,
} from "@/features/inventory/design-tokens";
import { Metric } from "@/features/inventory";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AnimatePresence } from "framer-motion";

const STEPS = [
  {
    id: "details",
    label: "بيانات التوريد",
    icon: Package,
    description: "الكمية، المورد، والملاحظات",
  },
  {
    id: "cost",
    label: "تحديث التكلفة",
    icon: Database,
    description: "سعر الشراء وتحديث التكلفة",
    conditional: true,
  },
  {
    id: "price",
    label: "مراجعة السعر",
    icon: DollarSign,
    description: "تعديل سعر البيع إذا لزم",
    conditional: true,
  },
  {
    id: "confirm",
    label: "تأكيد",
    icon: CheckCircle2,
    description: "مراجعة نهائية وإرسال",
  },
];

export function StockWizard({
  product,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  unitMeta,
  stockUnit,
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    amount: "",
    note: "",
    create_expense: true,
    purchase_price: "",
    invoice_image_url: "",
  });
  const [showPriceAlert, setShowPriceAlert] = useState(false);
  const [newSellPrice, setNewSellPrice] = useState("");
  interface PriceAlertData {
    oldCost?: number;
    newCost?: number;
    oldSellPrice?: number | string;
    purchasePrice?: number | string;
    [key: string]: unknown;
  }

  const [priceAlertData, setPriceAlertData] = useState<PriceAlertData | null>(null);

  // Determine which steps are active based on form data
  const activeSteps = useMemo(() => {
    const steps = [STEPS[0]]; // Always show details

    // Cost step shows if create_expense is true
    if (formData.create_expense) {
      steps.push(STEPS[1]);
    }

    // Price step shows if cost changed and there's a price alert
    if (showPriceAlert) {
      steps.push(STEPS[2]);
    }

    steps.push(STEPS[3]); // Always show confirm
    return steps;
  }, [formData.create_expense, showPriceAlert]);

  const currentStepData = activeSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === activeSteps.length - 1;

  const availablePacks = getAvailablePacks(product);
  const estimatedUnitCost = getEstimatedUnitCost(product);
  const oldCostPrice = Number(product?.cost_price || 0);

  const handleNext = () => {
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.amount || Number(formData.amount) <= 0) {
      // This shouldn't happen due to validation, but just in case
      return;
    }

    if (
      formData.create_expense &&
      (!formData.purchase_price || Number(formData.purchase_price) <= 0)
    ) {
      return;
    }

    const payload = {
      amount: Number(formData.amount),
      note: formData.note,
      create_expense: formData.create_expense,
      purchase_price: formData.purchase_price
        ? Number(formData.purchase_price)
        : null,
      invoice_image_url: formData.invoice_image_url,
      new_sell_price:
        showPriceAlert && newSellPrice ? Number(newSellPrice) : undefined,
    };

    await onSubmit(payload);
  };

  const handlePriceUpdate = async () => {
    try {
      await onSubmit({
        ...formData,
        new_sell_price: Number(newSellPrice),
        update_price_only: true,
      });
      onOpenChange(false);
    } catch (error) {
      throw error;
    }
  };

  const nextStepHandler = () => {
    if (currentStepData.id === "details") {
      // Validate details step
      if (!formData.amount || Number(formData.amount) <= 0) return;
      if (
        formData.create_expense &&
        (!formData.purchase_price || Number(formData.purchase_price) <= 0)
      )
        return;

      // Trigger price alert if cost changed (will show price step)
      const newCost = Number(formData.purchase_price || 0);
      if (
        formData.create_expense &&
        newCost !== oldCostPrice &&
        oldCostPrice > 0
      ) {
        setPriceAlertData({
          oldCost: oldCostPrice,
          newCost,
          oldSellPrice: product?.sell_price || 0,
          purchasePrice: formData.purchase_price,
        });
        setNewSellPrice(product?.sell_price || "");
        setShowPriceAlert(true);
      }
      handleNext();
    } else if (currentStepData.id === "cost") {
      handleNext();
    } else if (currentStepData.id === "price") {
      handlePriceUpdate();
    } else if (currentStepData.id === "confirm") {
      handleSubmit();
    }
  };

  // Reset wizard when closed
  React.useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setFormData({
        amount: "",
        note: "",
        create_expense: true,
        purchase_price: "",
        invoice_image_url: "",
      });
      setShowPriceAlert(false);
      setNewSellPrice("");
      setPriceAlertData(null);
    }
  }, [open]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl rounded-[2.5rem] p-0 border-0 bg-card shadow-premium overflow-hidden"
      >
        {/* Wizard Header */}
        <div className="bg-[#020617] relative overflow-hidden p-6 pb-4">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 rounded-full -mr-24 -mt-24 blur-3xl" />

          {/* Progress Indicator */}
          <div className="relative z-10 mb-6">
            <div className="flex items-center justify-between">
              {activeSteps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center">
                    <div
                      className={cn(
                        "h-2 w-16 transition-all duration-300 ease-spring",
                        index < currentStep ? "bg-accent" : "bg-white/10",
                      )}
                    />
                    {index < activeSteps.length - 1 && (
                      <div
                        className={cn(
                          "h-1 flex-1 max-w-16 mx-2 transition-all duration-300",
                          index < currentStep ? "bg-accent" : "bg-white/10",
                        )}
                      />
                    )}
                  </div>
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0",
                      index < currentStep
                        ? "bg-accent text-white"
                        : index === currentStep
                          ? "bg-white/10 text-white border-2 border-accent"
                          : "bg-white/5 text-white/40",
                    )}
                  >
                    {index < currentStep ? (
                      <Check size={16} />
                    ) : (
                      <step.icon size={18} />
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Step Labels */}
            <div className="flex justify-between mt-3 text-[10px] font-bold uppercase tracking-widest">
              {activeSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "w-10 text-center transition-colors",
                    index === currentStep ? "text-accent" : "text-white/40",
                  )}
                >
                  {step.label}
                </div>
              ))}
            </div>
          </div>

          <DialogTitle className="text-2xl font-black text-white relative z-10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
              <Plus size={20} />
            </div>
            إذن توريد مخزون
          </DialogTitle>
          <DialogDescription className="text-white/50 font-medium mt-1">
            منتج: {product?.name}
          </DialogDescription>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepData.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-8 space-y-6 max-h-[70vh] overflow-y-auto"
          >
            {currentStepData.id === "details" && (
              <SupplyDetailsForm
                product={product}
                formData={formData}
                setFormData={setFormData}
                unitMeta={unitMeta}
                stockUnit={stockUnit}
                availablePacks={availablePacks}
                estimatedUnitCost={estimatedUnitCost}
              />
            )}

            {currentStepData.id === "cost" && (
              <CostUpdateForm
                product={product}
                formData={formData}
                setFormData={setFormData}
                oldCostPrice={oldCostPrice}
                unitMeta={unitMeta}
              />
            )}

            {currentStepData.id === "price" && (
              <PriceReviewForm
                product={product}
                priceAlertData={priceAlertData}
                newSellPrice={newSellPrice}
                setNewSellPrice={setNewSellPrice}
                unitMeta={unitMeta}
              />
            )}

            {currentStepData.id === "confirm" && (
              <ConfirmSummary
                product={product}
                formData={formData}
                priceAlertData={priceAlertData}
                newSellPrice={newSellPrice}
                unitMeta={unitMeta}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <DialogFooter className="p-8 border-t border-border bg-soft/10 gap-3 justify-between">
          <div className="flex-1">
            {!isFirstStep && (
              <Button
                variant="secondary"
                onClick={handleBack}
                className="h-12 rounded-xl px-8 font-black uppercase text-xs"
                disabled={isSubmitting}
              >
                <ChevronRight size={18} className="mr-2" /> رجوع
              </Button>
            )}
          </div>
          <div className="flex-1 flex justify-end">
            {isLastStep ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  className="h-12 rounded-xl px-8 font-black uppercase text-xs mr-2"
                  disabled={isSubmitting}
                >
                  إلغاء
                </Button>
                <Button
                  loading={isSubmitting}
                  onClick={nextStepHandler}
                  className="h-12 rounded-xl px-10 font-black shadow-lg shadow-accent/20"
                >
                  {currentStepData.id === "price"
                    ? "تحديث السعر وإغلاق"
                    : "تأكيد التوريد"}
                </Button>
              </>
            ) : (
              <Button
                onClick={nextStepHandler}
                className="h-12 rounded-xl px-10 font-black shadow-lg shadow-accent/20"
                disabled={
                  currentStepData.id === "details" &&
                  (!formData.amount ||
                    Number(formData.amount) <= 0 ||
                    (formData.create_expense &&
                      (!formData.purchase_price ||
                        Number(formData.purchase_price) <= 0)))
                }
              >
                التالي <ChevronLeft size={18} className="ml-2" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== STEP COMPONENTS ==================== */

function SupplyDetailsForm({
  product,
  formData,
  setFormData,
  unitMeta,
  stockUnit,
  availablePacks,
  estimatedUnitCost,
}) {
  return (
    <div className="space-y-6">
      {/* Current Stock Summary */}
      <div className="rounded-3xl border border-border/40 bg-soft p-6">
        <div className="grid grid-cols-2 gap-6">
          <Metric
            label="الرصيد الحالي"
            value={
              product.weight
                ? `${availablePacks} عبوة`
                : `${Number(product?.quantity || 0)} ${stockUnit.shortLabel}`
            }
            accent
          />
          <Metric
            label="سعة العبوة"
            value={
              product.weight
                ? `${product.weight} ${stockUnit.shortLabel}`
                : "---"
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-muted/60 uppercase tracking-[0.2em] block">
            الكمية الموردة (عبوات)
          </label>
          <div className="relative">
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) =>
                setFormData((p) => ({ ...p, amount: e.target.value }))
              }
              placeholder="0"
              className="h-12 rounded-xl bg-soft border-border focus:bg-card font-black pl-14"
              min="1"
              step="1"
              autoFocus
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">
              عبوة
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-muted/60 uppercase tracking-[0.2em] block">
            المورد / البيان
          </label>
          <Input
            value={formData.note}
            onChange={(e) =>
              setFormData((p) => ({ ...p, note: e.target.value }))
            }
            placeholder="اسم المورد..."
            className="h-12 rounded-xl bg-soft border-border focus:bg-card font-black"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-soft p-5">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Package size={20} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-black text-main">
                تسجيل كمصروف وتحديث التكلفة
              </div>
              <div className="text-[10px] font-bold text-muted leading-none mt-1">
                سيتم تحديث سعر الشراء تلقائياً.
              </div>
            </div>
          </div>
          <Switch
            checked={formData.create_expense}
            onCheckedChange={(v) =>
              setFormData((p) => ({ ...p, create_expense: v }))
            }
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>

        {formData.create_expense && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted/60 uppercase tracking-[0.2em] block">
              سعر شراء العبوة الواحدة (ج.م)
            </label>
            <div className="relative">
              <Input
                type="number"
                value={formData.purchase_price}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, purchase_price: e.target.value }))
                }
                placeholder={product?.cost_price || "0.00"}
                className="h-12 rounded-xl bg-soft border-border focus:bg-card font-black text-emerald-600 pl-12"
                step="0.01"
                min="0"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">
                ج.م
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CostUpdateForm({
  product,
  formData,
  setFormData,
  oldCostPrice,
  unitMeta,
}) {
  const newCostPrice = formData.purchase_price
    ? Number(formData.purchase_price)
    : 0;
  const costChanged = newCostPrice !== oldCostPrice && oldCostPrice > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 p-6 space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl -mr-12 -mt-12" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Database size={18} className="text-primary" />
            </div>
            <span className="text-[11px] font-black text-foreground uppercase tracking-[0.2em]">
              تفاصيل تحديث التكلفة
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[8px] text-muted/60 font-black uppercase mb-1">
                التكلفة السابقة
              </p>
              <p className="text-xl font-black text-main">
                {formatCurrency(oldCostPrice)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[8px] text-muted/60 font-black uppercase mb-1">
                التكلفة الجديدة
              </p>
              <p className="text-xl font-black text-primary">
                {formatCurrency(newCostPrice)}
              </p>
            </div>
          </div>

          {costChanged && (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
              <AlertTriangle size={12} className="text-amber-500 mt-0.5" />
              <p className="text-[10px] font-bold text-foreground/80 leading-relaxed">
                تغير تكلفة العبوة من {formatCurrency(oldCostPrice)} إلى{" "}
                {formatCurrency(newCostPrice)}. يُنصح بمراجعة سعر البيع في
                الخطوة التالية.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PriceReviewForm({
  product,
  priceAlertData,
  newSellPrice,
  setNewSellPrice,
  unitMeta,
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-amber-500/5 border border-amber-500/10 p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
          <AlertTriangle size={32} />
        </div>
        <h3 className="text-xl font-black text-amber-600">
          تنبيه: تغير في سعر التكلفة!
        </h3>
        <p className="text-sm font-bold text-muted leading-relaxed">
          لقد قمت بتوريد الصنف بسعر شراء جديد ({priceAlertData?.purchasePrice}{" "}
          ج.م) بدلاً من ({priceAlertData?.oldCost} ج.م). هل تود مراجعة وتعديل
          سعر البيع الآن؟
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-soft">
          <div className="text-[10px] font-black text-muted uppercase">
            البيع الحالي
          </div>
          <div className="text-xl font-black text-main">
            {formatCurrency(priceAlertData?.oldSellPrice || 0)}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-muted/60 uppercase tracking-[0.2em] block">
            السعر الجديد المقترح
          </label>
          <div className="relative">
            <Input
              type="number"
              value={newSellPrice}
              onChange={(e) => setNewSellPrice(e.target.value)}
              className="h-12 rounded-xl font-black text-accent border-accent/40 bg-accent/5 pl-12 focus:ring-accent/10"
              autoFocus
              step="0.01"
              min="0"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-accent/40">
              ج.م
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmSummary({
  product,
  formData,
  priceAlertData,
  newSellPrice,
  unitMeta,
}) {
  const totalCost = formData.purchase_price
    ? Number(formData.purchase_price) * Number(formData.amount)
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/40 bg-soft p-6">
        <h4 className="text-lg font-extrabold text-main mb-4 flex items-center gap-2">
          <Package size={20} className="text-accent" />
          ملخص عملية التوريد
        </h4>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">المنتج</span>
            <span className="font-black text-main">{product?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">الكمية</span>
            <span className="font-black text-main">{formData.amount} عبوة</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">المورد</span>
            <span className="font-black text-main">
              {formData.note || "---"}
            </span>
          </div>
          {formData.create_expense && formData.purchase_price && (
            <div className="flex justify-between text-sm border-t border-border/40 pt-3">
              <span className="text-muted">إجمالي التكلفة</span>
              <span className="font-black text-primary">
                {formatCurrency(totalCost)}
              </span>
            </div>
          )}
        </div>
      </div>

      {priceAlertData && (
        <div className="rounded-3xl bg-amber-500/5 border border-amber-500/10 p-6 space-y-4">
          <h4 className="text-lg font-extrabold text-amber-600 flex items-center gap-2">
            <AlertTriangle size={20} />
            مراجعة سعر البيع
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[8px] text-muted/60 font-black uppercase mb-1">
                البيع الحالي
              </p>
              <p className="text-xl font-black text-main">
                {formatCurrency(priceAlertData.oldSellPrice)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[8px] text-muted/60 font-black uppercase mb-1">
                السعر الجديد
              </p>
              <p className="text-xl font-black text-accent">
                {formatCurrency(Number(newSellPrice || 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-success/5 border border-success/10 p-6 text-center">
        <CheckCircle2 size={32} className="text-success mx-auto mb-2" />
        <p className="text-sm font-bold text-success">
          جاهز للتأكيد - اضغط "تأكيد التوريد" لإتمام العملية
        </p>
      </div>
    </div>
  );
}

export default StockWizard;
