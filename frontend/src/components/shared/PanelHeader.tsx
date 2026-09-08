
interface PanelHeaderProps {
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  stats?: React.ReactNode;
  className?: string;
}

export default function PanelHeader({
  icon = null,
  badge,
  title,
  subtitle,
  stats = null,
  className = "",
}: PanelHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
      dir="rtl"
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="shrink-0 rounded-2xl border border-border-accent bg-accent-soft p-3 text-accent">
            {icon}
          </div>
        ) : null}

        <div className="min-w-0">
          {badge ? (
            <div className="mb-2 inline-flex items-center rounded-full border border-border-accent bg-accent-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-accent">
              {badge}
            </div>
          ) : null}

          <h2 className="text-lg sm:text-xl font-black tracking-tight text-main">
            {title}
          </h2>

          {subtitle ? (
            <p className="mt-1 text-xs sm:text-sm font-bold leading-relaxed text-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {stats ? (
        <div className="shrink-0 rounded-2xl border border-border bg-soft px-4 py-2 text-xs font-black text-muted">
          {stats}
        </div>
      ) : null}
    </div>
  );
}
