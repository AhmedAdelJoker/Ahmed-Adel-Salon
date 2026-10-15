/**
 * theme.ts — the single palette source for every public page.
 *
 * ## Why this file exists
 *
 * Three separate palette objects used to coexist:
 *
 *  - `lib/theme.ts` (canonical, but imported by almost nothing)
 *  - `pages/LandingPage.tsx` — a byte-identical copy that omitted `isDark`
 *  - `pages/PublicBooking.tsx` — a *different shape* (`primary`/`secondary`/
 *    `dark`), where `gold.primary` was `#D4AF37` while `theme.gold.accent` was
 *    `#B08D26` — inverted
 *
 * Plus a fourth accent living in `ui/button.tsx` (cyan `#22D3EE`), a fifth
 * (`#8a5a25`) in the same file, and a sixth (`#6D28D9`) in `ui/badge.tsx`. One
 * button component could render gold, bronze or cyan depending on the OS.
 *
 * This module now owns every colour. Palettes are plain objects, and
 * `applyThemeMode()` writes them onto `<html>` as `--c-*` custom properties.
 * Components then reference Tailwind utilities (`bg-panel`, `text-accent`,
 * `border-line`) that resolve to those properties, so **no component hardcodes
 * a hex**. Changing a salon's palette is one function call.
 *
 * ## Why the colours changed
 *
 * The old direction was metallic gold (#D4AF37) on near-black. Beyond being
 * the house style of generated landing pages, gold has a specific problem
 * here: it was applied to buttons, badges, borders, focus rings, shadow halos,
 * blob fills and text alike. Used that widely an accent conveys nothing.
 *
 * The replacement is a *signal* palette — a quiet warm-neutral or ink ground
 * with exactly one saturated colour reserved for actions, prices and current
 * state. That is the 2026 "earthy base, one loud accent" pattern, and it holds
 * together across the five palettes below.
 *
 * The three original keys are kept as valid identifiers. They are stored in the
 * database against existing salons, so renaming them would silently reset
 * every current tenant to the default. `gold` in particular no longer means
 * gold — the key is a legacy id, and the label shown to owners lives in the
 * admin app, not here.
 */

/**
 * A brand identity: one accent colour, rendered on a dark or a light ground.
 *
 * The visitor's appearance preference picks the ground, never the brand, so a
 * salon configured for coral keeps coral when the visitor flips appearance.
 */
export type BrandName = "ember" | "verdant" | "azure";

export interface BrandTheme {
  /** Page background. */
  bg: string;
  /** Slightly raised ground: headers, sidebars. */
  surface: string;
  /** Card / panel background. */
  card: string;
  /** Recessed well: summary panels, slot pickers. */
  inset: string;
  /** Hairline. */
  border: string;
  /** Emphasised hairline, and control borders at rest. */
  borderStrong: string;
  /** Translucent panel over photography: gallery captions, the mobile CTA. */
  glass: string;
  /** The same, heavier, where the panel sits over a busy image. */
  glassStrong: string;
  /** Tint of `muted`, for surfaces that need to read as a step below `card`. */
  mutedWash: string;
  /** Primary text. */
  text: string;
  /** Secondary text. */
  muted: string;
  /** Tertiary text, captions. */
  faint: string;
  /** Text on top of `text`. */
  onText: string;
  /** The signal colour. Actions, prices, current state. */
  accent: string;
  /** Accent hover / bright variant. */
  accent2: string;
  /** Translucent accent wash for backgrounds. */
  accentWash: string;
  /** Translucent accent border. */
  accentLine: string;
  /** Text on top of `accent`. */
  onAccent: string;
  /** "Open now" / success. */
  ok: string;
  okWash: string;
  /**
   * Border for a success surface.
   *
   * A 1px border on `okWash` alone is invisible against most grounds, which
   * makes an "open now" pill read as a faint smudge. This is `ok` at low
   * alpha so it tracks the accent rather than being a fixed grey.
   */
  okLine: string;
  /** "Closed" / destructive. */
  stop: string;
  stopWash: string;
  /** The destructive counterpart of `okLine`. */
  stopLine: string;
  /**
   * Which brand identity this palette belongs to.
   *
   * The visitor's appearance preference picks the *ground* within the brand,
   * never a different brand — so a salon configured for coral keeps coral when
   * the visitor switches appearance.
   */
  brand: BrandName;
  /**
   * Whether this palette is a dark one.
   *
   * Not cosmetic: the shared `ui/` primitives carry `dark:` variants, and
   * Tailwind resolves `dark:` from the *operating system* preference. A public
   * site's palette is chosen by the salon owner and can be light while the
   * visitor's OS is dark, and vice versa. Left alone, a light-OS visitor on a
   * dark theme gets `bg-white` panels holding `text-white` — an unreadable
   * card — and a dark-OS visitor on a light theme gets the reverse.
   *
   * `applyThemeMode` mirrors this onto `<html class="dark">` so every `dark:`
   * utility follows the salon, not the operating system.
   */
  isDark: boolean;
}

