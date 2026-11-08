import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/core/utils";

/**
 * The dense readout both HR pages share.
 *
 * One strip, not a row of cards: these are operational counters, and every
 * pixel spent on padding is a row of the roster pushed below the fold. The
 * numbers come from the server's whole-roster aggregates, never from the rows
 * of the current page.
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

const TONE_CLASS: Record<HrStatTone, string> = {
  default: "text-content-secondary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  accent: "text-accent",
};

const COLUMNS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
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
  const columns = COLUMNS[Math.min(Math.max(cells.length, 2), 5)] ?? COLUMNS[5];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line",
        columns,
        className,
      )}
      aria-busy={loading}
    >
      {cells.map((cell) => {
        const Icon = cell.icon;
        const tone = cell.tone ?? "default";
        const content = (
          <>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
              {Icon && (
                <Icon
                  size={12}
                  className={cn("shrink-0", TONE_CLASS[tone])}
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{cell.label}</span>
              {cell.onClick && (
                <ArrowUpRight
                  size={11}
                  className="ms-auto shrink-0 text-content-tertiary transition-colors group-hover:text-accent"
                  aria-hidden="true"
                />
              )}
            </div>
            <div
              className={cn(
                "mt-1 font-mono text-2xl font-bold leading-none tabular-nums",
                tone === "default" ? "text-content" : TONE_CLASS[tone],
                loading && "text-content-disabled",
              )}
            >
              {loading ? "—" : cell.value}
            </div>
            {cell.hint && (
              <div
                className={cn(
                  "mt-1 truncate text-[10px] font-medium",
                  cell.onClick
                    ? "text-accent underline-offset-2 group-hover:underline"
                    : "text-content-tertiary",
                )}
              >
                {cell.hint}
              </div>
            )}
          </>
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
              className="group bg-raised px-4 py-3 text-start transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {content}
            </button>
          );
        }

        return (
          <div key={cell.key} className="bg-raised px-4 py-3">
            {content}
          </div>
        );
      })}
    </div>
  );
}
