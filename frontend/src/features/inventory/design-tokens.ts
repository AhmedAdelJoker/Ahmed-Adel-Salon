/**
 * Inventory Feature Design Tokens
 * Derived from the global Midnight Gold Luxury design system (src/styles/index.css)
 * Single source of truth for all inventory-specific design decisions.
 */

export const inventoryTokens = {
  // ─── Color Palette ───
  color: {
    // Brand (from global --primary / --accent)
    brand: {
      DEFAULT: "var(--primary)", // #A68B5C (Champagne Gold)
      strong: "var(--primary-strong)", // #8A7344
      soft: "var(--primary-soft)", // rgba(166,139,92,0.08)
      subtle: "var(--primary-subtle)", // rgba(166,139,92,0.04)
      glow: "var(--accent-glow)", // rgba(166,139,92,0.15)
      onBrand: "var(--primary-foreground)", // white
    },

    // Semantic Status Colors (from global tokens)
    status: {
      stable: {
        // مخزون مستقر - Green/Kelp
        DEFAULT: "var(--success)", // #15803D
        soft: "var(--success-soft)", // rgba(21,128,61,0.08)
        on: "var(--success-foreground)",
      },
      warning: {
        // نواقص/قرب النفاد - Amber/Ember
        DEFAULT: "var(--warning)", // #B45309
        soft: "var(--warning-soft)", // rgba(180,83,9,0.08)
        on: "var(--warning-foreground)",
      },
      critical: {
        // منتهي/صفر - Red/Crimson
        DEFAULT: "var(--danger)", // #B91C1C
        soft: "var(--danger-soft)", // rgba(185,28,28,0.08)
        on: "var(--danger-foreground)",
      },
      archived: {
        // مؤرشف - Muted/Slate
        DEFAULT: "var(--muted)", // #57534E
        soft: "var(--muted-soft)", // custom if needed
        on: "var(--muted-foreground)",
      },
      info: {
        // معلوماتي - Blue
        DEFAULT: "var(--info)", // #1D4ED8
        soft: "var(--info-soft)", // rgba(29,78,216,0.08)
        on: "var(--info-foreground)",
      },
    },

    // Surface / Background
    surface: {
      page: "var(--bg-main)", // #FDFBF7
      card: "var(--bg-card)", // rgba(255,255,255,0.95)
      soft: "var(--bg-soft)", // #F5F2EB
      overlay: "var(--bg-overlay)", // rgba(253,251,247,0.85)
      border: "var(--border)", // rgba(166,139,92,0.12)
      borderStrong: "var(--border-strong)", // if defined
    },

    // Text
    text: {
      main: "var(--text-main)", // #1C1917
      muted: "var(--text-muted)", // #57534E
      soft: "var(--text-soft)", // #A8A29E
      inverse: "var(--inverse)", // #09090B
    },
  },

  // ─── Typography ───
  font: {
    display: "var(--font-display)", // "Alexandria", "IBM Plex Sans Arabic", system-ui
    body: "var(--font-sans)", // "Alexandria", "Cairo", system-ui
    data: "var(--font-mono)", // "SF Mono", "Cascadia Code", Consolas, monospace
  },

  typeScale: {
    // Display / Headlines
    "display-xl": "clamp(1.5rem, 5vw, 3rem)",
    "display-lg": "clamp(1.25rem, 4vw, 2.25rem)",
    "display-md": "clamp(1.1rem, 3vw, 1.75rem)",
    "display-sm": "clamp(1rem, 2.5vw, 1.375rem)",

    // Body
    "body-lg": "1.125rem", // 18px
    "body-md": "1rem", // 16px
    "body-sm": "0.875rem", // 14px
    "body-xs": "0.8125rem", // 13px
    "body-2xs": "0.75rem", // 12px

    // Labels / UI
    "label-lg": "0.75rem", // 12px - uppercase, tracking-wider
    "label-md": "0.6875rem", // 11px
    "label-sm": "0.625rem", // 10px - uppercase, tracking-widest
    "label-2xs": "0.5625rem", // 9px

    // Data / Numbers
    "data-xl": "clamp(1.5rem, 4vw, 2.5rem)",
    "data-lg": "1.5rem", // 24px
    "data-md": "1.125rem", // 18px
    "data-sm": "1rem", // 16px
  },

  fontWeight: {
    normal: "400",
    medium: "500",
    bold: "700",
    extrabold: "800",
    black: "900",
  },

  lineHeight: {
    tight: "1.1",
    snug: "1.3",
    normal: "1.5",
    relaxed: "1.6",
  },

  letterSpacing: {
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
    trackingWidest: "0.15em",
  },

  // ─── Spacing ───
  space: {
    // Base unit = 4px
    0: "0",
    1: "0.25rem", // 4px
    2: "0.5rem", // 8px
    3: "0.75rem", // 12px
    4: "1rem", // 16px
    5: "1.25rem", // 20px
    6: "1.5rem", // 24px
    7: "1.75rem", // 28px
    8: "2rem", // 32px
    10: "2.5rem", // 40px
    12: "3rem", // 48px
    16: "4rem", // 64px

    // Semantic
    shellGap: "var(--shell-gap)", // 1.25rem (20px)
    shellPad: "var(--shell-pad)", // 1.5rem (24px)
    cardPad: "1.5rem", // 24px
    cardGap: "1rem", // 16px
    sectionGap: "clamp(1rem, 3vh, 2rem)",
  },

  // ─── Border Radius ───
  radius: {
    sm: "var(--radius-sm)", // 0.5rem (8px)
    md: "var(--radius-md)", // 0.75rem (12px)
    lg: "var(--radius-lg)", // 1rem (16px)
    xl: "1rem", // 16px
    "2xl": "var(--radius-2xl)", // 1.75rem (28px)
    premium: "var(--radius-premium)", // 1.25rem (20px)
    full: "9999px",
  },

  // ─── Shadows ───
  shadow: {
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    soft: "var(--shadow-soft)", // 0 10px 30px -10px rgba(0,0,0,0.02)
    premium: "var(--shadow-premium)", // 0 25px 50px -12px rgba(166,139,92,0.1)
    accent: "var(--shadow-accent)", // if defined
    inner: "inset 0 1px 0 rgba(255,255,255,0.3)",
    innerDark: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },

  // ─── Transitions ───
  transition: {
    fast: "150ms ease",
    base: "var(--duration-base)", // 300ms
    slow: "400ms ease",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  },

  // ─── Z-Index ───
  zIndex: {
    dropdown: "100",
    sticky: "200",
    modal: "500",
    popover: "600",
    tooltip: "700",
    toast: "800",
  },

  // ─── Breakpoints (match Tailwind) ───
  breakpoint: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  // ─── Layout ───
  layout: {
    maxWidth: "min(100%, 120rem)", // 1920px max
    contentMax: "min(100%, 80rem)", // 1280px for content
    sidebarWidth: "min(88vw, 24rem)", // 384px max
    headerHeight: "clamp(3.5rem, 6dvh, 5rem)",
  },

  // ─── Component-Specific Tokens ───
  component: {
    productCard: {
      gap: "1.5rem", // 24px between sections
      imageSize: "3rem", // 48px for category icon
      statusBarHeight: "0.5rem", // 8px smart status bar
      hoverLift: "-4px",
      hoverScale: "1.01",
    },
    statCard: {
      iconSize: "2.5rem", // 40px
      iconWrapper: "2.5rem", // 40px
      valueSize: "clamp(1.5rem, 4vw, 2.5rem)",
    },
    modal: {
      maxWidth: "max-w-3xl", // ~48rem / 768px
      borderRadius: "var(--radius-2xl)", // 1.75rem (28px)
      headerPad: "2rem", // 32px
      bodyPad: "2rem",
      footerPad: "2rem",
    },
    input: {
      height: "3rem", // 48px (h-12)
      borderRadius: "var(--radius-lg)", // 1rem (16px)
      fontSize: "0.875rem", // 14px
      paddingX: "1rem", // 16px
    },
    button: {
      height: "3rem", // 48px (h-12)
      heightSm: "2.25rem", // 36px (h-9)
      heightLg: "3.5rem", // 56px (h-14)
      borderRadius: "var(--radius-lg)", // 1rem (16px)
      fontSize: "0.8125rem", // 13px
      fontWeight: "900",
      letterSpacing: "0.05em",
    },
    badge: {
      height: "1.5rem", // 24px (h-6)
      heightSm: "1.25rem", // 20px (h-5)
      fontSize: "0.5625rem", // 9px
      fontWeight: "900",
      letterSpacing: "0.1em",
      borderRadius: "9999px",
    },
    table: {
      headerHeight: "2.5rem", // 40px (h-10)
      rowHeight: "3rem", // 48px
      fontSize: "0.75rem", // 12px
      headerFontSize: "0.625rem", // 10px
    },
  },

  // ─── Motion / Animation ───
  motion: {
    fadeUp: {
      keyframes: `
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `,
      duration: "0.55s",
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
    staggerDelay: "0.05s",
    reducedMotion: "0.01ms",
  },
};

// ─── Helper Functions ───

/**
 * Get status token set for a product based on quantity vs threshold
 */
export function getProductStatusToken(product) {
  const qty = Number(product?.quantity || 0);
  const threshold = Number(product?.min_quantity_alert || 0);
  const isArchived = product?.is_archived;

  if (isArchived) return inventoryTokens.color.status.archived;
  if (qty <= 0) return inventoryTokens.color.status.critical;
  if (qty <= threshold) return inventoryTokens.color.status.warning;
  return inventoryTokens.color.status.stable;
}

/**
 * Get status label in Arabic
 */
export function getProductStatusLabel(product) {
  const qty = Number(product?.quantity || 0);
  const threshold = Number(product?.min_quantity_alert || 0);
  const isArchived = product?.is_archived;

  if (isArchived) return "مؤرشف";
  if (qty <= 0) return "منتهٍ";
  if (qty <= threshold) return "منخفض";
  return "مستقر";
}

/**
 * Get category tone (icon + colors) - matches existing logic in Inventory.jsx
 */
export function getCategoryTone(category) {
  const normalized = String(category || "").toLowerCase();
  const isOil =
    normalized.includes("زيت") ||
    normalized.includes("serum") ||
    normalized.includes("سيروم");

  if (isOil) {
    return {
      icon: "Droplets",
      badge: "زيوت وسوائل",
      bg: "var(--info-soft)",
      text: "var(--info)",
      border: "var(--info)",
    };
  }
  return {
    icon: "Box",
    badge: "مستلزمات وتشغيل",
    bg: "var(--primary-soft)",
    text: "var(--primary)",
    border: "var(--primary)",
  };
}

// ─── CSS Variable Definitions for Inline Styles (when Tailwind can't be used) ───
export const cssVars = {
  // Color
  "--inv-brand": "var(--primary)",
  "--inv-brand-strong": "var(--primary-strong)",
  "--inv-brand-soft": "var(--primary-soft)",
  "--inv-brand-glow": "var(--accent-glow)",

  // Status
  "--inv-stable": "var(--success)",
  "--inv-stable-soft": "var(--success-soft)",
  "--inv-warning": "var(--warning)",
  "--inv-warning-soft": "var(--warning-soft)",
  "--inv-critical": "var(--danger)",
  "--inv-critical-soft": "var(--danger-soft)",
  "--inv-archived": "var(--muted)",
  "--inv-archived-soft": "var(--muted-soft)",

  // Surface
  "--inv-surface": "var(--bg-card)",
  "--inv-surface-soft": "var(--bg-soft)",
  "--inv-border": "var(--border)",

  // Text
  "--inv-text": "var(--text-main)",
  "--inv-text-muted": "var(--text-muted)",
  "--inv-text-soft": "var(--text-soft)",

  // Radius
  "--inv-radius-sm": "var(--radius-sm)",
  "--inv-radius-md": "var(--radius-md)",
  "--inv-radius-lg": "var(--radius-lg)",
  "--inv-radius-xl": "1rem",
  "--inv-radius-2xl": "var(--radius-2xl)",
  "--inv-radius-premium": "var(--radius-premium)",

  // Shadow
  "--inv-shadow-soft": "var(--shadow-soft)",
  "--inv-shadow-premium": "var(--shadow-premium)",

  // Transition
  "--inv-transition-fast": "150ms ease",
  "--inv-transition-base": "var(--duration-base)",
  "--inv-transition-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

export default inventoryTokens;

// ─── Re-export utility functions and constants from the original Inventory.jsx ───
// These are kept here for backward compatibility and single-source imports

export const UNIT_OPTIONS = [
  {
    value: "g",
    aliases: ["g", "gram", "grams", "جرام", "جم"],
    label: "جرام",
    shortLabel: "جم",
    sizeLabel: "وزن العبوة",
    sizeUnitLabel: "جرام/عبوة",
    quantityLabel: "الكمية",
    thresholdLabel: "حد الإنذار",
    costLabel: "تكلفة الجرام",
  },
  {
    value: "ml",
    aliases: ["ml", "mL", "milliliter", "millilitre", "مل", "مللي", "مللي لتر"],
    label: "مللي لتر",
    shortLabel: "مل",
    sizeLabel: "سعة العبوة",
    sizeUnitLabel: "مل/عبوة",
    quantityLabel: "الكمية",
    thresholdLabel: "حد الإنذار",
    costLabel: "تكلفة المللي لتر",
  },
  {
    value: "piece",
    aliases: ["piece", "pieces", "pcs", "pc", "قطعة"],
    label: "قطعة",
    shortLabel: "قطعة",
    sizeLabel: "عدد القطع في العبوة",
    sizeUnitLabel: "قطعة/عبوة",
    quantityLabel: "الكمية",
    thresholdLabel: "حد الإنذار",
    costLabel: "تكلفة القطعة",
  },
];

export const DEFAULT_FORM = {
  name: "",
  sku: "",
  company_name: "",
  description: "",
  sell_price: "",
  cost_price: "",
  weight: "",
  min_quantity_alert: 5,
  category: "زيوت",
  unit: "g",
};

export const DEFAULT_STOCK_FORM = {
  amount: "",
  note: "",
  create_expense: true,
  purchase_price: "",
  invoice_image_url: "",
};

export function normalizeUnit(value) {
  const raw = String(value || "g")
    .trim()
    .toLowerCase();
  const match = UNIT_OPTIONS.find((option) =>
    option.aliases.some((alias) => alias.toLowerCase() === raw),
  );
  return match?.value || raw || "g";
}

export function getUnitMeta(value) {
  const normalized = normalizeUnit(value);
  return (
    UNIT_OPTIONS.find((option) => option.value === normalized) || {
      value: normalized,
      label: value || "وحدة",
      shortLabel: value || "وحدة",
      sizeLabel: "سعة العبوة",
      sizeUnitLabel: `${value || "وحدة"}/عبوة`,
      quantityLabel: "الكمية",
      thresholdLabel: "حد الإنذار",
      costLabel: `تكلفة ${value || "الوحدة"}`,
    }
  );
}

export function formatQuantity(value, unit, maximumFractionDigits = 1) {
  const unitMeta = getUnitMeta(unit);
  return `${formatNumber(value, maximumFractionDigits)} ${unitMeta.shortLabel}`;
}

export function getAvailablePacks(product) {
  const quantity = Number(product?.quantity || 0);
  const weight = Number(product?.weight || 0);
  if (weight > 0) return quantity / weight;
  return 0;
}

export function getEstimatedUnitCost(product) {
  const costPrice = Number(product?.cost_price || 0);
  const weight = Number(product?.weight || 0);

  if (weight > 0) return costPrice / weight;
  return costPrice > 0 ? costPrice : 0;
}

export function formatNumber(value, maximumFractionDigits = 2) {
  const num = Number(value || 0);
  return num.toLocaleString("ar-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}
