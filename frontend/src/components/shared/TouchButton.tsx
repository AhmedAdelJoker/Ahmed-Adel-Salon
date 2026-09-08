import { motion } from "framer-motion";
import { cn } from "@/lib/core/utils";

export default function TouchButton({
  children,
  onClick,
  className = "",
  variant = "default",
  size = "md",
  disabled = false,
  ...props
}) {
  const variants = {
    default: "bg-card border border-border text-main hover:bg-soft",
    primary: "bg-primary text-white hover:bg-primary-strong",
    ghost: "bg-transparent text-muted hover:bg-soft/50",
    danger: "bg-danger-soft text-danger hover:bg-danger/10",
  };

  const sizes = {
    sm: "h-9 px-3 text-xs rounded-xl",
    md: "h-11 px-4 text-sm rounded-2xl",
    lg: "h-14 px-6 text-base rounded-2xl",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition-colors",
        "active:bg-soft/80 disabled:opacity-50 disabled:pointer-events-none",
        "touch-manipulation select-none",
        variants[variant],
        sizes[size],
        className,
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
