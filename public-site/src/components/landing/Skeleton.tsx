import { useEffect, useRef, useState } from "react";

/**
 * Skeleton.tsx — loading placeholders.
 *
 * The site used a centred scissors glyph and the words "جاري التحميل". That is
 * the single clearest signal that a page is a template: real products reserve
 * the final layout and shimmer it, so nothing jumps when the data lands.
 *
 * The shimmer respects `prefers-reduced-motion` — the global reset flattens the
 * animation, and the placeholder stays a neutral block rather than a pulsing one.
 */

export function Shimmer({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton-shimmer block ${className}`} />;
}

/**
 * A labelled busy region.
 *
 * `role="status"` with `aria-busy` announces that something is loading without
 * stealing focus. `aria-hidden` on the shapes keeps the screen reader from
 * reading out a column of meaningless boxes.
 */
export function SkeletonRegion({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function ServiceRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <SkeletonRegion label="جاري تحميل الخدمات" className="shell py-[length:var(--section-y)]">
      <div className="mb-10 space-y-4">
        <Shimmer className="h-3 w-20 rounded-full" />
        <Shimmer className="h-10 w-72 max-w-full rounded-xl" />
        <Shimmer className="h-4 w-96 max-w-full rounded-lg" />
      </div>
      <div className="space-y-0 border-t border-[color:var(--c-border)]">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b border-[color:var(--c-border)] py-7"
          >
            <Shimmer className="h-3 w-6 rounded" />
            <div className="space-y-2">
              <Shimmer className="h-4 w-40 rounded" />
              <Shimmer className="h-3 w-72 max-w-full rounded" />
            </div>
            <div className="space-y-2 text-end">
              <Shimmer className="ml-auto h-6 w-16 rounded" />
              <Shimmer className="ml-auto h-3 w-12 rounded" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function PanelSkeleton({ label = "جاري التحميل" }: { label?: string }) {
  return (
    <SkeletonRegion label={label} className="shell py-20">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
        <Shimmer className="h-16 w-16 rounded-2xl" />
        <Shimmer className="h-5 w-56 rounded-lg" />
        <Shimmer className="h-3 w-80 max-w-full rounded" />
      </div>
    </SkeletonRegion>
  );
}

/**
 * BookingPanelSkeleton — shaped like the real booking aside so the layout does
 * not reflow when the catalogue arrives.
 */
export function BookingPanelSkeleton() {
  return (
    <SkeletonRegion label="جاري تجهيز صفحة الحجز" className="shell py-24">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-4">
          <Shimmer className="h-12 w-2/3 rounded-xl" />
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-5/6 rounded" />
          <Shimmer className="h-14 w-48 rounded-full" />
        </div>
        <div className="space-y-3 rounded-[var(--r-xl)] border border-[color:var(--c-border)] p-7">
          <Shimmer className="h-3 w-24 rounded-full" />
          <Shimmer className="h-6 w-32 rounded" />
          {Array.from({ length: 4 }, (_, index) => (
            <Shimmer key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/**
 * useMounted — false on the first render, true afterwards.
 *
 * Skeletons must not flash on a warm cache or a fast response, so they only
 * appear after a short delay. This is that delay, as a hook.
 */
export function useDelayedFlag(delayMs = 220): boolean {
  const [show, setShow] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    timer.current = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(timer.current);
  }, [delayMs]);

  return show;
}
