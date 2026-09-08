// ═══════════════════════════════════════════════════════════════
// DISPLAY COMPONENTS — unified, no-overlap, RTL-safe
//
// Rules enforced by every component in this file:
//   1. min-w-0 on every flex/grid child so truncation actually works
//   2. truncate / whitespace-nowrap on the value to prevent wrap
//   3. fixed line-height so cards have predictable heights
//   4. tabular-nums so currency numbers align column-wise
//   5. optional `title` for hover-tooltip when the value is truncated
// ═══════════════════════════════════════════════════════════════

import React, { type ReactNode } from "react";
import { cn, formatCurrency as fmtCurrency, formatDate, formatDateTime } from "@/lib/core/utils";

type Tone = "default" | "muted" | "danger" | "success" | "warning" | "primary" | "info" | "secondary" | "dark";

/**
 * DataField
 * --------
 * Read-only label + value pair used in cards, tables, modals.
 * Replaces the ad-hoc "text-[9px] ... text-lg font-black ..." pattern
 * that overflowed and broke layout in many places.
 *
 * Props:
 *   label       – small label above the value (muted, uppercase tracking)
 *   value       – the actual value (string, number, or node)
 *   icon        – optional lucide icon shown next to the label
 *   tone        – "default" | "muted" | "danger" | "success" | "warning" | "primary"
 *   size        – "sm" | "md" | "lg" (controls value font size)
 *   align       – "start" | "end" (RTL-aware: "start" = right in RTL)
 *   className   – extra wrapper classes
 */
export interface DataFieldProps {
  label?: ReactNode;
  value?: ReactNode;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  tone?: Tone | string;
  size?: "sm" | "md" | "lg" | "xl" | string;
  align?: "start" | "end" | string;
  className?: string;
}

export function DataField({
  label,
  value,
  icon: Icon,
  tone = "default",
  size = "md",
  align = "start",
  className,
}: DataFieldProps) {
  const tones = {
    default: "text-main",
    muted: "text-muted",
    danger: "text-rose-600",
    success: "text-emerald-600",
    warning: "text-amber-600",
    primary: "text-slate-900",
  };
  const sizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-lg",
  };
  const valueDisplay =
    value === null || value === undefined || value === "" ? "—" : value;

  return (
    <div
      className={cn(
        "min-w-0 flex flex-col gap-1",
        align === "end" ? "items-end text-end" : "items-start text-start",
        className,
      )}
    >
      {label && (
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted">
          {Icon && <Icon size={11} className="shrink-0" />}
          <span className="truncate">{label}</span>
        </div>
      )}
      <div
        className={cn(
          "font-black tabular-nums truncate w-full leading-tight",
          sizes[size],
          tones[tone] || tones.default,
        )}
        title={typeof valueDisplay === "string" || typeof valueDisplay === "number" ? String(valueDisplay) : undefined}
      >
        {valueDisplay}
      </div>
    </div>
  );
}

/**
 * StatCard
 * --------
 * Reusable KPI card. Guarantees:
 *   - fixed minimum height so siblings align in a grid
 *   - value is truncated (never wraps) and tabular-num aligned
 *   - icon is fixed-size and never pushes the value out
 *   - optional trend chip is bounded on the right
 *
 * Use as a drop-in replacement for the existing StatCard in
 * PremiumUI.jsx. Variants match the existing visual language.
 */
