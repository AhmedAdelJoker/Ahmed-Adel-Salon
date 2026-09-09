import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "public-badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl border px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-purple-200 bg-purple-50 text-[#6D28D9] dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-[#22D3EE]",
        accent:
          "border-purple-200 bg-purple-50 text-[#6D28D9] dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-[#22D3EE]",
        secondary:
          "border-gray-200 bg-gray-100 text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-gray-300",
        muted:
          "border-gray-200 bg-gray-100 text-gray-600 dark:border-white/10 dark:bg-white/10 dark:text-gray-400",
        outline:
          "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10",
        destructive:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300",
        danger:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300",
        warning:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300",
        info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300",
      },
      size: {
        sm: "px-3 py-1 text-[10px]",
        md: "px-3.5 py-1.5 text-xs",
        lg: "rounded-2xl px-4 py-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, size, asChild = false, ...props }: BadgeProps) {
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


