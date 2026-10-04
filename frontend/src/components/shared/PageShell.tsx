/**
 * PageShell — the layout every route renders inside.
 *
 * Pages used to hand-roll this. Across 61 page files there were three
 * container families (`.erp-page`, `.erp-page-container`, and a `min-h-screen`
 * plus `max-w-7xl` column), seven different bottom paddings and five
 * `space-y-*` overrides that were fighting the gap the stylesheet already
 * defines. The result was that page rhythm drifted from one screen to the next.
 *
 * This owns the mechanics so pages only decide content:
 *
 *   <PageShell>
 *     <PageHeader ... />
 *     <StatsGrid />
 *   </PageShell>
 *
 * Two deliberate choices are left to the caller:
 *
 *   contained  - constrain to a readable column. Use on dense, wide layouts
 *                (tables, boards) where full-bleed stretches badly on a large
 *                monitor. Default is full width.
 *   fixed      - fill the viewport without scrolling, for app-like surfaces
 *                such as the POS. Default is a normally scrolling page.
 *
 * The bottom padding is the standard clearance for the fixed mobile nav, which
 * is hidden from `lg` up, so it collapses on desktop.
 */
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/core/utils";

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Constrain to a centred, readable column instead of full width. */
  contained?: boolean;
  /** Fill the viewport without scrolling. For kiosk-style surfaces. */
  fixed?: boolean;
}

export function PageShell({
  contained = false,
  fixed = false,
  className,
  children,
  ...rest
}: PageShellProps) {
  return (
    <div
      className={cn(
        "erp-page-container",
        fixed && "erp-page--fixed",
        // Standard clearance for the fixed mobile bottom bar.
        "pb-16 lg:pb-10",
        contained && "mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default PageShell;
