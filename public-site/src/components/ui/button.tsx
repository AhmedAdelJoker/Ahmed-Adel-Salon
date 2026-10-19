import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * The button set.
 *
 * ## What changed
 *
 * The previous version had twelve variants across four different palettes:
 * gold-bronze (`#8a5a25` → `#c58c3a`) in light, cyan (`#22D3EE`) in dark, plus
 * a `bg-[#17110e]` "primary" that ignored the salon palette entirely — so the
 * single most prominent element on the page did not follow the theme it was
 * supposed to belong to.
 *
 * Now every colour comes from the palette via `index.css` (`bg-accent`,
 * `border-line`, `text-ink`), so a button is the accent colour of whatever
 * salon it renders in. The shadow is a hard 2px offset rather than a blurred
 * halo — crisper, cheaper to composite, and the one place the softened
 * neo-brutalist register shows through.
 *
 * `rounded-2xl` on the old base (16px) plus `rounded-[1.75rem]`/`[3rem]` at
 * call sites gave the site six competing corner radii; the base now pins
 * `--r-md` and call sites stop overriding it.
 */

const buttonVariants = cva(
  "btn-base text-[length:var(--step--1)]",
  {
    variants: {
      variant: {
        /** The one action a screen should offer. */
        primary: "btn-base--solid",
        /** Equal weight, no fill. */
        outline: "btn-base--outline",
        /** Tertiary. */
        ghost: "btn-base--quiet",
        /** A surface the user can click — inside a panel or a list. */
        panel: "btn-base--panel",
        /** Destructive confirmation. */
        danger: "btn-base--danger",
        /** Alias kept so existing call sites keep working. */
        default: "btn-base--solid",
      },
      size: {
        sm: "min-h-9 px-3.5",
        default: "min-h-11 px-5",
        lg: "min-h-13 px-7",
        icon: "h-10 w-10 p-0",
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
          loading && "opacity-70",
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
                className="h-4 w-4 shrink-0 animate-spin"
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
