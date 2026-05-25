import { useAuth } from "../../context/AuthContext";
import { useEffect } from 'react';
import { Loader2 } from "lucide-react";

const base =
  "btn inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  success: "btn-success",
  warning: "btn-warning",
  icon: "btn-icon btn-ghost",
};

const sizes = {
  xs: "btn-xs",
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
  xl: "btn-xl",
  icon: "btn-md btn-icon",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled = false,
  type = "button",
  ...props
}) {
  const resolvedVariant = variants[variant] || variants.primary;
  const resolvedSize =
    variant === "icon" ? sizes.icon : sizes[size] || sizes.md;
  const isDisabled = disabled || loading;

  


return (

    <button
      type={type}
      className={`${base} ${resolvedVariant} ${resolvedSize} ${loading ? "btn-loading" : ""} ${className}`}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      {...props}
    >
      {loading && (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}


