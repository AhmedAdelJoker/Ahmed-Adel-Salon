import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(
  ({ className, type = "text", ...props }, ref) => (
    <input
        ref={ref}
        type={type}
        className={cn(
          "input premium-control-surface flex h-12 w-full rounded-2xl border px-5 py-2 text-sm font-bold text-slate-900 transition-all duration-300 placeholder:text-slate-400 file:border-0 file:bg-transparent file:text-sm file:font-bold focus-visible:border-indigo-600/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-600/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-sky-400/50 dark:focus-visible:ring-sky-400/10",
          className,
        )}
        {...props}
      />
  ),
);

Input.displayName = "Input";

export { Input };


