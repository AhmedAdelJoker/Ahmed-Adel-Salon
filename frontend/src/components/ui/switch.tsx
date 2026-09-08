import * as React from "react";
import { cn } from "@/lib/core/utils";

export interface SwitchProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { className, checked = false, onCheckedChange, disabled = false, ...props },
    ref,
  ) => {
    const state = checked ? "checked" : "unchecked";

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-state={state}
        onClick={() => {
          if (!disabled) onCheckedChange?.(!checked);
        }}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-black/10 bg-slate-200 p-0.5 shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--accent)] dark:border-white/10 dark:bg-white/10",
          className,
        )}
        {...props}
      >
        <span
          data-state={state}
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-300 data-[state=checked]:-translate-x-5 data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-[#041421]",
          )}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";

export { Switch };
