import { forwardRef, useMemo, type HTMLAttributes } from "react";
import { cn } from "@/lib/core/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "success" | "warning" | "error" | "neutral";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  showStatus?: boolean;
}

const sizeClasses = {
  xs: "avatar-xs",
  sm: "avatar-sm",
  md: "avatar-md",
  lg: "avatar-lg",
  xl: "avatar-xl",
};

const fallbackSizeClasses = {
  xs: "avatar-fallback-xs",
  sm: "avatar-fallback-sm",
  md: "avatar-fallback-md",
  lg: "avatar-fallback-lg",
  xl: "avatar-fallback-xl",
};

const statusClasses = {
  success: "avatar-status-success",
  warning: "avatar-status-warning",
  error: "avatar-status-error",
  neutral: "avatar-status-neutral",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      alt,
      name,
      size = "md",
      status,
      showStatus = false,
      ...props
    },
    ref,
  ) => {
    const initials = useMemo(() => (name ? getInitials(name) : "؟"), [name]);
    const hasImage = !!src;
    const imageErrorRef = { current: false };

    const handleError = () => {
      imageErrorRef.current = true;
    };

    return (
      <div
        ref={ref}
        className={cn(
          "avatar",
          sizeClasses[size],
          showStatus && "avatar-status",
          status && statusClasses[status],
          className,
        )}
        {...props}
      >
        {hasImage && !imageErrorRef.current ? (
          <img
            src={src}
            alt={alt || name || "Avatar"}
            className="w-full h-full object-cover"
            onError={handleError}
          />
        ) : (
          <span
            className={cn("avatar-fallback", fallbackSizeClasses[size])}
            aria-hidden="true"
          >
            {initials}
          </span>
        )}
        {showStatus && status && (
          <span className="sr-only">{status} status</span>
        )}
      </div>
    );
  },
);
Avatar.displayName = "Avatar";
