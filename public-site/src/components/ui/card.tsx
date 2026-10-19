import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Surfaces on the public site are themed by the salon, not by the `dark:`
 * class and not by a baked-in CSS class.
 *
 * This primitive previously carried `card public-card bg-white text-gray-900`
 * plus `dark:` variants, all inherited from the admin app. Two things were wrong
 * with that here:
 *
 *  - `.public-card` set a light gradient through the `background` *shorthand*.
 *    A shorthand resets every background longhand, so the caller's `bg-white/5`
 *    restored the colour but nothing restored the image — and the white gradient
 *    kept painting on top. Measured in the browser: `background-color:
 *    rgb(23,23,23)` next to `background-image: linear-gradient(rgba(255,255,255,
 *    0.7), …)`, which is a white panel holding `text-white`. Unreadable.
 *  - the `dark:` variants keyed off the visitor's operating system while the
 *    palette belongs to the salon.
 *
 * So the primitive stays shape-only and the caller supplies the surface. What
 * it *does* own now is the radius: the site pins one family in `--r-*`, and
 * call sites previously overrode it with `rounded-2xl`, `rounded-3xl` and
 * `rounded-[3rem]` interchangeably, so two adjacent cards could disagree about
 * their corner shape.
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-[length:var(--r-lg)] border border-line", className)}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/**
 * `children` is destructured and rendered explicitly rather than arriving
 * through `{...props}`. Functionally identical, but it lets
 * `jsx-a11y/heading-has-content` see that this heading is never empty —
 * with a bare spread the rule has to assume the worst.
 */
const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-[length:var(--step-1)] font-bold leading-tight tracking-normal",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[length:var(--step--1)] leading-relaxed text-ink-soft", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
