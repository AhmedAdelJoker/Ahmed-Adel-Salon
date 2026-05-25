import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "public-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border text-sm font-black transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-[#17110e] text-white shadow-sm hover:bg-[#241914] dark:bg-[#22D3EE] dark:text-[#121212] dark:hover:bg-[#06B6D4]",
        default:
          "border-transparent bg-[#17110e] text-white shadow-sm hover:bg-[#241914] dark:bg-[#22D3EE] dark:text-[#121212] dark:hover:bg-[#06B6D4]",
        accent:
          "border-transparent bg-[linear-gradient(135deg,#8a5a25_0%,#c58c3a_100%)] text-white shadow-sm hover:brightness-105 dark:bg-[#22D3EE] dark:text-[#121212] dark:hover:bg-[#06B6D4]",
        secondary:
          "public-control border-transparent text-gray-700 hover:text-[#8a5a25] dark:bg-[#1F1F1F] dark:text-gray-300 dark:hover:bg-cyan-400/10 dark:hover:text-[#22D3EE]",
        outline:
          "public-control bg-transparent text-gray-700 hover:border-[#8a5a25]/35 hover:text-[#8a5a25] dark:border-white/10 dark:text-gray-300 dark:hover:border-[#22D3EE]/40 dark:hover:bg-cyan-400/10 dark:hover:text-[#22D3EE]",
        ghost:
          "border-transparent bg-transparent text-gray-600 shadow-none hover:bg-[#8a5a25]/8 hover:text-[#8a5a25] dark:text-gray-400 dark:hover:bg-cyan-400/10 dark:hover:text-[#22D3EE]",
        danger:
          "border-transparent bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md",
        dangerSoft:
          "public-control border-transparent bg-red-50 text-red-700 hover:bg-red-600 hover:text-white dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500 dark:hover:text-white",
        success:
          "border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md",
        successSoft:
          "public-control border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500 dark:hover:text-white",
        warning:
          "border-transparent bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow-md",
        warningSoft:
          "public-control border-transparent bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500 dark:hover:text-white",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        xl: "h-16 px-10 text-lg",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

const Button = React.forwardRef(
  (
    {
      className,
      variant,
      size,
      loading = false,
      disabled,
      children,
      asChild = false,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        type={!asChild ? type : undefined}
        className={cn(
          buttonVariants({ variant, size }),
          loading && "opacity-75",
          className,
        )}
        disabled={!asChild ? isDisabled : undefined}
        aria-busy={loading ? "true" : undefined}
        aria-disabled={asChild && isDisabled ? "true" : undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <Loader2
                className="h-5 w-5 shrink-0 animate-spin"
                aria-hidden="true"
              />
            )}
            {children}
          </>
        )}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };


