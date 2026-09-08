import type { ReactNode } from "react";
import { cn } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";

export type EmptyStateVariant =
  | "search"
  | "no-records"
  | "no-permission"
  | "first-visit"
  | "custom";

export interface EmptyStateConfig {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionVariant?: "primary" | "ghost";
  onAction?: () => void;
}

const variantConfigs: Record<EmptyStateVariant, EmptyStateConfig> = {
  search: {
    icon: (
      <svg
        className="icon-size-lg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    title: "لا توجد نتائج",
    description: "جرب تغيير معايير البحث",
    actionLabel: "مسح الفلاتر",
    actionVariant: "ghost",
  },
  "no-records": {
    icon: (
      <svg
        className="icon-size-lg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "الأرشيف فارغ",
    description: "لا توجد سجلات حضور بعد",
    actionLabel: "تسجيل قيد",
    actionVariant: "primary",
  },
  "no-permission": {
    icon: (
      <svg
        className="icon-size-lg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: "وصول مرفوض",
    description: "ليس لديك صلاحية عرض هذه الصفحة",
    actionLabel: "تواصل مع المدير",
    actionVariant: "ghost",
  },
  "first-visit": {
    icon: (
      <svg
        className="icon-size-lg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "مرحباً بك",
    description: "ابدأ بتسجيل أول قيد حضور اليوم",
    actionLabel: "تسجيل قيد",
    actionVariant: "primary",
  },
  custom: {
    icon: null,
    title: "",
    description: "",
  },
};

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionVariant?: "primary" | "ghost";
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  variant = "no-records",
  icon,
  title,
  description,
  actionLabel,
  actionVariant,
  onAction,
  className,
}: EmptyStateProps) {
  const config = variantConfigs[variant];

  const finalIcon = icon ?? config.icon;
  const finalTitle = title ?? config.title;
  const finalDescription = description ?? config.description;
  const finalActionLabel = actionLabel ?? config.actionLabel;
  const finalActionVariant = actionVariant ?? config.actionVariant;
  const finalOnAction = onAction ?? config.onAction;

  return (
    <div
      className={cn("empty-state", className)}
      role="status"
      aria-live="polite"
    >
      {finalIcon && (
        <div className="empty-state-icon" aria-hidden="true">
          {finalIcon}
        </div>
      )}
      {finalTitle && <h3 className="empty-state-title">{finalTitle}</h3>}
      {finalDescription && (
        <p className="empty-state-desc">{finalDescription}</p>
      )}
      {finalActionLabel && finalOnAction && (
        <div className="empty-state-action">
          <Button variant={finalActionVariant} onClick={finalOnAction}>
            {finalActionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
