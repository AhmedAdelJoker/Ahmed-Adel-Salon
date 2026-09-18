import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/core/utils";
import type { Dispatch, SetStateAction } from "react";
import {
  Activity,
  CreditCard,
  DollarSign,
  RefreshCw,
  Star,
  Zap,
} from "lucide-react";

export interface CheckoutTotalsProps {
  subtotal: number;
  discount: number;
  setDiscount: Dispatch<SetStateAction<number>>;
  loyaltyDiscount: number;
  finalTotal: number;
  paymentMethod: string;
  setPaymentMethod: Dispatch<SetStateAction<string>>;
  isSplitPayment: boolean;
  setIsSplitPayment: Dispatch<SetStateAction<boolean>>;
  splitCashAmount: number | string;
  splitCardAmount: number | string;
  setSplitCashAmount: Dispatch<SetStateAction<number>>;
  setSplitCardAmount: Dispatch<SetStateAction<number>>;
  isReady: boolean;
  isEditMode: boolean;
  isSubmitting: boolean;
  onCheckout: () => void;
}

export const CheckoutTotals = ({
  subtotal,
  discount,
  setDiscount,
  loyaltyDiscount,
  finalTotal,
  paymentMethod,
  setPaymentMethod,
  isSplitPayment,
  setIsSplitPayment,
  splitCashAmount,
  splitCardAmount,
  setSplitCashAmount,
  setSplitCardAmount,
  isReady,
  isEditMode,
  isSubmitting,
  onCheckout,
}: CheckoutTotalsProps) => {
  const handleCashChange = (val: string) => {
    const cash = Number(val || 0);
    setSplitCashAmount(val as unknown as number);
    const remaining = Math.max(0, finalTotal - cash);
    setSplitCardAmount(remaining.toFixed(2) as unknown as number);
  };

  const handleCardChange = (val: string) => {
    const card = Number(val || 0);
    setSplitCardAmount(val as unknown as number);
    const remaining = Math.max(0, finalTotal - card);
    setSplitCashAmount(remaining.toFixed(2) as unknown as number);
  };

  return (
    <div className="p-4 sm:p-5 border-t border-border/50 bg-white dark:bg-white/5 space-y-4 shrink-0">
      <div className="space-y-2 relative z-10">
        <div className="flex justify-between items-center text-[10px] font-bold text-muted uppercase tracking-wider">
          <span>المجموع</span>
          <span className="font-black text-main">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-red-500 uppercase">الخصم</span>
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/20">
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-14 h-10 bg-transparent text-left focus:outline-none font-black text-red-600 text-xs touch-target"
              aria-label="مبلغ الخصم"
            />
            <DollarSign size={10} className="text-red-500" />
          </div>
        </div>

        {Number(loyaltyDiscount) > 0 && (
          <div className="flex justify-between items-center text-success">
            <span className="text-[9px] font-black uppercase flex items-center gap-1">
              <Star size={10} className="fill-success" /> خصم الولاء
            </span>
            <span className="text-xs font-black">-{formatCurrency(loyaltyDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between items-baseline pt-2 border-t border-border/30">
          <span className="text-[10px] font-black text-muted uppercase tracking-widest">
            الإجمالي
          </span>
          <span className="text-2xl font-black text-primary tracking-tighter tabular-nums">
            {formatCurrency(finalTotal)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 relative z-10">
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              id: "CASH",
              label: "نقدي",
              icon: DollarSign,
              activeClass:
                "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20",
            },
            {
              id: "CARD",
              label: "شبكة",
              icon: CreditCard,
              activeClass:
                "bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/20",
            },
            {
              id: "SPLIT",
              label: "مقسم",
              icon: Activity,
              activeClass:
                "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20",
            },
          ].map((method) => {
            const isActive =
              method.id === "SPLIT"
                ? isSplitPayment
                : !isSplitPayment && paymentMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => {
                  if (method.id === "SPLIT") {
                    setIsSplitPayment(!isSplitPayment);
                    if (!isSplitPayment) {
                      setSplitCashAmount(finalTotal.toFixed(2) as unknown as number);
                      setSplitCardAmount("0.00" as unknown as number);
                    }
                  } else {
                    setIsSplitPayment(false);
                    setPaymentMethod(method.id);
                  }
                }}
                className={cn(
                  "h-12 flex flex-col items-center justify-center rounded-xl border-2 transition-all group touch-target",
                  isActive
                    ? method.activeClass
                    : "bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-muted hover:border-primary/30 hover:text-primary",
                )}
              >
                <method.icon
                  size={16}
                  className="group-hover:scale-110 transition-transform"
                />
                <span className="text-[9px] font-black uppercase tracking-tight">
                  {method.label}
                </span>
              </button>
            );
          })}
        </div>

        {isSplitPayment && (
          <div className="p-3 bg-slate-50 dark:bg-white/5 border border-border/50 rounded-2xl animate-in fade-in zoom-in-95 duration-300 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="split-cash"
                  className="text-[9px] font-black text-muted uppercase mr-1"
                >
                  نقدي
                </label>
                <div className="relative">
                  <input
                    id="split-cash"
                    type="number"
                    className="w-full bg-white dark:bg-slate-950 border border-border/50 rounded-lg h-10 px-2 pl-6 text-xs font-black outline-none focus:border-emerald-500/40 touch-target"
                    value={splitCashAmount}
                    onChange={(e) => handleCashChange(e.target.value)}
                    step="0.01"
                  />
                  <DollarSign
                    size={10}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="split-card"
                  className="text-[9px] font-black text-muted uppercase mr-1"
                >
                  شبكة
                </label>
                <div className="relative">
                  <input
                    id="split-card"
                    type="number"
                    className="w-full bg-white dark:bg-slate-950 border border-border/50 rounded-lg h-10 px-2 pl-6 text-xs font-black outline-none focus:border-blue-500/40 touch-target"
                    value={splitCardAmount}
                    onChange={(e) => handleCardChange(e.target.value)}
                    step="0.01"
                  />
                  <CreditCard
                    size={10}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-border/20">
              <div className="text-[9px] font-bold text-muted">
                المجموع:{" "}
                <span
                  className={cn(
                    "font-black",
                    Math.abs(
                      Number(splitCashAmount) + Number(splitCardAmount) - finalTotal,
                    ) < 0.01
                      ? "text-emerald-500"
                      : "text-rose-500",
                  )}
                >
                  {formatCurrency(Number(splitCashAmount) + Number(splitCardAmount))}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 text-[10px] font-black text-primary bg-primary/5 hover:bg-primary/10 touch-target"
                onClick={() => {
                  setSplitCardAmount(
                    (finalTotal - Number(splitCashAmount)).toFixed(2) as unknown as number,
                  );
                }}
              >
                تغطية المتبقي بالشبكة
              </Button>
            </div>
          </div>
        )}
      </div>

      <Button
        size="lg"
        data-pos-checkout="true"
        className={cn(
          "w-full h-14 rounded-2xl font-black text-base transition-all duration-300 shadow-xl group",
          isReady
            ? isEditMode
              ? "bg-amber-500 text-white shadow-amber-500/20"
              : "bg-primary text-white shadow-primary/20"
            : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed",
        )}
        disabled={!isReady || isSubmitting}
        onClick={onCheckout}
      >
        <div className="flex items-center justify-center gap-3">
          {isSubmitting ? (
            <RefreshCw className="animate-spin" size={20} />
          ) : (
            <>
              {isEditMode ? (
                <RefreshCw size={18} />
              ) : (
                <Zap size={18} fill="currentColor" />
              )}
              <span>{isEditMode ? "حفظ التعديلات" : "تأكيد وإصدار (Ctrl+Enter)"}</span>
            </>
          )}
        </div>
      </Button>
    </div>
  );
};

export default CheckoutTotals;
