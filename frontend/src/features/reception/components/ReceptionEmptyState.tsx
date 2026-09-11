/** Reception feature: board empty state (moved from ReceptionBoard page). */
export default function ReceptionEmptyState({
  icon: Icon,
  title,
  desc,
}: any) {
  return (
    <div className="flex flex-col items-center justify-center h-32 sm:h-40 text-center p-4 sm:p-6 border-2 border-dashed border-border/40 rounded-2xl sm:rounded-3xl bg-soft/30 opacity-60">
      <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center mb-2 sm:mb-3 shadow-sm border border-border/40">
        <Icon size={18} className="text-muted sm:hidden" />
        <Icon size={22} className="hidden text-muted sm:block" />
      </div>
      <h4 className="text-xs sm:text-sm font-black text-main mb-0.5 sm:mb-1 tracking-tight">
        {title}
      </h4>
      <p className="text-[9px] sm:text-xs font-bold text-muted">{desc}</p>
    </div>
  );
}