/**
 * Custom property names, in the order `applyThemeMode` writes them.
 * Kept as a literal tuple so a typo is a compile error rather than a token
 * that silently never resolves.
 */
const CSS_VARS = [
  ["--c-bg", "bg"],
  ["--c-surface", "surface"],
  ["--c-card", "card"],
  ["--c-inset", "inset"],
  ["--c-border", "border"],
  ["--c-border-strong", "borderStrong"],
  ["--c-text", "text"],
  ["--c-muted", "muted"],
  ["--c-faint", "faint"],
  ["--c-on-text", "onText"],
  ["--c-accent", "accent"],
  ["--c-accent-2", "accent2"],
  ["--c-accent-wash", "accentWash"],
  ["--c-accent-line", "accentLine"],
  ["--c-on-accent", "onAccent"],
  ["--c-ok", "ok"],
  ["--c-ok-wash", "okWash"],
  ["--c-ok-line", "okLine"],
  ["--c-stop", "stop"],
  ["--c-stop-wash", "stopWash"],
  ["--c-stop-line", "stopLine"],
  ["--c-glass", "glass"],
  ["--c-glass-strong", "glassStrong"],
  ["--c-muted-wash", "mutedWash"],
] as const satisfies ReadonlyArray<readonly [string, keyof BrandTheme]>;

/**
 * The palettes.
 *
 * Organised as three *brand identities*, each with a dark and a light ground:
 *
 *   | brand   | dark        | light       | accent          |
 *   |---------|-------------|-------------|-----------------|
 *   | ember   | `midnight`  | `gold`      | coral / vermilion|
 *   | verdant | `moss`      | `clay`      | lime / teal     |
 *   | azure   | `graphite`  | `silver`    | cobalt          |
 *
 * The pairing matters. A brand colour has to stay recognisable when the
 * visitor flips appearance, so flipping light/dark changes the *ground* and
 * re-tunes the accent for contrast — it does not swap in a different brand.
 * That is why `midnight` (coral) and `gold` (vermilion) are the same identity
 * at two lightness levels rather than two unrelated themes.
 *
 * `midnight`, `gold` and `silver` are the original keys and are stored in the
 * database against existing salons, so they keep working. `gold` in particular
 * no longer means gold: the key is a legacy id, and the label the owner picks
 * from lives in the admin app, not here.
 */
/**
 * A palette as authored: every colour a designer picks.
 *
 * The derived fields (`okLine`, `glass`, …) are added by `complete()` below.
 * Keeping the authored shape separate is what lets the six palettes stay a
 * literal table of intentional values instead of six blocks of arithmetic.
 */
export type PaletteBase = Omit<
  BrandTheme,
  "okLine" | "stopLine" | "mutedWash" | "glass" | "glassStrong"
>;

