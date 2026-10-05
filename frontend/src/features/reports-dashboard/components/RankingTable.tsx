import { ArrowDown, Trophy } from "lucide-react";

import { cn, formatCurrency } from "@/lib/core/utils";

export interface RankRow {
  name: string;
  revenue: number;
  /** The second measure: invoices for staff, units sold for services. */
  count: number;
  countLabel: string;
}

export interface RankingTableProps {
  title: string;
  rows: RankRow[] | null;
  unavailable?: boolean;
  emptyMessage?: string;
  className?: string;
}

const money = (value: number) => formatCurrency(Math.round(value));

/**
 * Ranked revenue table for the cockpit.
 *
 * Replaces the pie chart as the primary "who is doing what" view, because a pie
 * answers "what share" and the question an owner actually asks is "who, and how
 * much". The percentages are still there as bar widths, so the share reading is
 * not lost -- it just stops being the only way to read the chart.
 *
 * Densely set on purpose: rows are 28px rather than the 56px cards used
 * elsewhere on the dashboard. At executive density the eye scans a column, and
 * vertical padding fights that.
 *
 * Rows are scaled against the top row rather than against the total, so the
 * leader always fills the bar. A ranking where every bar is short because it is a
 * share of a large total is harder to compare than one normalised to the top.
 */
export function RankingTable({
  title,
  rows,
  unavailable = false,
  emptyMessage = "لا توجد بيانات في هذه الفترة",
  className,
}: RankingTableProps) {
  const leader = rows?.[0]?.revenue ?? 0;

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted">
          {title}
        </h4>
        {rows && rows.length > 0 && (
          <span className="text-[9px] font-black text-muted">{rows.length}</span>
        )}
      </div>

      {unavailable ? (
        <p className="px-4 py-6 text-center text-[10px] font-bold text-muted">
          تعذّر تحميل هذا الجدول
        </p>
      ) : !rows || rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[10px] font-bold text-muted">
          {emptyMessage}
        </p>
      ) : (
        <table className="w-full border-collapse text-right">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-muted"
              >
                #
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-muted"
              >
                الاسم
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-muted"
              >
                الإيراد
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const share = leader > 0 ? (row.revenue / leader) * 100 : 0;
              const isLeader = index === 0 && row.revenue > 0;

              return (
                <tr
                  key={row.name}
                  className="group border-b border-border/50 transition-colors last:border-0 hover:bg-soft"
                >
                  <td className="w-8 py-1.5 pe-1 ps-4 align-middle">
                    <span className="flex items-center justify-center">
                      {isLeader ? (
                        <Trophy size={12} className="text-accent" aria-label="الأعلى" />
                      ) : (
                        <span className="text-[10px] font-black tabular-nums text-muted">
                          {index + 1}
                        </span>
                      )}
                    </span>
                  </td>

                  <td className="py-1.5 pe-4 ps-2 align-middle">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[11px] font-black text-main">
                          {row.name}
                        </span>
                        <span className="shrink-0 text-[9px] font-bold text-muted">
                          {row.count.toLocaleString("ar-EG-u-nu-latn")} {row.countLabel}
                        </span>
                      </span>
                      <span className="h-1 w-full overflow-hidden rounded-full bg-soft">
                        <span
                          className="block h-full rounded-full bg-accent/70 transition-all"
                          style={{ width: `${Math.max(share, row.revenue > 0 ? 3 : 0)}%` }}
                        />
                      </span>
                    </div>
                  </td>

                  <td className="py-1.5 pe-4 ps-2 text-end align-middle">
                    <span className="text-[11px] font-black tabular-nums text-main">
                      {money(row.revenue)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Small inline delta used in the day-status strip. */
export function Delta({
  value,
  suffix = "%",
  className,
}: {
  value: number | null;
  suffix?: string;
  className?: string;
}) {
  // No baseline means no comparison. Showing "+100%" against a baseline that was
  // never measured is the single most misleading thing a delta can do.
  if (value === null) {
    return (
      <span className={cn("text-[9px] font-black text-muted", className)}>
        لا مقارنة
      </span>
    );
  }

  const flat = Math.round(value) === 0;
  const up = value > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[9px] font-black tabular-nums",
        flat ? "text-muted" : up ? "text-success" : "text-danger",
        className,
      )}
    >
      {!flat && <ArrowDown size={9} className={up ? "rotate-180" : ""} />}
      {flat ? "ثابت" : `${up ? "+" : ""}${Math.round(value)}${suffix}`}
    </span>
  );
}