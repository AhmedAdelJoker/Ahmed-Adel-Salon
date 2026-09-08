const tones = {
  success: "border-success-border bg-success-bg text-success",
  error: "border-danger-border bg-danger-bg text-danger",
  danger: "border-danger-border bg-danger-bg text-danger",
  warning: "border-warning-border bg-warning-bg text-warning",
  info: "border-info-border bg-info-bg text-info",
  neutral: "border-border bg-soft text-muted",
};

export default function InlineNotice({
  children,
  tone = "success",
  className = "",
}) {
  const toneClass = tones[tone] || tones.success;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-bold leading-relaxed ${toneClass} ${className}`}
      dir="rtl"
      role="status"
    >
      {children}
    </div>
  );
}
