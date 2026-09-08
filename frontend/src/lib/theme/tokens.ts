// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS — Consistent Border Radius & Spacing
// ═══════════════════════════════════════════════════════════════

export const RADIUS = {
  // Standard sizes (use these consistently)
  sm: "rounded-md", // 6px - Small elements (badges, tags)
  md: "rounded-lg", // 8px - Buttons, inputs
  lg: "rounded-xl", // 12px - Cards, dialogs
  xl: "rounded-2xl", // 16px - Large cards
  full: "rounded-full", // 9999px - Avatars, circles
};

export const SPACING = {
  // Component padding
  card: "p-6",
  cardCompact: "p-4",
  cardLarge: "p-8",
  section: "p-8",
  sectionLarge: "p-10",

  // Gaps
  gapXs: "gap-1",
  gapSm: "gap-2",
  gapMd: "gap-4",
  gapLg: "gap-6",
  gapXl: "gap-8",
};

export const SHADOWS = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
  soft: "shadow-soft",
  premium: "shadow-premium",
};

// Helper to get consistent radius for element type
export function getRadius(elementType) {
  const map = {
    badge: RADIUS.sm,
    button: RADIUS.md,
    input: RADIUS.md,
    card: RADIUS.lg,
    dialog: RADIUS.xl,
    avatar: RADIUS.full,
  };
  return map[elementType] || RADIUS.md;
}
