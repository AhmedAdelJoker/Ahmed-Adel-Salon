import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn, formatCurrency } from "@/lib/core/utils";
import { currencyLabel } from "@/lib/core/currency";
import type { Dispatch, SetStateAction } from "react";
import type { DiscountAllowance } from "@/features/pos/utils";
import type { SplitLine, SplitMethod } from "@/features/pos/types";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Banknote,
  CreditCard,
  Landmark,
  Plus,
  RefreshCw,
  Star,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** One entry per instrument the invoice endpoint accepts in a split —
 * the id doubles as the payload's `payment_method` value. Labels live in the
 * `pos` namespace (`payments.*`), keyed by this id. */
const SPLIT_METHODS: Array<{
  id: SplitMethod;
  icon: LucideIcon;
}> = [
  { id: "cash", icon: Banknote },
  { id: "card", icon: CreditCard },
  { id: "wallet", icon: Wallet },
  { id: "bank_transfer", icon: Landmark },
];

export interface CheckoutTotalsProps {
  subtotal: number;
  discount: number;
  setDiscount: Dispatch<SetStateAction<number>>;
  /** The discount a cashier may apply without a manager's approval. */
  discountAllowance?: DiscountAllowance;
  loyaltyDiscount: number;
  taxRate: number;
  taxAmount: number;
  finalTotal: number;
  paymentMethod: string;
  setPaymentMethod: Dispatch<SetStateAction<string>>;
  isSplitPayment: boolean;
  setIsSplitPayment: Dispatch<SetStateAction<boolean>>;
  splitLines: SplitLine[];
  setSplitLines: Dispatch<SetStateAction<SplitLine[]>>;
  isReady: boolean;
  isSubmitting: boolean;
  onCheckout: () => void;
}

/**
 * The money block: totals, payment instrument, split rows and the one primary
 * action on the whole screen.
 *
 * Colour is used as meaning, not decoration: the total and the checkout action
 * share the accent, the loyalty line is the only green, and the payment
 * instruments stay neutral until one is selected. The five differently
 * coloured payment buttons the till used to show competed with the total for
 * attention and made the CTA look like one option among many.
 */
