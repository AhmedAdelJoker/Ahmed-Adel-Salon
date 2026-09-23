/**
 * AsyncState — unified loading / error / empty container for async data views.
 *
 * Use this as the canonical rendering of pending, errored, or empty data
 * across the entire app. Designed to align with our gold-luxury theme and
 * the 4-tier responsive scale.
 *
 * Examples:
 *
 *   if (isLoading) return <LoadingState />;
 *   if (isError) return <ErrorState onRetry={refetch} />;
 *   if (!data?.length) return <EmptyState title="لا يوجد عملاء" />;
 */
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

/* ----------------------------- Loading ----------------------------- */

export interface LoadingStateProps {
  label?: string;
  variant?: "page" | "section" | "inline";
  className?: string;
}

export function LoadingState({
  label = "جاري التحميل...",
  variant = "page",
  className = "",
}: LoadingStateProps) {
  const isInline = variant === "inline";
  const isPage = variant === "page";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={[
        "flex flex-col items-center justify-center gap-3",
        isPage ? "py-16 sm:py-24" : "py-8 sm:py-12",
        isInline ? "flex-row" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Loader2
        className={[
          "animate-spin text-accent",
          isPage ? "h-10 w-10" : "h-6 w-6",
        ].join(" ")}
        aria-hidden="true"
      />
      <span className="text-sm font-bold text-muted truncate-1">{label}</span>
    </div>
  );
}

/* ------------------------------ Error ------------------------------ */

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: "page" | "section" | "inline";
  className?: string;
}

export function ErrorState({
  title = "حدث خطأ غير متوقع",
  message,
  onRetry,
  retryLabel = "إعادة المحاولة",
  variant = "page",
  className = "",
}: ErrorStateProps) {
  const isPage = variant === "page";

  return (
    <div
      role="alert"
      className={[
        "flex flex-col items-center justify-center gap-4 text-center",
        "card-surface rounded-2xl",
        isPage ? "py-12 px-6 sm:py-16 sm:px-10" : "py-6 px-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "flex items-center justify-center rounded-2xl bg-danger-soft text-danger",
          isPage ? "h-14 w-14 sm:h-16 sm:w-16" : "h-10 w-10",
        ].join(" ")}
        aria-hidden="true"
      >
        <AlertTriangle className={isPage ? "h-7 w-7 sm:h-8 sm:w-8" : "h-5 w-5"} />
      </div>
      <div className="space-y-1 max-w-md">
        <h3
          className={[
            "font-black text-main truncate-1",
            isPage ? "text-lg sm:text-xl" : "text-base",
          ].join(" ")}
        >
          {title}
        </h3>
        {message ? (
          <p className="text-xs sm:text-sm font-bold text-muted leading-relaxed truncate-2">
            {message}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-inverse hover:bg-primary-strong transition-colors touch-target"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------ Empty ------------------------------ */

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "page" | "section" | "inline";
  className?: string;
}

export function EmptyState({
  title = "لا توجد بيانات",
  message,
  icon,
  action,
  variant = "page",
  className = "",
}: EmptyStateProps) {
  const isPage = variant === "page";

  return (
    <div
      role="status"
      className={[
        "flex flex-col items-center justify-center gap-4 text-center",
        "card-surface rounded-2xl",
        isPage ? "py-12 px-6 sm:py-16 sm:px-10" : "py-6 px-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "flex items-center justify-center rounded-2xl bg-soft text-muted",
          isPage ? "h-14 w-14 sm:h-16 sm:w-16" : "h-10 w-10",
        ].join(" ")}
        aria-hidden="true"
      >
        {icon ?? <Inbox className={isPage ? "h-7 w-7 sm:h-8 sm:w-8" : "h-5 w-5"} />}
      </div>
      <div className="space-y-1 max-w-md">
        <h3
          className={[
            "font-black text-main truncate-1",
            isPage ? "text-lg sm:text-xl" : "text-base",
          ].join(" ")}
        >
          {title}
        </h3>
        {message ? (
          <p className="text-xs sm:text-sm font-bold text-muted leading-relaxed truncate-2">
            {message}
          </p>
        ) : null}
      </div>
      {action ?? null}
    </div>
  );
}
