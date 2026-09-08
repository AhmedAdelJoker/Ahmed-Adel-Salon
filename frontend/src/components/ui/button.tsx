import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/core/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex max-w-full min-w-0 items-center justify-center gap-2.5 whitespace-normal rounded-xl text-center text-sm font-black leading-tight transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-bg-main shadow-lg shadow-accent/10 hover:bg-accent-strong",
        secondary:
          "bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20",
        outline:
          "border border-border/60 bg-white/5 backdrop-blur-sm text-main hover:bg-accent/5 hover:border-accent/40",
        ghost: "text-muted hover:bg-white/5 hover:text-accent",
        danger:
          "bg-danger text-white shadow-lg shadow-danger/20 hover:opacity-90",
        dangerSoft:
          "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/10",
        success:
          "bg-success text-white shadow-lg shadow-success/20 hover:opacity-90",
        successSoft:
          "bg-success/10 text-success hover:bg-success/20 border border-success/10",
        warning:
          "bg-warning text-white shadow-lg shadow-warning/20 hover:opacity-90",
        warningSoft:
          "bg-warning/10 text-warning hover:bg-warning/20 border border-warning/10",
        premium:
          "bg-gradient-to-br from-accent via-accent-strong to-accent text-bg-main shadow-xl shadow-accent/20 border border-white/20",
        gold: "bg-transparent text-accent border border-accent/40 hover:bg-accent hover:text-bg-main shadow-[0_0_15px_rgba(212,175,55,0.1)]",
      },
      size: {
        default: "min-h-12 px-6 py-2.5",
        sm: "min-h-10 px-4 py-2 text-xs",
        lg: "min-h-14 px-8 py-3 text-base",
        xl: "min-h-16 px-10 py-3.5 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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
