import * as React from "react";
import { cn } from "@/lib/core/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 min-w-0 w-full rounded-xl border border-border/40 bg-bg-main/50 px-4 py-2 text-[14px] font-bold text-main transition-all duration-300 placeholder:text-muted/30 focus-visible:border-accent/40 focus-visible:bg-bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/5 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };
