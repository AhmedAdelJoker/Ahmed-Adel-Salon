import React, { useState, useEffect } from "react";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";
import { employeeInitials } from "./EmployeePhoto";

interface EmployeeAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  role?: string | null;
  size?: string;
  showInfo?: boolean;
  className?: string;
  status?: string | null;
  /** Circle for profile-style cards; rounded-panel (default) for list/table rows. */
  shape?: "circle" | "rounded";
}

export function EmployeeAvatar({
  imageUrl,
  name,
  role,
  size = "md",
  showInfo = false,
  className,
  status = null,
  shape = "rounded",
}: EmployeeAvatarProps) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [imageUrl]);

  const getAvatarUrl = () => {
    if (!imageUrl) return null;
    // Support blob:, data:, and absolute http(s) URLs as-is
    if (
      imageUrl.startsWith("http") ||
      imageUrl.startsWith("blob:") ||
      imageUrl.startsWith("data:")
    )
      return imageUrl;
    // In dev (Vite), staticURL is "" and /uploads is proxied to localhost:8000.
    // In Electron / VITE_API_URL, staticURL is the absolute backend origin.
    const base = staticURL.replace(/\/$/, "");
    return base ? `${base}/uploads${imageUrl}` : `/uploads${imageUrl}`;
  };

  const getInitials = () => employeeInitials(name);

  const sizeClasses: Record<string, string> = {
    xs: "h-6 w-6 text-[8px]",
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
    xl: "h-16 w-16 text-lg",
    "2xl": "h-20 w-20 text-xl",
  };

  const avatarUrl = getAvatarUrl();
  const showImage = avatarUrl && !imgError;

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative shrink-0">
        <div
          className={cn(
            "flex items-center justify-center overflow-hidden border border-line bg-accent/10 font-black text-accent shadow-sm",
            shapeClass,
            sizeClasses[size] || sizeClasses.md,
          )}
        >
          {showImage ? (
            <img
              src={avatarUrl as string}
              alt={name as string}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <span className="bg-gradient-to-br from-accent to-accent-strong bg-clip-text text-transparent">
              {getInitials()}
            </span>
          )}
        </div>

        {status && (
          <div
            className={cn(
              "absolute rounded-full border-2 border-card",
              shape === "circle" ? "bottom-0 end-0" : "-bottom-0.5 -end-0.5",
              size === "xs" || size === "sm" ? "h-2 w-2" : "h-3 w-3",
              status === "active" || status === "present"
                ? "bg-emerald-500"
                : status === "suspended"
                  ? "bg-amber-500"
                  : "bg-slate-400",
            )}
          />
        )}
      </div>

      {showInfo && (
        <div className="flex min-w-0 flex-col text-start">
          <p
            className={cn(
              "truncate font-black text-content",
              size === "sm" ? "text-xs" : "text-sm",
            )}
          >
            {name}
          </p>
          {role && (
            <p
              className={cn(
                "mt-0.5 font-bold uppercase leading-none tracking-widest text-content-tertiary",
                size === "sm" ? "text-[8px]" : "text-[10px]",
              )}
            >
              {role}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