export const BRAND_THEMES = {
  /** ember — dark. Blue-black rather than pure #000, so the warm accent has
   *  something to sit against instead of vibrating. */
  midnight: {
    bg: "#080B11",
    surface: "#0E131B",
    card: "#131A24",
    inset: "#0A0E15",
    border: "rgba(233,240,250,0.1)",
    borderStrong: "rgba(233,240,250,0.2)",
    text: "#EDF1F7",
    muted: "#8895A6",
    faint: "#5B6674",
    onText: "#080B11",
    accent: "#FF5A36",
    accent2: "#FFA07A",
    accentWash: "rgba(255,90,54,0.12)",
    accentLine: "rgba(255,90,54,0.34)",
    onAccent: "#140502",
    ok: "#4ADE80",
    okWash: "rgba(74,222,128,0.12)",
    stop: "#FB7185",
    stopWash: "rgba(251,113,133,0.12)",
    brand: "ember",
    isDark: true,
  },

  /** ember — light. Warm bone, so the grain reads as paper rather than screen. */
  gold: {
    bg: "#F3EFE6",
    surface: "#FAF7F1",
    card: "#FFFDF8",
    inset: "#EDE8DD",
    border: "rgba(25,20,16,0.11)",
    borderStrong: "rgba(25,20,16,0.2)",
    text: "#191410",
    muted: "#6D6357",
    faint: "#9C9184",
    onText: "#FFFDF8",
    accent: "#D93B18",
    accent2: "#F2623C",
    accentWash: "rgba(217,59,24,0.1)",
    accentLine: "rgba(217,59,24,0.3)",
    onAccent: "#FFF8F5",
    ok: "#15803D",
    okWash: "rgba(21,128,61,0.1)",
    stop: "#BE123C",
    stopWash: "rgba(190,18,60,0.1)",
    brand: "ember",
    isDark: false,
  },

  /** verdant — dark. The "dopamine" option: lime on near-black is the highest
   *  chroma pairing available, and deliberately the opposite register to
   *  `gold`. */
  moss: {
    bg: "#0A100C",
    surface: "#0F1712",
    card: "#131D16",
    inset: "#070C09",
    border: "rgba(226,244,232,0.1)",
    borderStrong: "rgba(226,244,232,0.2)",
    text: "#E9F3EB",
    muted: "#85988A",
    faint: "#586A5C",
    onText: "#0A100C",
    accent: "#A9E82E",
    accent2: "#D4F76A",
    accentWash: "rgba(169,232,46,0.13)",
    accentLine: "rgba(169,232,46,0.32)",
    onAccent: "#12180A",
    ok: "#4ADE80",
    okWash: "rgba(74,222,128,0.12)",
    stop: "#FB7185",
    stopWash: "rgba(251,113,133,0.12)",
    brand: "verdant",
    isDark: true,
  },

  /** verdant — light. Warm clay ground against a cool teal signal: the two
   *  temperatures are what keep it from reading sweet. */
  clay: {
    bg: "#F6EBE1",
    surface: "#FCF6EF",
    card: "#FFFBF6",
    inset: "#EFE1D4",
    border: "rgba(46,28,18,0.11)",
    borderStrong: "rgba(46,28,18,0.2)",
    text: "#241811",
    muted: "#7B6455",
    faint: "#A8907F",
    onText: "#FFFBF6",
    accent: "#0E7268",
    accent2: "#14A08F",
    accentWash: "rgba(14,114,104,0.09)",
    accentLine: "rgba(14,114,104,0.28)",
    onAccent: "#FFFFFF",
    ok: "#4D7C0F",
    okWash: "rgba(77,124,15,0.1)",
    stop: "#B91C1C",
    stopWash: "rgba(185,28,28,0.1)",
    brand: "verdant",
    isDark: false,
  },

  /** azure — dark. Cool slate, for a clinical or coastal register. */
  graphite: {
    bg: "#0A1017",
    surface: "#101823",
    card: "#151F2C",
    inset: "#070C12",
    border: "rgba(226,236,248,0.1)",
    borderStrong: "rgba(226,236,248,0.2)",
    text: "#E8EFF7",
    muted: "#8494A6",
    faint: "#566577",
    onText: "#0A1017",
    accent: "#4C9EF5",
    accent2: "#8CC3FA",
    accentWash: "rgba(76,158,245,0.13)",
    accentLine: "rgba(76,158,245,0.34)",
    onAccent: "#040D18",
    ok: "#34D399",
    okWash: "rgba(52,211,153,0.12)",
    stop: "#F87171",
    stopWash: "rgba(248,113,113,0.12)",
    brand: "azure",
    isDark: true,
  },

  /** azure — light. Legacy key. */
  silver: {
    bg: "#EDF1F6",
    surface: "#F7F9FC",
    card: "#FFFFFF",
    inset: "#E4EAF2",
    border: "rgba(13,26,43,0.11)",
    borderStrong: "rgba(13,26,43,0.2)",
    text: "#0C1626",
    muted: "#5A6878",
    faint: "#8B98A8",
    onText: "#FFFFFF",
    accent: "#0B5CC4",
    accent2: "#2E86E0",
    accentWash: "rgba(11,92,196,0.09)",
    accentLine: "rgba(11,92,196,0.28)",
    onAccent: "#FFFFFF",
    ok: "#0F766E",
    okWash: "rgba(15,118,110,0.1)",
    stop: "#B91C1C",
    stopWash: "rgba(185,28,28,0.1)",
    brand: "azure",
    isDark: false,
  },
} as const satisfies Record<string, PaletteBase>;

/**
 * Fill in the derived fields from the ones each palette states.
 *
 * `okLine`, `stopLine`, `mutedWash` and the two glass values are all functions
 * of colours the palettes already declare. Writing them out six times would be
 * six chances for a dark palette to end up with a light-mode border, and the
 * failure is invisible until someone flips appearance.
 *
 * `asHex` extracts the channels from `#RGB`, `#RRGGBB` or `#RRGGBBAA`; a value
 * that is already an `rgb()`/`rgba()` function is passed through untouched,
 * which is why the rgba borders survive unchanged.
 */
