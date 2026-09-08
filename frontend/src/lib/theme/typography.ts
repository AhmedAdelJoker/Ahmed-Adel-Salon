// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHY SYSTEM — Unified Font Sizes
// ═══════════════════════════════════════════════════════════════
// Minimum font size: 12px (for accessibility)
// Uses Tailwind's built-in scale where possible

export const TYPOGRAPHY = {
  // Headings
  h1: "text-2xl font-extrabold tracking-tight", // 24px
  h2: "text-xl font-bold", // 20px
  h3: "text-lg font-bold", // 18px
  h4: "text-base font-bold", // 16px
  h5: "text-sm font-bold", // 14px

  // Body
  bodyLg: "text-sm font-medium", // 14px
  body: "text-xs font-medium", // 12px
  bodySm: "text-[11px] font-medium", // 11px (use sparingly)

  // Labels
  labelLg: "text-xs font-bold uppercase tracking-wider", // 12px
  label: "text-[11px] font-bold uppercase tracking-wide", // 11px
  labelSm: "text-[10px] font-bold uppercase tracking-wide", // 10px (use sparingly)

  // Captions
  caption: "text-[11px] font-bold text-muted", // 11px
  captionSm: "text-[10px] font-bold text-muted", // 10px (use sparingly)

  // Badges
  badgeLg: "text-xs font-black", // 12px
  badge: "text-[11px] font-black", // 11px
  badgeSm: "text-[10px] font-black", // 10px

  // Stats
  statValue: "text-3xl font-black tabular-nums", // 30px
  statLabel: "text-xs font-bold text-muted uppercase", // 12px

  // Buttons
  buttonLg: "text-sm font-bold", // 14px
  button: "text-xs font-bold", // 12px
  buttonSm: "text-[11px] font-bold", // 11px
};

// CSS class shortcuts for common patterns
export const TEXT_CLASSES = {
  // Text colors
  primary: "text-main",
  secondary: "text-muted",
  accent: "text-accent",
  muted: "text-muted/70",

  // Text alignment
  center: "text-center",
  right: "text-right",
  left: "text-left",

  // Truncation
  truncate: "truncate",
  lineClamp: "line-clamp-2",
};

// Helper to get typography class for a specific element
export function getTypography(element) {
  return TYPOGRAPHY[element] || TYPOGRAPHY.body;
}
