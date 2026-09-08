import * as React from "react";
import { cn } from "@/lib/core/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    { className, checked = false, onCheckedChange, disabled = false, ...props },
    ref,
  ) => {
    const state = checked ? "checked" : "unchecked";

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        data-state={state}
        onClick={() => {
          if (!disabled) onCheckedChange?.(!checked);
        }}
        className={cn(
          "peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-md border border-black/20 bg-white shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)] dark:border-white/20 dark:bg-white/5",
          className,
        )}
        {...props}
      >
        {checked && (
          <Check
            className="h-3.5 w-3.5 text-white pointer-events-none block mx-auto"
            strokeWidth={3}
          />
        )}
      </button>
    );
  },
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