function asHex(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return null;
  let body = hex[1];
  if (body.length === 3) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [
    parseInt(body.slice(0, 2), 16),
    parseInt(body.slice(2, 4), 16),
    parseInt(body.slice(4, 6), 16),
  ];
}

function withAlpha(color: string, alpha: number): string {
  const rgb = asHex(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

type PaletteBaseInternal = PaletteBase;

function complete(palette: PaletteBaseInternal): BrandTheme {
  return {
    ...palette,
    okLine: withAlpha(palette.ok, 0.34),
    stopLine: withAlpha(palette.stop, 0.34),
    // A step below `card` without a new declaration: the muted ink at low
    // alpha over the card ground.
    mutedWash: withAlpha(palette.muted, 0.12),
    // Panels that sit over photography need to be dark enough to carry light
    // text regardless of the palette, so they are built from the page ground
    // rather than from the card — a light palette's card would be unusable
    // over a photograph.
    glass: withAlpha(palette.bg, 0.78),
    glassStrong: withAlpha(palette.bg, 0.95),
  };
}

export const THEME_PALETTES = Object.fromEntries(
  Object.entries(BRAND_THEMES).map(([name, palette]) => [name, complete(palette as PaletteBase)]),
) as Record<keyof typeof BRAND_THEMES, BrandTheme>;

/** A brand identity, and the two grounds it can be rendered on. */
const BRAND_GROUNDS = {
  ember: { dark: "midnight", light: "gold" },
  verdant: { dark: "moss", light: "clay" },
  azure: { dark: "graphite", light: "silver" },
} as const satisfies Record<string, { dark: BrandThemeName; light: BrandThemeName }>;

export type BrandThemeName = keyof typeof BRAND_THEMES;

export const DEFAULT_THEME_NAME: BrandThemeName = "midnight";

/** Every selectable palette, in the order the admin app should list them. */
export const THEME_NAMES = Object.keys(BRAND_THEMES) as BrandThemeName[];

export function isBrandThemeName(value: unknown): value is BrandThemeName {
  return typeof value === "string" && value in BRAND_THEMES;
}

/** `light` / `dark`, or `system` for "whatever the salon chose". */
export type Appearance = "light" | "dark" | "system";

export function resolveConfiguredTheme(
  settings?: Record<string, unknown> | null,
): BrandTheme {
  const candidate = settings?.landingThemeId ?? settings?.landing_theme_id;
  return isBrandThemeName(candidate)
    ? THEME_PALETTES[candidate]
    : THEME_PALETTES[DEFAULT_THEME_NAME];
}

/**
 * Resolve the palette, honouring a visitor appearance preference.
 *
 * `system` (and anything unrecognised) means "use the salon's own choice",
 * which is what a visitor who has expressed no preference should get.
 *
 * An explicit preference moves the palette to the other ground *within the same
 * brand*. It cannot change the brand: swapping in an unrelated palette would
 * change the salon's accent colour behind the owner's back, and the accent is
 * the thing the owner actually chose.
 */
export function resolveTheme(
  settings?: Record<string, unknown> | null,
  appearance: Appearance = "system",
): BrandTheme {
  const configured = resolveConfiguredTheme(settings);
  if (appearance === "system") return configured;

  const wantDark = appearance === "dark";
  if (configured.isDark === wantDark) return configured;

  const grounds = BRAND_GROUNDS[configured.brand];
  return THEME_PALETTES[wantDark ? grounds.dark : grounds.light];
}

/**
 * Paint the palette onto <html> and point Tailwind's `dark:` variant at it.
 *
 * Writing the custom properties is what makes the palette reach the CSS at
 * all: `index.css` declares `@theme inline` entries that resolve to these
 * variables, so `bg-panel` compiles to `background-color: var(--c-card)` and
 * every utility follows the palette without a single hardcoded value.
 *
 * Called from every page that resolves a theme, and from the prerenderer,
 * because the variables have to be on <html> before first paint — setting them
 * in an effect means a light-theme salon flashes dark panels first.
 */
export function applyThemeMode(
  theme: BrandTheme,
  root: HTMLElement | null = typeof document !== "undefined"
    ? document.documentElement
    : null,
): void {
  if (!root) return;

  for (const [cssVar, key] of CSS_VARS) {
    root.style.setProperty(cssVar, theme[key]);
  }

  root.classList.toggle("dark", theme.isDark);
  root.style.colorScheme = theme.isDark ? "dark" : "light";
}
