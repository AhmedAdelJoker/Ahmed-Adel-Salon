import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "input public-control flex h-12 w-full rounded-2xl border px-5 py-2 text-sm font-bold text-gray-900 transition-all duration-300 placeholder:text-gray-400 file:border-0 file:bg-transparent file:text-sm file:font-bold focus-visible:border-[#8a5a25]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8a5a25]/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus-visible:border-[#22D3EE]/50 dark:focus-visible:ring-[#22D3EE]/10",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };


