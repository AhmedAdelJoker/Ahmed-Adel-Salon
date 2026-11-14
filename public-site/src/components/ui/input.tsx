import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * The booking form's text field.
 *
 * ## What changed
 *
 * The old class list named `public-control`, which resolved a `--border-2` that
 * is declared nowhere in this project — so the border silently rendered at
 * zero width. It also carried `text-gray-900` plus `dark:text-gray-100`,
 * meaning the field's text colour followed the *visitor's operating system*
 * while the page around it followed the salon. On a dark-OS visitor viewing a
 * bone-themed salon, the input was near-black text on near-white.
 *
 * All of it now comes from `.input` in `index.css`, which resolves
 * `--c-border-strong`, `--c-panel` and `--c-text` from the palette.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "input flex h-12 w-full px-4 text-[length:var(--step--1)] font-medium",
        "placeholder:text-[color:var(--c-faint)]",
        "file:border-0 file:bg-transparent file:text-sm",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };
