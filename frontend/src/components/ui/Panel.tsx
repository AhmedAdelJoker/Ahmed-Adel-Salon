import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/core/utils";

export type PanelVariant = "default" | "elevated" | "sticky";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant;
  children: ReactNode;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const baseClasses = "panel";
    const variantClasses = {
      default: "",
      elevated: "panel-elevated",
      sticky: "panel-sticky",
    };

    return (
      <div
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Panel.displayName = "Panel";
