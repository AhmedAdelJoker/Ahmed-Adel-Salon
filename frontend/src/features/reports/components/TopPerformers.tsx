import { motion } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { formatCurrency } from "@/lib/core/utils";

interface TopPerformersRow {
  employee_id: number;
  employee_name: string;
  sales: number;
}

export function TopPerformers({ rows }: { rows: TopPerformersRow[] }) {
  const max = Math.max(...rows.map((r) => r.sales), 1);
  if (!rows.length)
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm font-bold text-muted">
        لا توجد بيانات موظفين في النطاق الحالي
      </div>
    );
  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((row, index) => (
        <div key={row.employee_id} className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black text-xs",
              index === 0
                ? "bg-warning text-white"
                : index === 1
                  ? "bg-muted text-white"
                  : index === 2
                    ? "bg-warning/80 text-white"
                    : "bg-soft text-muted border border-border"
            )}
          >
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-black text-main">
                {row.employee_name}
              </span>
              <span className="text-xs font-black text-success whitespace-nowrap">
                {formatCurrency(row.sales)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft border border-border/50">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max((row.sales / max) * 100, 6)}%` }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                className="h-full rounded-full bg-gradient-to-r from-success to-success-strong"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