export interface StatCardProps {
  label?: ReactNode;
  value?: ReactNode;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  variant?: string;
  trend?: "positive" | "negative" | "neutral" | string;
  trendValue?: ReactNode;
  hint?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = "primary",
  trend,        // "positive" | "negative" | "neutral"
  trendValue,   // e.g. "+12%"
  hint,         // optional small line below the value
  className,
}: StatCardProps) {
  const variants = {
    primary: "bg-primary-soft/40 text-primary border-primary/20",
    success: "bg-emerald-50/60 text-emerald-700 border-emerald-200/60",
    warning: "bg-amber-50/60 text-amber-700 border-amber-200/60",
    danger:  "bg-rose-50/60 text-rose-700 border-rose-200/60",
    info:    "bg-sky-50/60 text-sky-700 border-sky-200/60",
    secondary: "bg-soft text-muted border-border",
    dark:    "bg-slate-900 text-white border-slate-900",
  };

  const trendTone =
    trend === "positive"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
      : trend === "negative"
        ? "bg-rose-500/10 text-rose-700 border-rose-200"
        : "bg-soft text-muted border-border";

  const valueText = value === null || value === undefined || value === "" ? "—" : value;

  return (
    <div
      className={cn(
        "relative rounded-2xl border shadow-sm p-4 sm:p-5 min-w-0 overflow-hidden h-[110px] flex flex-col justify-between",
        variants[variant] || variants.primary,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className="h-8 w-8 rounded-lg bg-white/70 border border-black/5 flex items-center justify-center shrink-0">
              <Icon size={16} />
            </div>
          )}
          <div className="text-[10px] font-black uppercase tracking-widest opacity-70 truncate">
            {label}
          </div>
        </div>
        {trendValue && (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black tabular-nums",
              trendTone,
            )}
          >
            {String(trendValue).replace("%", "")}%
          </span>
        )}
      </div>
      <div
        className={cn(
          "min-w-0 text-lg sm:text-xl lg:text-2xl font-black tabular-nums truncate leading-tight",
          variant === "dark" ? "text-white" : "text-main",
        )}
        title={typeof valueText === "string" || typeof valueText === "number" ? String(valueText) : undefined}
      >
        {valueText}
      </div>
      {hint && (
        <div className="text-[10px] font-bold opacity-70 truncate">{hint}</div>
      )}
    </div>
  );
}

/**
 * CurrencyStatCard
 * ----------------
 * Convenience wrapper for the most common case: a stat card whose
 * value is a money amount. Centralises the conversion through
 * `formatCurrency` so dashboards stay consistent.
 */
export function CurrencyStatCard({ label, value, icon, variant, trend, trendValue, hint, className }: StatCardProps) {
  return (
    <StatCard
      label={label}
      value={fmtCurrency(value)}
      icon={icon}
      variant={variant}
      trend={trend}
      trendValue={trendValue}
      hint={hint}
      className={className}
    />
  );
}

/**
 * ChartCard
 * ---------
 * Wrapper for any Recharts chart. Solves three recurring issues:
 *   1. Charts overflow the parent grid cell because the parent has
 *      no fixed min-height — ChartCard sets a default min-height
 *      of 280px (overridable).
 *   2. The "طرق الدفع" / "طرق الدفع" titles get cut off vertically
 *      when the card is too narrow — ChartCard uses a 2-line title
 *      with proper line-clamp and tooltip.
 *   3. Empty data shows nothing meaningful — ChartCard renders an
 *      EmptyChartState when `data` is empty.
 *
 * Slots:
 *   title, subtitle, badge  – header content
 *   actions                 – right-aligned header actions
 *   data                    – the chart data array; if empty, show empty state
 *   height                  – chart area height (default 280)
 *   children                – the chart (ResponsiveContainer etc.)
 */
