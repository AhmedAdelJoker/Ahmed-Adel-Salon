import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

/**
 * PremiumCard component for a consistent professional look.
 */
interface PremiumCardProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * Classes applied to the outer motion wrapper (the actual grid/flex item).
   * Use for layout placement utilities like col-span/row-span/order —
   * `className` lands on the inner styled box and is ignored by parent grids.
   */
  wrapperClassName?: string;
  noPadding?: boolean;
  hoverable?: boolean;
  animate?: boolean;
  delay?: number;
}

export const PremiumCard = ({
  children,
  className,
  wrapperClassName,
  noPadding = false,
  hoverable = true,
  animate = true,
  delay = 0,
}: PremiumCardProps) => {
  const content = (
    <div
      className={cn(
        "relative rounded-premium border border-border bg-card shadow-soft transition-all duration-300 overflow-hidden",
        hoverable && "hover:shadow-premium",
        !noPadding && "p-6",
        className,
      )}
    >
      {children}
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay, ease: "easeOut" }}
      className={cn("min-w-0", wrapperClassName)}
    >
      {content}
    </motion.div>
  );
};

/**
 * PageHeader component for consistent page titles and actions.
 */
interface PageHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: any;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  badge,
  className,
}: PageHeaderProps) => {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        {badge && (
          <div className="inline-flex items-center gap-2 rounded-md border border-primary-soft bg-primary-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            {Icon && <Icon size={12} />}
            {badge}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-main">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm font-medium text-muted">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
};

/**
 * StatCard component for consistent KPI displays.
 */
interface StatCardProps {
  label?: React.ReactNode;
  value?: React.ReactNode;
  icon?: any;
  variant?: string;
  trend?: string;
  trendValue?: React.ReactNode;
  delay?: number;
}

export const StatCard = ({
  label,
  value,
  icon: Icon,
  variant = "primary",
  trend,
  trendValue,
  delay = 0,
}: StatCardProps) => {
  const variants: Record<string, string> = {
    primary: "bg-primary-soft text-primary border-primary/10",
    success: "bg-success-soft text-success border-success/10",
    warning: "bg-warning-soft text-warning border-warning/10",
    danger: "bg-danger-soft text-danger border-danger/10",
    info: "bg-info-soft text-info border-info/10",
    secondary: "bg-soft text-muted border-border",
  };

  return (
    <PremiumCard
      delay={delay}
      className={cn("group border-l-4", variants[variant] || variants.primary)}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm transition-transform group-hover:scale-105 border border-border/30">
          {Icon && <Icon size={20} />}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest opacity-60 truncate mb-0.5">
            {label}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-main tabular-nums truncate leading-none">
            {value}
          </div>
        </div>
        {trendValue && (
          <div
            className={cn(
              "hidden sm:flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black",
              trend === "positive"
                ? "bg-success-soft text-success border border-success/20"
                : trend === "negative"
                ? "bg-danger-soft text-danger border border-danger/20"
                : "bg-soft text-muted",
            )}
          >
            {trend === "positive" ? (
              <TrendingUp size={12} />
            ) : trend === "negative" ? (
              <TrendingDown size={12} />
            ) : (
              <Minus size={12} />
            )}
            {String(trendValue).replace("%","")}%
          </div>
        )}
      </div>
    </PremiumCard>
  );
};

/**
 * ContentPanel component for structured sections within a page.
 */
interface ContentPanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const ContentPanel = ({
  title,
  subtitle,
  actions,
  children,
  className,
  noPadding = false,
}: ContentPanelProps) => {
  return (
    <div className={cn("content-panel overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-4 border-b border-border/50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h3 className="text-lg font-black tracking-tight text-main">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-6")}>{children}</div>
    </div>
  );
};

/**
 * SkeletonCard component for loading states.
 */
interface SkeletonCardProps {
  variant?: string;
  height?: number;
  className?: string;
}

export const SkeletonCard = ({ variant = "stats", height = 200, className }: SkeletonCardProps) => {
  const pulse = "animate-pulse bg-gradient-to-r from-soft via-border to-soft bg-[length:200%_100%]";
  
  const variants: Record<string, React.ReactNode> = {
    stats: (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-premium border border-border bg-card shadow-soft p-6 group", className)}
      >
        <div className="flex items-center gap-4">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg bg-card shadow-sm border border-border/30", pulse)} />
          <div className="min-w-0 flex-1">
            <div className={cn("text-[10px] font-bold uppercase tracking-widest opacity-50 truncate h-4 w-3/4 mb-2", pulse)} />
            <div className={cn("text-xl font-extrabold tracking-tight text-main tabular-nums h-8 w-1/2", pulse)} />
          </div>
        </div>
      </motion.div>
    ),
    chart: (
      <div className={cn("h-full w-full rounded-premium border border-border bg-card shadow-soft", className)}>
        <div className="h-10 w-1/3 mx-auto my-6 rounded border border-border/50 bg-soft/50" />
        <div className={cn("h-full w-full p-6", pulse)} />
      </div>
    ),
    content: (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-premium border border-border bg-card shadow-soft p-6 space-y-4", className)}
      >
        <div className={cn("h-8 w-1/4 rounded border border-border/50 bg-soft/50", pulse)} />
        <div className={cn("h-6 w-full rounded border border-border/50 bg-soft/50", pulse)} />
        <div className={cn("h-6 w-2/3 rounded border border-border/50 bg-soft/50", pulse)} />
        <div className={cn("h-6 w-1/2 rounded border border-border/50 bg-soft/50", pulse)} />
      </motion.div>
    ),
  };

  return variants[variant] || variants.stats;
};

SkeletonCard.displayName = "SkeletonCard";

export default { PremiumCard, PageHeader, StatCard, ContentPanel, SkeletonCard };
