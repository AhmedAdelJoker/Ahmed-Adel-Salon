export default function SectionTitle({
  icon,
  title,
  subtitle,
  action = null,
  className = "",
}) {
  return (
    <div
      className={`section-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="shrink-0 rounded-2xl border border-border-accent bg-accent-soft p-3 text-accent">
            {icon}
          </div>
        ) : null}

        <div className="min-w-0">
          <h3 className="section-title text-lg font-black tracking-tight text-main">
            {title}
          </h3>

          {subtitle ? (
            <p className="section-subtitle mt-1 text-xs sm:text-sm font-bold leading-relaxed text-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
