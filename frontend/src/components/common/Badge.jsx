import { useEffect } from 'react';
const toneClasses = {
  slate: "badge badge-muted",
  neutral: "badge badge-muted",
  gold: "badge badge-gold",
  accent: "badge badge-gold",
  success: "badge badge-success",
  emerald: "badge badge-success",
  warning: "badge badge-warning",
  amber: "badge badge-warning",
  danger: "badge badge-danger",
  rose: "badge badge-danger",
  info: "badge badge-info",
  sky: "badge badge-info",
  violet: "badge badge-gold",
};

const sizeClasses = {
  sm: "",
  md: "badge-md",
  lg: "badge-lg",
};

export default function Badge({
  children,
  tone = "slate",
  size = "sm",
  dot = false,
  className = "",
}) {
  const toneClass = toneClasses[tone] || toneClasses.slate;
  const sizeClass = sizeClasses[size] || sizeClasses.sm;

  


return (

    <span
      className={`${toneClass} ${sizeClass} ${dot ? "badge-dot" : ""} ${className}`}
    >
      {children}
    </span>
  );
}


