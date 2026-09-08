import * as React from "react";
import { cn } from "@/lib/core/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  return (
    <label
      className={cn("text-sm font-bold text-main", className)}
      ref={ref}
      {...props}
    />
  );
});
Label.displayName = "Label";

export { Label };
