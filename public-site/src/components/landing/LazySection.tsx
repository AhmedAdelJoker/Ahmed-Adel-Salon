import React, { Suspense } from "react";

/**
 * SectionSkeleton — Realistic skeleton placeholder for lazy-loaded sections.
 * Matches the visual shape of the actual section to prevent CLS.
 *
 * Variants:
 * - "default" — generic blocks
 * - "hero" — full-bleed hero with image + content stack
 * - "grid" — card grid (3 columns)
 * - "list" — vertical list rows
 * - "text" — text-heavy section (FAQ, testimonials)
 */
export type SectionSkeletonVariant = "default" | "hero" | "grid" | "list" | "text";

export interface SectionSkeletonProps {
  height?: number;
  rounded?: boolean;
  variant?: SectionSkeletonVariant | string;
}

export function SectionSkeleton({ height = 400, rounded = true, variant = "default" }: SectionSkeletonProps) {
  const renderContent = () => {
    switch (variant) {
      case "hero":
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
            <div className="h-px w-28 bg-white/10" />
            <div className="skeleton h-8 w-32 rounded-full" />
            <div className="skeleton h-16 w-3/4 max-w-xl rounded-2xl" />
            <div className="skeleton h-12 w-2/3 max-w-md rounded-xl" />
            <div className="flex gap-4 mt-4">
              <div className="skeleton h-14 w-36 rounded-2xl" />
              <div className="skeleton h-14 w-36 rounded-2xl" />
            </div>
          </div>
        );
      case "grid":
        return (
          <div className="absolute inset-0 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="skeleton rounded-3xl h-48"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        );
      case "list":
        return (
          <div className="absolute inset-0 p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="skeleton h-20 rounded-2xl w-full"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        );
      case "text":
        return (
          <div className="absolute inset-0 p-8 space-y-4 max-w-3xl mx-auto">
            <div className="skeleton h-8 w-1/3 rounded-xl mb-6" />
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="skeleton h-16 rounded-2xl w-full"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        );
      case "default":
      default:
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <div className="skeleton h-6 w-32 rounded-full" />
            <div className="skeleton h-12 w-64 rounded-2xl" />
            <div className="skeleton h-32 w-full max-w-2xl rounded-3xl" />
          </div>
        );
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden ${
        rounded ? "rounded-[3rem]" : ""
      }`}
      style={{ height: `${height}px` }}
      aria-hidden="true"
      role="status"
    >
      {renderContent()}
      <style>{`
        .skeleton {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.03) 0%,
            rgba(255, 255, 255, 0.08) 50%,
            rgba(255, 255, 255, 0.03) 100%
          );
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
        }
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .skeleton {
            animation: none;
            background: rgba(255, 255, 255, 0.05);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * SectionErrorBoundary — Catches errors in lazy-loaded sections.
 * Falls back to a graceful "skip" instead of crashing the whole page.
 */
export interface SectionErrorBoundaryProps {
  children?: React.ReactNode;
}

export interface SectionErrorBoundaryState {
  hasError: boolean;
}

export class SectionErrorBoundary extends React.Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.warn("Section failed to load:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * LazySection — Combines error boundary + suspense + skeleton placeholder.
 *
 * Usage:
 *   <LazySection minHeight={500} variant="grid">
 *     <ServicesExplorer {...props} />
 *   </LazySection>
 */
export interface LazySectionProps {
  children?: React.ReactNode;
  minHeight?: number;
  rounded?: boolean;
  variant?: SectionSkeletonVariant | string;
}

export function LazySection({ children, minHeight = 400, rounded = true, variant = "default" }: LazySectionProps) {
  return (
    <SectionErrorBoundary>
      <Suspense fallback={<SectionSkeleton height={minHeight} rounded={rounded} variant={variant} />}>
        {children}
      </Suspense>
    </SectionErrorBoundary>
  );
}
