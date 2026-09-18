export default function PageHero({
  eyebrow,
  badge,
  title,
  subtitle,
  actions = null,
  stats = null,
  className = "",
}) {
  const headerLabel = eyebrow || badge;
  const sideContent = actions || stats;

  return (
    <section
      className={`card card-gold relative min-w-0 overflow-clip rounded-[1.35rem] border border-border bg-card p-4 shadow-soft sm:rounded-3xl sm:p-8 ${className}`}
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,var(--accent-glow),transparent_36%)]" />

      <div className="relative z-raised flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {headerLabel ? (
            <div className="mb-3 inline-flex max-w-full items-center rounded-full border border-border-accent bg-accent-soft px-3 py-1 text-[11px] font-black uppercase tracking-normal text-accent">
              {headerLabel}
            </div>
          ) : null}

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-normal text-main">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-muted">
              {subtitle}
            </p>
          ) : null}
        </div>

        {sideContent ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-3 lg:w-auto lg:shrink-0 lg:justify-end">
            {sideContent}
          </div>
        ) : null}
      </div>
    </section>
  );
}
