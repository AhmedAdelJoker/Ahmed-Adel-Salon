import React from "react";
import { User } from "lucide-react";
import { cn } from "../../lib/utils";
import { baseURL } from "../../services/api";

const STATIC_URL = baseURL.replace("/api/v1", "");

export function EmployeeAvatar({ 
  imageUrl, 
  name, 
  role, 
  size = "md", 
  showInfo = false,
  className,
  status = null 
}) {
  const getAvatarUrl = () => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `${STATIC_URL}${imageUrl}`;
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

  const sizeClasses = {
    xs: "h-6 w-6 text-[8px]",
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
    xl: "h-16 w-16 text-lg",
    "2xl": "h-20 w-20 text-xl",
  };

  const avatarUrl = getAvatarUrl();

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative shrink-0">
        <div 
          className={cn(
            "rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 font-black overflow-hidden border border-indigo-500/20 shadow-sm",
            sizeClasses[size] || sizeClasses.md
          )}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span>{getInitials()}</span>
          )}
        </div>
        
        {status && (
          <div 
            className={cn(
              "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-slate-950",
              size === 'xs' || size === 'sm' ? "h-2 w-2" : "h-3 w-3",
              status === 'active' || status === 'present' ? "bg-emerald-500" : "bg-slate-500"
            )}
          />
        )}
      </div>

      {showInfo && (
        <div className="flex flex-col min-w-0 text-right">
          <p className={cn(
            "font-black text-white truncate",
            size === 'sm' ? "text-xs" : "text-sm"
          )}>
            {name}
          </p>
          {role && (
            <p className={cn(
              "font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5",
              size === 'sm' ? "text-[8px]" : "text-[10px]"
            )}>
              {role}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
