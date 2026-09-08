import React from "react";
import { cn } from "@/lib/core/utils";

/**
 * Skeleton loader for ProductCard - matches the exact structure of ProductCard
 */
export function ProductCardSkeleton({ className }) {
  return (
    <div
      className={cn(
        "relative rounded-premium border border-border bg-card shadow-soft overflow-hidden",
        "animate-pulse",
        className,
      )}
    >
      {/* Status bar skeleton */}
      <div className="h-1 w-full bg-border/50" />

      <div className="p-6 space-y-5">
        {/* Identity skeleton */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-border/50" />
            <div className="min-w-0 space-y-1">
              <div className="h-6 w-3/4 bg-border/50 rounded" />
              <div className="h-3 w-1/2 bg-border/50 rounded" />
            </div>
          </div>
          <div className="h-6 w-24 bg-border/50 rounded-full shrink-0" />
        </div>

        {/* Vitals skeleton - 4 metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-soft/50 p-4"
            >
              <div className="h-2 w-1/3 bg-border/50 rounded mb-1" />
              <div className="h-5 w-2/3 bg-border/50 rounded" />
            </div>
          ))}
        </div>

        {/* Additional info row skeleton */}
        <div className="rounded-2xl border border-border/60 bg-soft/50 p-4 flex items-center justify-between">
          <div>
            <div className="h-2 w-1/4 bg-border/50 rounded mb-1" />
            <div className="h-5 w-1/3 bg-border/50 rounded" />
          </div>
          <div className="h-9 w-9 rounded-xl bg-border/50" />
        </div>

        {/* Actions skeleton */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 h-10 rounded-xl bg-border/50" />
            <div className="flex-1 h-10 rounded-xl bg-border/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the stats grid
 */
export function StatCardSkeleton({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div
      className={cn(
        "group border-l-4 border-border/50 rounded-premium border border-border bg-card shadow-soft transition-all duration-300 overflow-hidden animate-pulse",
        className,
      )}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-border/50" />
        <div className="min-w-0 flex-1">
          <div className="h-2 w-1/2 bg-border/50 rounded" />
          <div className="h-8 w-3/4 bg-border/50 rounded mt-2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the stats grid (4 cards)
 */
export function StatsGridSkeleton({ className }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
      {[1, 2, 3, 4].map((i) => (
        <StatCardSkeleton key={i} delay={i * 0.05} />
      ))}
    </div>
  );
}

/**
 * Skeleton for the toolbar (search + tabs)
 */
export function ToolbarSkeleton({ className }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between",
        className,
      )}
    >
      <div className="relative flex-1 max-w-2xl group">
        <div className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 bg-border/50 rounded" />
        <div className="h-12 rounded-xl bg-border/50 pr-11" />
      </div>
      <div className="w-full xl:w-auto">
        <div className="bg-soft/50 border border-border p-1 rounded-xl h-12">
          <div className="flex gap-1.5 h-full">
            <div className="flex-1 h-full rounded-lg bg-border/50" />
            <div className="flex-1 h-full rounded-lg bg-border/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for filter panel
 */
export function FilterPanelSkeleton({ className }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <div className="h-2 w-1/4 bg-border/50 rounded" />
        <div className="h-12 rounded-xl bg-border/50" />
      </div>
      <div className="space-y-2">
        <div className="h-2 w-1/4 bg-border/50 rounded" />
        <div className="h-12 rounded-xl bg-border/50" />
      </div>
      <div className="space-y-2">
        <div className="h-2 w-1/4 bg-border/50 rounded" />
        <div className="h-12 rounded-xl bg-border/50" />
      </div>
    </div>
  );
}
