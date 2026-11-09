import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/core/utils";

/**
 * HR metric cards (was a dense strip). Renders operational counters as readable
 * cards: icon, value, label, and hint. Numbers come from server aggregates, not
 * the current page rows.
 */
export type HrStatTone = "default" | "success" | "warning" | "danger" | "accent";

export type HrStatCell = {
  key: string;
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: HrStatTone;
  /** A cell that is also a way into another page, not just a number to read. */
  onClick?: () => void;
  /** Screen-reader suffix for an actionable cell. */
  actionLabel?: string;
};

const VALUE_TONE: Record<HrStatTone, string> = {
  default: "text-content",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  accent: "text-accent",
};

const ICON_TONE: Record<HrStatTone, string> = {
  default: "border-line bg-sunken text-content-secondary",
  success: "border-success-line bg-success-bg text-success",
  warning: "border-warning-line bg-warning-bg text-warning",
  danger: "border-danger-line bg-danger-bg text-danger",
  accent: "border-accent/25 bg-accent/10 text-accent",
};

const GRID_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "sm:grid-cols-2 lg:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

export default function HrStatStrip({
  cells,
  loading = false,
  className,
}: {
  cells: HrStatCell[];
  loading?: boolean;
  className?: string;
}) {
  const count = Math.min(Math.max(cells.length, 1), 6);
  const columns = GRID_COLUMNS[count] ?? GRID_COLUMNS[5];

  return (
    <div
      className={cn("grid grid-cols-1 gap-3", columns, className)}
      aria-busy={loading}
      data-testid="hr-stat-cards"
    >
      {cells.map((cell) => {
        const Icon = cell.icon;
        const tone = cell.tone ?? "default";
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              {Icon ? (
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                    ICON_TONE[tone],
                  )}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
              ) : (
                <span />
              )}
              {cell.onClick && (
                <ArrowUpRight
                  size={15}
                  className="mt-0.5 shrink-0 text-content-tertiary transition-colors group-hover:text-accent"
                  aria-hidden="true"
                />
              )}
            </div>
            <div
              className={cn(
                "mt-4 font-mono text-3xl font-bold leading-none tracking-tight tabular-nums",
                loading ? "text-content-disabled" : VALUE_TONE[tone],
              )}
            >
              {loading ? "—" : cell.value}
            </div>
            <div className="mt-1.5 text-sm font-semibold text-content">
              {cell.label}
            </div>
            {cell.hint ? (
              <div
                className={cn(
                  "mt-1 text-[11px] font-medium leading-relaxed",
                  cell.onClick
                    ? "text-accent underline-offset-2 group-hover:underline"
                    : "text-content-tertiary",
                )}
              >
                {cell.hint}
              </div>
            ) : null}
          </>
        );

        const cardClass = cn(
          "rounded-2xl border border-line bg-raised p-4 text-start shadow-sm transition-all",
          cell.onClick &&
            "group cursor-pointer hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        );

        if (cell.onClick) {
          return (
            <button
              key={cell.key}
              type="button"
              onClick={cell.onClick}
              aria-label={
                cell.actionLabel ? `${cell.label}: ${cell.actionLabel}` : cell.label
              }
              className={cardClass}
            >
              {body}
            </button>
          );
        }

        return (
          <div key={cell.key} className={cardClass}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
