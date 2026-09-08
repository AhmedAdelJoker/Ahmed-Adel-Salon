import React, { useState, useEffect } from "react";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";

interface EmployeeAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  role?: string | null;
  size?: string;
  showInfo?: boolean;
  className?: string;
  status?: string | null;
}

export function EmployeeAvatar({
  imageUrl,
  name,
  role,
  size = "md",
  showInfo = false,
  className,
  status = null,
}: EmployeeAvatarProps) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [imageUrl]);

  const getAvatarUrl = () => {
    if (!imageUrl) return null;
    // Support blob:, data:, http(s), and relative /uploads paths
    if (
      imageUrl.startsWith("http") ||
      imageUrl.startsWith("blob:") ||
      imageUrl.startsWith("data:")
    )
      return imageUrl;
    return `${staticURL}${imageUrl}`;
  };

  const getInitials = () => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

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

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative shrink-0">
        <div
          className={cn(
            "rounded-xl bg-accent/10 flex items-center justify-center text-accent font-black overflow-hidden border border-border shadow-sm",
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
              "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-slate-950",
              size === "xs" || size === "sm" ? "h-2 w-2" : "h-3 w-3",
              status === "active" || status === "present"
                ? "bg-emerald-500"
                : "bg-slate-500",
            )}
          />
        )}
      </div>

      {showInfo && (
        <div className="flex flex-col min-w-0 text-right">
          <p
            className={cn(
              "font-black text-white truncate",
              size === "sm" ? "text-xs" : "text-sm",
            )}
          >
            {name}
          </p>
          {role && (
            <p
              className={cn(
                "font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5",
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
