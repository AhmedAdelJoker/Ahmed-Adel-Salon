import { useEffect } from 'react';
export default function MetricCard({
  title,
  value,
  hint = "",
  icon = null,
  accent = "from-[var(--accent)] to-[var(--accent-2)]",
  className = "",
}) {
  


return (

    <div
      className={`stat-card relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft ${className}`}
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

          {hint ? (
            <p className="mt-2 text-xs font-bold leading-relaxed text-muted">
              {hint}
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


