import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/core/utils";

export type HeatmapMetric = "attendance" | "punctuality" | "hours";

export interface HeatmapCellProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  value?: number;
  day: number;
  date: string;
  empty?: boolean;
  noData?: boolean;
  today?: boolean;
  selected?: boolean;
  metric?: HeatmapMetric;
  count?: number;
}

function getColorStop(value?: number | null): string {
  if (value === undefined || value === null) return "heatmap-stop-1";
  if (value <= 20) return "heatmap-stop-1";
  if (value <= 40) return "heatmap-stop-2";
  if (value <= 60) return "heatmap-stop-3";
  if (value <= 80) return "heatmap-stop-4";
  return "heatmap-stop-5";
}

export const HeatmapCell = forwardRef<HTMLButtonElement, HeatmapCellProps>(
  (
    {
      className,
      value,
      day,
      date,
      empty,
      noData,
      today,
      selected,
      onClick,
      metric = "attendance",
      count,
      children,
      ...props
    },
    ref,
  ) => {
    const colorStop = getColorStop(value);
    const unit = metric === "hours" ? "h" : "%";
    const displayValue =
      value !== undefined && value !== null ? `${value}${unit}` : "—";
    const label =
      count && count > 0
        ? `${displayValue} • ${count} سجل`
        : count === 0
          ? "لا توجد سجلات"
          : "—";

    return (
      <button
        ref={ref}
        className={cn(
          "heatmap-cell",
          colorStop,
          empty && "data-[empty]",
          noData && "data-[no-data]",
          today && "data-[today]",
          selected && "data-[selected]",
          className,
        )}
        data-empty={empty}
        data-no-data={noData}
        data-today={today}
        data-selected={selected}
        onClick={onClick}
        disabled={empty || noData}
        title={label}
        aria-label={empty ? "يوم فارغ" : `${day} ${date} — ${label}`}
        {...props}
      >
        {empty ? null : (
          <>
            <span className="heatmap-day">{day}</span>
            {count && count > 0 && (
              <span className="heatmap-value">{displayValue}</span>
            )}
            {children}
          </>
        )}
      </button>
    );
  },
);
HeatmapCell.displayName = "HeatmapCell";

export interface HeatmapCellData {
  day: number;
  date: string;
  value?: number;
  count?: number;
  empty?: boolean;
  isToday?: boolean;
}

export interface HeatmapGridProps {
  cells: HeatmapCellData[];
  selectedDate?: string | null;
  metric: HeatmapMetric;
  onCellClick: (cell: HeatmapCellData) => void;
  firstDayOfWeek?: number;
}

export function HeatmapGrid({
  cells,
  selectedDate,
  metric,
  onCellClick,
  firstDayOfWeek = 0,
}: HeatmapGridProps) {
  const dayLabels = [
    "الأحد",
    "الاثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-1 min-w-[1000px]">
        {/* Day Headers */}
        {dayLabels.map((d, i) => (
          <div
            key={i}
            className="text-center p-2 text-[10px] font-bold uppercase text-n-500/60 bg-n-100 rounded-none"
          >
            {d}
          </div>
        ))}

        {/* Empty cells before first day of month */}
        {Array.from({ length: firstDayOfWeek }, (_, i) => (
          <HeatmapCell key={`empty-${i}`} day={0} date="" empty />
        ))}

        {/* Calendar Cells */}
        {cells.map((cell) => (
          <HeatmapCell
            key={cell.date}
            day={cell.day}
            date={cell.date}
            value={cell.value}
            count={cell.count}
            empty={cell.empty}
            today={cell.isToday}
            selected={cell.date === selectedDate}
            metric={metric}
            onClick={() => onCellClick(cell)}
          />
        ))}
      </div>
    </div>
  );
}
