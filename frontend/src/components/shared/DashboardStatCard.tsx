/**
 * DashboardStatCard — single canonical KPI/metric card.
 *
 * Replaces: components/dashboard/MetricCard.tsx (archived)
 *           components/shared/MetricCard.tsx (merged)
 *
 * Use this everywhere we render a stat tile in dashboards, reports,
 * or any KPI grid. Backed by the unified design tokens.
 *
 * Props:
 *  - title: small uppercase label (e.g. "Total Revenue")
 *  - value: the headline number (string — supports currency formatting)
 *  - subtitle/hint: optional helper text under the value
 *  - accent: Tailwind gradient class string for the top stripe
 *  - icon: ReactNode rendered in the top-right chip
 *  - light: tonal variant (subtle background instead of accent-soft)
 *  - className: extra utility classes (typically layout / grid classes)
 *  - onClick: optional — renders as button-like when provided
 */
export default function DashboardStatCard({
  title,
  value,
  subtitle,
  hint,
  accent = "from-[var(--accent)] to-[var(--accent-2)]",
  light = false,
  icon = null,
  className = "",
  onClick,
  ariaLabel,
}) {
  const helperText = subtitle ?? hint;

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={ariaLabel ?? title}
      className={[
        "stat-card",
        "card-surface",
        "rounded-2xl",
        "p-4 sm:p-5",
        "relative overflow-hidden",
        "text-start",
        "w-full",
        onClick ? "focus-ring cursor-pointer hover:shadow-elevation-2 transition-shadow" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${accent}`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-widest text-muted truncate-1">
            {title}
          </div>

          <div className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-black tracking-tight text-main truncate-1">
            {value}
          </div>

          {helperText ? (
            <p className="mt-2 text-xs font-bold text-muted leading-relaxed truncate-2">
              {helperText}
            </p>
          ) : null}
        </div>

        {icon ? (
          <div
            className={[
              "shrink-0",
              "rounded-xl sm:rounded-2xl",
              "border border-border-accent",
              "p-2.5 sm:p-3",
              light ? "bg-soft text-accent" : "bg-accent-soft text-accent",
            ].join(" ")}
            aria-hidden="true"
          >
            {icon}
          </div>
        ) : null}
      </div>
    </Component>
  );
}
