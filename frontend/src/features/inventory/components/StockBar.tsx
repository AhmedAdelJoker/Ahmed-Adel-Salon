import { cn } from "@/lib/core/utils";

interface StockBarProps {
  quantity: number;
  /** Alert threshold. Doubles as the bar's full scale: 2x threshold = 100%. */
  threshold: number;
  archived?: boolean;
  className?: string;
}

/**
 * A single-line "how full is this shelf" gauge.
 *
 * The full scale is deliberately twice the alert threshold: a product sitting
 * exactly at its threshold is already half a bar empty, which is the visual
 * language for "reorder soon". Without a threshold (0) the gauge is treated as
 * full and stays success-coloured -- there is nothing to be low against.
 */
export function StockBar({
  quantity,
  threshold,
  archived = false,
  className,
}: StockBarProps) {
  const qty = Number(quantity || 0);
  const min = Number(threshold || 0);
  const ratio = min > 0 ? Math.min(1, Math.max(0, qty / (2 * min))) : 1;
  const isLow = qty <= min;
  const width = Math.round(ratio * 100);

  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-soft",
        className,
      )}
      role="presentation"
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          archived
            ? "bg-muted/50"
            : isLow
              ? "bg-danger"
              : "bg-success",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default StockBar;
