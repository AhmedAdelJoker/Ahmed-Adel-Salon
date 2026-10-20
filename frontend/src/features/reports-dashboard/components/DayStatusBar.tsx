import { CircleDot, Clock, Moon, Wallet } from "lucide-react";

import { cn, formatCurrency } from "@/lib/core/utils";
import type { DayStatus } from "@/features/reports-dashboard/hooks/useOperatingSummary";

export interface DayStatusBarProps {
  status: DayStatus | null;
  unavailable?: boolean;
  className?: string;
}

const money = (value: number) => formatCurrency(Math.round(value));

function when(iso: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Whether the salon is trading right now, and since when.
 *
 * A single strip rather than another card, because it is a state indicator and
 * not a figure to analyse. It answers one question -- open or closed -- and the
 * rest is context for that answer.
 *
 * The overdue state is the reason this is not just a boolean. An open shift left
 * past the working day is a cash discrepancy nobody has closed out, and it also
 * appears in /owner/alerts. Both are correct: this is the state of the business,
 * that is what needs a decision.
 */
export function DayStatusBar({ status, unavailable = false, className }: DayStatusBarProps) {
  if (unavailable || !status) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3",
          className,
        )}
      >
        <Moon size={16} className="shrink-0 text-muted" />
        <span className="text-[10px] font-black text-muted">
          تعذّر تحديد حالة الوردية
        </span>
      </div>
    );
  }

  const { open_shift: shift } = status;

  if (!status.is_open || !shift) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3",
          className,
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Moon size={15} className="shrink-0 text-muted" />
          <span className="text-[11px] font-black text-main">مغلق</span>
        </span>

        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted">
          <Clock size={12} />
          آخر إغلاق {when(status.last_closed_at)}
        </span>

        {status.last_closing_cash != null && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted">
            <Wallet size={12} />
            {money(status.last_closing_cash)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3",
        shift.overdue ? "border-danger/30 bg-danger-soft" : "border-success/25 bg-success-soft",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <CircleDot
          size={15}
          className={cn("shrink-0", shift.overdue ? "text-danger" : "text-success")}
        />
        <span className={cn("text-[11px] font-black", shift.overdue ? "text-danger" : "text-success")}>
          {shift.overdue ? "وردية متأخرة" : "مفتوح"}
        </span>
      </span>

      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted">
        <Clock size={12} />
        منذ {shift.hours_open ?? "—"}{shift.hours_open != null ? " ساعة" : ""}
      </span>

      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted">
        <Wallet size={12} />
        افتتاحي {money(shift.opening_cash)}
      </span>

      {shift.overdue && (
        <span className="text-[9px] font-black uppercase tracking-widest text-danger">
          لم تُغلق بعد
        </span>
      )}
    </div>
  );
}