/** Reception DoneCard (moved from ReceptionBoard page, no logic changes). */
import { CheckCheck } from "lucide-react";
import { formatCurrency, formatTime12h } from "@/lib/core/utils";

export default function DoneCard({ appt }: any) {
  return (
    <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-500/15 bg-emerald-500/5 flex items-center gap-2 sm:gap-3">
      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
        <CheckCheck size={12} className="sm:hidden" />
        <CheckCheck size={16} className="hidden sm:block" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-xs font-black text-main truncate">
          {appt.customer_name || "عميل مجهول"}
        </p>
        <p className="text-[8px] sm:text-[10px] font-bold text-muted truncate">
          {appt.barber_name || "توزيع تلقائي"}
        </p>
      </div>
      <div className="text-left shrink-0">
        <p className="text-[10px] sm:text-xs font-black text-emerald-600 tabular-nums">
          {formatCurrency(appt.total_estimated_price)}
        </p>
        <p className="text-[8px] sm:text-[9px] font-bold text-muted">
          {appt.appointment_time
            ? formatTime12h(String(appt.appointment_time).slice(0, 5))
            : "—"}
        </p>
      </div>
    </div>
  );
}
