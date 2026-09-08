export default function FadeIn({
  children,
  delay = 0,
  type = "up",
  className = "",
}) {
  const animationClass =
    type === "scale"
      ? "animate-scale-in"
      : type === "down"
        ? "animate-fade-down"
        : type === "in"
          ? "animate-fade-in"
          : "animate-fade-up";

  return (
    <div
      className={`${animationClass} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
