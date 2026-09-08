export default function MetricCard({
  title,
  value,
  helper,
  accent = "from-[var(--accent)] to-[var(--accent-2)]",
  icon = null,
  className = "",
}) {
  return (
    <div
      className={`stat-card rounded-3xl border border-border bg-card shadow-soft p-5 relative overflow-hidden ${className}`}
      dir="rtl"
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${accent}`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-widest text-muted">
            {title}
          </div>

          <div className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-main">
            {value}
          </div>

          {helper ? (
            <p className="mt-2 text-xs font-bold text-muted leading-relaxed">
              {helper}
            </p>
          ) : null}
        </div>

        {icon ? (
          <div className="shrink-0 rounded-2xl border border-border-accent bg-accent-soft p-3 text-accent">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