export interface ChartCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  data?: unknown[];
  height?: number;
  emptyTitle?: string;
  emptyHint?: string;
  className?: string;
  children?: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  badge,
  actions,
  data,
  height = 280,
  emptyTitle = "لا توجد بيانات",
  emptyHint = "أضف بعض البيانات ليظهر المخطط",
  className,
  children,
}: ChartCardProps) {
  const isEmpty = !Array.isArray(data) || data.length === 0;
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5 min-w-0 flex flex-col",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="min-w-0 flex-1">
          {title && (
            <div className="text-sm font-black text-main truncate" title={typeof title === "string" ? title : undefined}>
              {title}
            </div>
          )}
          {subtitle && (
            <div className="text-[11px] font-bold text-muted mt-0.5 line-clamp-2" title={typeof subtitle === "string" ? subtitle : undefined}>
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {actions}
        </div>
      </div>
      <div className="flex-1 min-w-0" style={{ minHeight: height }}>
        {isEmpty ? (
          <ChartEmptyState title={emptyTitle} hint={emptyHint} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function ChartEmptyState({ title, hint }: { title?: ReactNode; hint?: ReactNode }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted"
      style={{ minHeight: 220 }}
    >
      <div className="h-12 w-12 rounded-2xl bg-soft border border-border flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 4 4 5-7" />
        </svg>
      </div>
      <p className="text-xs font-black mt-1">{title}</p>
      <p className="text-[11px] font-bold text-center max-w-[200px]">{hint}</p>
    </div>
  );
}

/**
 * AvatarCircle
 * ------------
 * Drop-in replacement for the inline avatar in form pages.
 * Renders a clean placeholder (icon + initials) when no image is
 * available — never the literal string "Profile" or "User".
 */
export interface AvatarCircleProps {
  name?: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg" | "xl" | string;
  className?: string;
  onClick?: () => void;
}

export function AvatarCircle({ name, imageUrl, size = "lg", className, onClick }: AvatarCircleProps) {
  const sizeMap = {
    sm: "h-10 w-10 text-xs",
    md: "h-14 w-14 text-sm",
    lg: "h-20 w-20 text-lg",
    xl: "h-28 w-28 text-2xl",
  };
  const getInitials = () => {
    if (!name) return "";
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  };
  const wrap = (
    <div
      className={cn(
        "relative rounded-2xl border-2 border-dashed border-border bg-soft flex items-center justify-center overflow-hidden text-muted shrink-0",
        sizeMap[size] || sizeMap.lg,
        onClick && "cursor-pointer hover:border-slate-900 hover:text-slate-900 transition-colors",
        className,
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name || ""} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-0.5 text-muted">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="opacity-60">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          {size !== "sm" && (
            <span className="text-[9px] font-black uppercase tracking-widest mt-0.5">
              {getInitials() || "صورة"}
            </span>
          )}
        </div>
      )}
    </div>
  );
  return wrap;
}

/**
 * ProgressBar
 * -----------
 * Inline progress indicator (e.g. "16%" profile completion).
 * Replaces the bare "16%" badge that appeared in the tabs list.
 */
export interface ProgressBarProps {
  value?: number | string;
  label?: ReactNode;
  className?: string;
  tone?: string;
}

export function ProgressBar({ value, label, className, tone = "primary" }: ProgressBarProps) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const tones = {
    primary: "bg-slate-900",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
  };
  return (
    <div className={cn("w-full min-w-0", className)}>
      {label && (
        <div className="flex items-center justify-between text-[10px] font-black text-muted mb-1">
          <span className="truncate">{label}</span>
          <span className="tabular-nums shrink-0">{safe}%</span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-soft overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", tones[tone] || tones.primary)}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

/**
 * DateText
 * --------
 * Renders a date in a clean, monospaced, non-RTL-broken format.
 * Default: DD/MM/YYYY. Pass `withTime` for HH:MM.
 */
export interface DateTextProps {
  value?: string | number | Date | null | undefined;
  withTime?: boolean;
  className?: string;
  muted?: boolean;
}

export function DateText({ value, withTime = false, className, muted = false }: DateTextProps) {
  const text = withTime ? formatDateTime(value) : formatDate(value);
  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        muted ? "text-muted" : "text-main",
        className,
      )}
    >
      {text}
    </span>
  );
}

/**
 * CurrencyText
 * ------------
 * Renders a currency value with proper tabular alignment and
 * consistent symbol placement. Replaces all raw formatCurrency
 * usages inside table/list cells.
 */
export interface CurrencyTextProps {
  value?: unknown;
  className?: string;
  tone?: string;
  bold?: boolean;
}

export function CurrencyText({ value, className, tone = "default", bold = true }: CurrencyTextProps) {
  const tones = {
    default: "text-main",
    muted: "text-muted",
    success: "text-emerald-600",
    danger: "text-rose-600",
    primary: "text-slate-900",
  };
  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        bold && "font-black",
        tones[tone] || tones.default,
        className,
      )}
      title={fmtCurrency(value)}
    >
      {fmtCurrency(value)}
    </span>
  );
}
