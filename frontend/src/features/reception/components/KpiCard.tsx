/** Reception KpiCard (moved from ReceptionBoard page, no logic changes). */
import { cn } from "@/lib/core/utils";

export default function KpiCard({ label, value, icon: Icon, className }: any) {
  return (
    <div className="group relative rounded-xl border border-border/60 bg-card p-2.5 sm:p-4 shadow-soft transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5 overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0",
            className,
          )}
        >
          <Icon size={14} className="sm:hidden" />
          <Icon size={18} className="hidden sm:block" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[8px] sm:text-[10px] font-black text-muted uppercase tracking-widest truncate">
            {label}
          </div>
          <div className="text-sm sm:text-lg font-black text-main tabular-nums truncate">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}