export const CheckoutTotals = ({
  subtotal,
  discount,
  setDiscount,
  discountAllowance,
  loyaltyDiscount,
  taxRate,
  taxAmount,
  finalTotal,
  paymentMethod,
  setPaymentMethod,
  isSplitPayment,
  setIsSplitPayment,
  splitLines,
  setSplitLines,
  isReady,
  isSubmitting,
  onCheckout,
}: CheckoutTotalsProps) => {
  const { t } = useTranslation("pos");
  const [cashReceived, setCashReceived] = useState<string>("");
  // Keep the manual discount inside sane bounds: never negative and never
  // larger than the subtotal (the server rejects both).
  const handleDiscountChange = (raw: string) => {
    const value = Number(raw);
    setDiscount(
      Number.isFinite(value) && raw !== ""
        ? Math.max(0, Math.min(subtotal, value))
        : 0,
    );
  };

  // Split math (computed during render so every row edit reflects instantly):
  // paid = Σ row amounts, remaining = what's still uncovered.
  const splitPaid = splitLines.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0,
  );
  const splitRemaining = finalTotal - splitPaid;
  const usedSplitMethods = splitLines.map((line) => line.method);
  const availableSplitMethods = SPLIT_METHODS.filter(
    (method) => !usedSplitMethods.includes(method.id),
  );
  const updateSplitLine = (index: number, patch: Partial<SplitLine>) => {
    setSplitLines((lines) =>
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };
  /** Push (or pull back) the uncovered remainder onto the last row so the
   * sum lands exactly on the invoice total with one tap. */
  const settleSplitRemaining = () => {
    if (Math.abs(splitRemaining) < 0.01 || splitLines.length === 0) return;
    setSplitLines((lines) =>
      lines.map((line, i) =>
        i === lines.length - 1
          ? {
              ...line,
              amount: Math.max(
                0,
                Number(line.amount || 0) + splitRemaining,
              ).toFixed(2),
            }
          : line,
      ),
    );
  };

  /** Payment-method display label, keyed by the lowercase method id. */
  const methodLabel = (id: string) => t(`payments.${id}`);

  return (
    <div className="sticky bottom-0 z-20 shrink-0 space-y-3 border-t border-border/60 bg-card p-3 sm:p-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-muted">
          <span>{t("totals.subtotal")}</span>
          <span className="font-black tabular-nums text-main">
            {formatCurrency(subtotal)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="pos-discount"
            className="text-[10px] font-bold text-muted"
          >
            {t("totals.discount")}
          </label>
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-soft/50 px-2 py-0.5 focus-within:border-primary/50">
            <input
              id="pos-discount"
              type="number"
              min="0"
              inputMode="decimal"
              value={discount}
              onChange={(event) => handleDiscountChange(event.target.value)}
              aria-label={t("totals.discount_amount")}
              className="h-8 w-14 bg-transparent text-end text-xs font-black tabular-nums text-main outline-none touch-target"
            />
            <span className="text-[9px] font-black text-muted">
              {currencyLabel()}
            </span>
          </div>
        </div>

        {discountAllowance && Number(discount) > discountAllowance.allowed && (
          <p className="text-[10px] font-bold leading-relaxed text-warning">
            {t("totals.over_limit", { label: discountAllowance.label })}
          </p>
        )}

        {Number(loyaltyDiscount) > 0 && (
          <div className="flex items-center justify-between text-success">
            <span className="flex items-center gap-1 text-[10px] font-black">
              <Star size={10} className="fill-success" aria-hidden="true" />
              {t("totals.loyalty")}
            </span>
            <span className="text-xs font-black tabular-nums">
              -{formatCurrency(loyaltyDiscount)}
            </span>
          </div>
        )}

        {taxRate > 0 && (
          <div className="flex items-center justify-between text-muted">
            <span className="text-[10px] font-black">
              {t("totals.tax", {
                rate: taxRate > 1 ? taxRate : (taxRate * 100).toFixed(0),
              })}
            </span>
            <span className="text-xs font-black tabular-nums">
              +{formatCurrency(taxAmount)}
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between border-t border-border/50 pt-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">
            {t("totals.total")}
          </span>
          <span className="text-2xl font-black tabular-nums tracking-tight text-primary">
            {formatCurrency(finalTotal)}
          </span>
        </div>
      </div>

      {/* Cash received + change (cash only) */}
      {!isSplitPayment && paymentMethod === "CASH" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label
              htmlFor="pos-cash-received"
              className="text-[10px] font-bold text-muted"
            >
              {t("totals.cash_received")}
            </label>
            <input
              id="pos-cash-received"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
              aria-label={t("totals.cash_received")}
              className="h-10 w-full rounded-lg border border-border/60 bg-background px-2 text-xs font-black tabular-nums text-main outline-none focus:border-primary/50 touch-target"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted">
              {t("totals.change")}
            </span>
            <div
              className={cn(
                "flex h-10 w-full items-center rounded-lg border px-2 text-xs font-black tabular-nums",
                cashReceived && Number(cashReceived) >= finalTotal
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border/60 bg-soft/40 text-muted",
              )}
            >
              {cashReceived
                ? formatCurrency(Math.max(0, Number(cashReceived) - finalTotal))
                : "—"}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-5 gap-1">
          {[
            { id: "CASH", icon: Banknote },
            { id: "CARD", icon: CreditCard },
            { id: "WALLET", icon: Wallet },
            { id: "BANK_TRANSFER", icon: Landmark },
            { id: "SPLIT", icon: Activity },
          ].map((method) => {
            const isActive =
              method.id === "SPLIT"
                ? isSplitPayment
                : !isSplitPayment && paymentMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                aria-pressed={isActive}
                aria-label={methodLabel(method.id.toLowerCase())}
                onClick={() => {
                  if (method.id === "SPLIT") {
                    setIsSplitPayment(!isSplitPayment);
                    if (!isSplitPayment) {
                      // Seed one row: the whole total sits on cash until the
                      // cashier splits it further.
                      setSplitLines([
                        { method: "cash", amount: finalTotal.toFixed(2) },
                      ]);
                    }
                  } else {
                    setIsSplitPayment(false);
                    setPaymentMethod(method.id);
                  }
                }}
                className={cn(
                  "flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors touch-target",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-soft/30 text-muted hover:border-primary/40 hover:text-primary",
                )}
              >
                <method.icon size={14} aria-hidden="true" />
                <span className="text-[11px] font-black">
                  {methodLabel(method.id.toLowerCase())}
                </span>
              </button>
            );
          })}
        </div>

        {isSplitPayment && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-soft/25 p-2.5">
            {splitLines.map((line, index) => {
              const meta = SPLIT_METHODS.find(
                (method) => method.id === line.method,
              );
              // The dropdown lists the row's own method plus whatever isn't
              // claimed by another row — two rows can't fight over one
              // instrument, which would read like a double charge.
              const options = SPLIT_METHODS.filter(
                (method) =>
                  method.id === line.method ||
                  !usedSplitMethods.includes(method.id),
              );
              return (
                <div key={index} className="flex items-center gap-1.5">
                  <Select
                    value={line.method}
                    onValueChange={(value) =>
                      updateSplitLine(index, {
                        method: value as SplitMethod,
                      })
                    }
                  >
                    <SelectTrigger
                      aria-label={t("split.method", { n: index + 1 })}
                      className="h-9 w-[6.5rem] shrink-0 rounded-lg border-border/60 bg-card px-2 text-[11px] font-black"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {methodLabel(method.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="h-9 w-full rounded-lg border border-border/60 bg-card pe-2 ps-7 text-xs font-black tabular-nums text-main outline-none focus:border-primary/50 touch-target"
                      value={line.amount}
                      onChange={(event) =>
                        updateSplitLine(index, {
                          amount: event.target.value,
                        })
                      }
                      aria-label={t("split.amount", {
                        label: meta ? methodLabel(meta.id) : "",
                      })}
                    />
                    <span className="absolute start-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-muted">
                      {currencyLabel()}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={t("split.remove", {
                      label: meta ? methodLabel(meta.id) : "",
                    })}
                    onClick={() =>
                      setSplitLines((lines) =>
                        lines.filter((_, i) => i !== index),
                      )
                    }
                    disabled={splitLines.length === 1}
                    className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 touch-target"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}

            {availableSplitMethods.length > 0 && (
              <button
                type="button"
                aria-label={t("split.add_method")}
                onClick={() =>
                  setSplitLines((lines) => [
                    ...lines,
                    { method: availableSplitMethods[0].id, amount: "0.00" },
                  ])
                }
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 text-[11px] font-black text-muted transition-colors hover:border-primary/40 hover:text-primary touch-target"
              >
                <Plus size={12} aria-hidden="true" /> {t("split.add_method")}
              </button>
            )}

            <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
              <div className="text-[10px] font-bold text-muted">
                {t("split.remaining")}:{" "}
                <span
                  className={cn(
                    "font-black tabular-nums",
                    Math.abs(splitRemaining) < 0.01
                      ? "text-success"
                      : splitRemaining > 0
                        ? "text-danger"
                        : "text-warning",
                  )}
                >
                  {Math.abs(splitRemaining) < 0.01
                    ? t("split.balanced")
                    : formatCurrency(Math.abs(splitRemaining))}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[10px] font-black text-primary hover:bg-primary/10 touch-target"
                onClick={settleSplitRemaining}
                disabled={Math.abs(splitRemaining) < 0.01}
              >
                {splitRemaining > 0 ? t("split.cover") : t("split.deduct")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Button
        size="lg"
        data-pos-checkout="true"
        className={cn(
          "group h-14 w-full rounded-xl text-base font-black shadow-lg transition-all",
          isReady
            ? "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary-strong"
            : "cursor-not-allowed bg-soft text-muted shadow-none",
        )}
        disabled={!isReady || isSubmitting}
        onClick={onCheckout}
      >
        <span className="flex items-center justify-center gap-2">
          {isSubmitting ? (
            <RefreshCw className="animate-spin" size={19} aria-hidden="true" />
          ) : (
            <>
              <Zap size={18} fill="currentColor" aria-hidden="true" />
              <span>{t("checkout.confirm")}</span>
            </>
          )}
        </span>
      </Button>
    </div>
  );
};

export default CheckoutTotals;
