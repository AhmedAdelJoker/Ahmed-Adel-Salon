import { formatCurrency } from "@/lib/core/utils";

export interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { name?: string; fill?: string };
}

export function FinanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const title = label || payload[0]?.name || payload[0]?.payload?.name || "تفاصيل";
  return (
    <div className="min-w-[180px] rounded-2xl border border-border bg-card/95 p-4 shadow-premium backdrop-blur-md">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted">{title}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color || entry.payload?.fill || "#6366F1" }}
              />
              <span className="truncate text-xs font-bold text-muted">{entry.name}</span>
            </div>
            <span className="shrink-0 text-sm font-black tabular-nums text-main">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
