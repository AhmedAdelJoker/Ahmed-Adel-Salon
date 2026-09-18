import { Award, Medal, Trophy } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/core/utils";

interface PodiumRow {
  employee_id: number;
  employee_name: string;
  sales: number;
  commission?: number;
  service_count?: number;
}

const MEDALS = [
  {
    Icon: Trophy,
    badge: "bg-warning text-white",
    card: "border-warning/40 bg-warning-soft/40",
    label: "الأول",
  },
  {
    Icon: Medal,
    badge: "bg-info text-white",
    card: "border-info/30",
    label: "الثاني",
  },
  {
    Icon: Award,
    badge: "bg-primary text-white",
    card: "border-primary/30",
    label: "الثالث",
  },
];

/**
 * Top-3 podium: stacked 1-2-3 on mobile, center-elevated winner on desktop.
 */
export function Podium({ rows }: { rows: PodiumRow[] }) {
  const top = rows.slice(0, 3);

  if (!top.length) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm font-bold text-muted">
        لا توجد بيانات موظفين في النطاق الحالي
      </div>
    );
  }

  // Display order: mobile 1-2-3, desktop 2-1-3 with the winner elevated
  const order = ["order-1 sm:order-2", "order-2 sm:order-1", "order-3"];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:items-end">
      {top.map((row, i) => {
        const medal = MEDALS[i];
        const isWinner = i === 0;
        return (
          <div
            key={row.employee_id}
            className={cn(
              "rounded-2xl border border-border bg-card p-4 text-center transition-all",
              medal.card,
              order[i],
              isWinner && "sm:-mt-4 sm:py-6 sm:shadow-premium",
            )}
          >
            <div
              className={cn(
                "mx-auto flex h-11 w-11 items-center justify-center rounded-2xl sm:h-12 sm:w-12",
                medal.badge,
              )}
            >
              <medal.Icon size={isWinner ? 22 : 18} />
            </div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted">
              {medal.label}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white font-black text-xs">
                {row.employee_name.charAt(0)}
              </span>
              <span className="truncate text-sm font-black text-main">
                {row.employee_name}
              </span>
            </div>
            <div className="mt-2 text-lg font-black text-success tabular-nums">
              {formatCurrency(row.sales)}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[10px] font-bold text-muted">
              {row.commission !== undefined && (
                <span>عمولة {formatCurrency(row.commission)}</span>
              )}
              {row.service_count !== undefined && (
                <span>• {formatNumber(row.service_count)} خدمة</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
