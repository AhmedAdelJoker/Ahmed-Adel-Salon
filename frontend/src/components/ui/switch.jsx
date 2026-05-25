import { useEffect } from 'react';
import * as React from "react";
import { cn } from "../../lib/utils";

const Switch = React.forwardRef(
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
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-black/10 bg-gray-200 p-0.5 shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6D28D9]/10 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#6D28D9] dark:border-white/10 dark:bg-white/10 dark:focus-visible:ring-[#22D3EE]/10 dark:data-[state=checked]:bg-[#22D3EE]",
          className,
        )}
        {...props}
      >
        <span
          data-state={state}
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-300 data-[state=checked]:-translate-x-5 data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-[#121212]",
          )}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";

export { Switch };


