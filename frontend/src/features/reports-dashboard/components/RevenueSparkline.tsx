import { cn } from "@/lib/core/utils";

export interface RevenueSparklineProps {
  /** Oldest first. */
  data: { date: string; revenue: number; is_today: boolean }[];
  /** Mean revenue for the days before today, if the server could compute it. */
  baseline: number | null;
  unavailable?: boolean;
  className?: string;
}

const W = 100;
const H = 28;

/**
 * Fourteen-day revenue trend as a filled area.
 *
 * Hand-built SVG rather than a charting library: it is one polyline and one
 * `rect`, and pulling recharts in for it would mean a dependency, a resize
 * observer and an accessibility tree to get the same result. The wider charts on
 * the page stay on recharts where axes and tooltips earn the cost.
 *
 * Drawn in a fixed LTR coordinate space and mirrored by the parent's `dir`, so
 * the shape stays a time series in Arabic without each coordinate being flipped
 * by hand.
 */
export function RevenueSparkline({
  data,
  baseline,
  unavailable = false,
  className,
}: RevenueSparklineProps) {
  if (unavailable || data.length === 0) {
    return (
      <div
        className={cn(
          "flex h-16 items-center justify-center rounded-xl border border-dashed border-border text-[10px] font-black text-muted",
          className,
        )}
      >
        لا يتوفر رسم بياني
      </div>
    );
  }

  const values = data.map((d) => d.revenue);
  const peak = Math.max(...values, baseline ?? 0, 1);
  const step = W / Math.max(data.length - 1, 1);

  const pointAt = (index: number) => {
    const x = index * step;
    // y is inverted: SVG origin is top-left, so the highest value sits at 0.
    const y = H - (values[index] / peak) * (H - 3) - 1.5;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };

  const line = data.map((_, i) => pointAt(i)).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const todayIndex = data.findIndex((d) => d.is_today);
  const hasRevenue = values.some((v) => v > 0);

  // A flat line at the bottom is the honest shape of "no revenue in this
  // window". It is deliberately not given a wave.
  return (
    <div className={cn("space-y-1.5", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-16 w-full overflow-visible"
        role="img"
        aria-label={
          hasRevenue
            ? `إيراد آخر ${data.length} يوماً، أعلى قيمة ${peak}`
            : `لا يوجد إيراد مسجّل خلال آخر ${data.length} يوماً`
        }
      >
        <polygon points={area} className="fill-accent/10" />

        {baseline != null && baseline > 0 && (
          <line
            x1={0}
            x2={W}
            y1={H - (baseline / peak) * (H - 3) - 1.5}
            y2={H - (baseline / peak) * (H - 3) - 1.5}
            className="stroke-muted/40"
            strokeWidth={0.4}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        )}

        <polyline
          points={line}
          className="stroke-accent"
          fill="none"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {todayIndex >= 0 && (
          <circle
            cx={todayIndex * step}
            cy={H - (values[todayIndex] / peak) * (H - 3) - 1.5}
            r={1.6}
            className="fill-accent"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted">
        <span>{data[0]?.date.slice(5)}</span>
        <span>
          {baseline != null && baseline > 0
            ? `المتوسط السابق ${Math.round(baseline).toLocaleString("ar-EG-u-nu-latn")}`
            : "لا يوجد متوسط سابق"}
        </span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}