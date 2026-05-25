import { useEffect } from 'react';
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
      className={`card card-gold relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft ${className}`}
      dir="rtl"
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,var(--accent-glow),transparent_36%)]" />

      <div className="relative z-raised flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {headerLabel ? (
            <div className="mb-3 inline-flex items-center rounded-full border border-border-accent bg-accent-soft px-3 py-1 text-[11px] font-black uppercase tracking-widest text-accent">
              {headerLabel}
            </div>
          ) : null}

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-main">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-muted">
              {subtitle}
            </p>
          ) : null}
        </div>

        {sideContent ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {sideContent}
          </div>
        ) : null}
      </div>
    </section>
  );
}


