import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "premium-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border text-sm font-black transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-indigo-600 text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.42)] hover:bg-indigo-700 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-500 dark:shadow-[0_8px_20px_-6px_rgba(56,189,248,0.42)]",
        default:
          "border-transparent bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-500",
        accent:
          "border-transparent bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-500",
        secondary:
          "premium-control-surface border-transparent text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-sky-400",
        outline:
          "premium-control-surface bg-transparent text-slate-700 hover:border-indigo-600/40 hover:text-indigo-600 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-400",
        ghost:
          "border-transparent bg-transparent text-slate-600 shadow-none hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-sky-400",
        danger:
          "border-transparent bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700",
        dangerSoft:
          "border-transparent bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20",
        success:
          "border-transparent bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700",
        successSoft:
          "border-transparent bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20",
        warning:
          "border-transparent bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600",
        warningSoft:
          "border-transparent bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20",
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


