export default function DashboardPanel({
  title,
  subtitle,
  action = null,
  children,
  className = "",
}) {
  return (
    <section
      className={`card rounded-3xl border border-border bg-card shadow-soft overflow-hidden ${className}`}
      dir="rtl"
    >
      {(title || subtitle || action) && (
        <header className="flex flex-col gap-4 border-b border-border bg-soft/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-lg font-black text-main tracking-tight">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-xs font-bold text-muted leading-relaxed">
                {subtitle}
              </p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}

      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
