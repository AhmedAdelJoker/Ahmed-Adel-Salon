import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/core/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
  {
    variants: {
      variant: {
        default: "border-primary-soft bg-primary-soft text-primary",
        primary: "border-primary-soft bg-primary-soft text-primary",
        secondary: "border-border bg-soft text-muted",
        outline: "border-border bg-transparent text-muted hover:bg-soft",
        danger: "border-danger-soft bg-danger-soft text-danger",
        success: "border-success-soft bg-success-soft text-success",
        warning: "border-warning-soft bg-warning-soft text-warning",
        info: "border-info-soft bg-info-soft text-info",
      },
      size: {
        sm: "px-2 py-0.5 text-[9px]",
        md: "px-2.5 py-1 text-[10px]",
        lg: "px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
