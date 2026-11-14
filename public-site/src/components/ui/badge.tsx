import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * The label set.
 *
 * ## What changed
 *
 * The previous chip was a 10px uppercase pill with `tracking-widest`, coloured
 * purple (`#6D28D9`) in light and cyan (`#22D3EE`) in dark — a fifth and sixth
 * accent that belonged to no palette. It also carried `uppercase`, which does
 * nothing in Arabic script and pushes Latin labels into an all-caps shout.
 *
 * Now it is a hairline label whose colour comes from the palette, at a size
 * the reader can actually resolve. Square-ish corners instead of `rounded-xl`
 * on 10px text, which was producing a lozenge.
 */

const badgeVariants = cva(
  "chip [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        /** Quiet by default — a label should not compete with the thing it labels. */
        default: "",
        /** The one thing worth noticing on the screen. */
        accent: "chip--accent",
        ok: "chip--ok",
        stop: "chip--stop",
      },
      size: {
        sm: "px-2 py-0.5",
        default: "px-2.5 py-1",
        lg: "px-3.5 py-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
