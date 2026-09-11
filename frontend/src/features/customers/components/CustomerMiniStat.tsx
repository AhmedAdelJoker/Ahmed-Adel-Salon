/** Customer mini stat (moved from Customers page). */
export default function CustomerMiniStat({ label, value, icon: Icon }: any) {
  return (
    <div className="rounded-2xl border border-border bg-soft p-4 border-border bg-soft">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className="text-indigo-600 dark:text-sky-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </span>
      </div>
      <div className="truncate text-sm font-black text-main text-main">
        {value}
      </div>
    </div>
  );
}
