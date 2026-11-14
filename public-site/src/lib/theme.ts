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
  /** ember — dark. Espresso ground with a copper signal: the evening version
   *  of the ivory page rather than a separate "gaming" identity. */
  midnight: {
    bg: "#12100E",
    surface: "#17130F",
    card: "#1D1813",
    inset: "#0C0A08",
    border: "rgba(245,236,224,0.12)",
    borderStrong: "rgba(245,236,224,0.22)",
    text: "#F3ECE1",
    muted: "#B3A696",
    faint: "#7E7264",
    onText: "#12100E",
    accent: "#D08A5A",
    accent2: "#E9AC7E",
    accentWash: "rgba(208,138,90,0.14)",
    accentLine: "rgba(208,138,90,0.32)",
    onAccent: "#1A0E06",
    ok: "#86B894",
    okWash: "rgba(134,184,148,0.12)",
    stop: "#E28B85",
    stopWash: "rgba(226,139,133,0.12)",
    brand: "ember",
    isDark: true,
  },

  /** ember — light. The flagship: warm ivory paper, espresso ink, one copper
   *  accent reserved for actions and prices. */
  gold: {
    bg: "#F4EFE7",
    surface: "#F9F5EF",
    card: "#FFFCF7",
    inset: "#ECE5D9",
    border: "rgba(42,32,24,0.12)",
    borderStrong: "rgba(42,32,24,0.24)",
    text: "#201811",
    muted: "#6B5E51",
    faint: "#948777",
    onText: "#FFFCF7",
    accent: "#A85A32",
    accent2: "#C07344",
    accentWash: "rgba(168,90,50,0.10)",
    accentLine: "rgba(168,90,50,0.30)",
    onAccent: "#FFF8F2",
    ok: "#3F6B4E",
    okWash: "rgba(63,107,78,0.10)",
    stop: "#9E3A34",
    stopWash: "rgba(158,58,52,0.10)",
    brand: "ember",
    isDark: false,
  },

  /** verdant — dark. Forest ground, sage signal. */
  moss: {
    bg: "#0E1310",
    surface: "#131A16",
    card: "#18211C",
    inset: "#0A0E0C",
    border: "rgba(230,240,232,0.11)",
    borderStrong: "rgba(230,240,232,0.21)",
    text: "#E9F0EA",
    muted: "#A0AFA3",
    faint: "#728074",
    onText: "#0E1310",
    accent: "#A8C49A",
    accent2: "#C7DEBA",
    accentWash: "rgba(168,196,154,0.13)",
    accentLine: "rgba(168,196,154,0.32)",
    onAccent: "#0F150F",
    ok: "#86B894",
    okWash: "rgba(134,184,148,0.12)",
    stop: "#E28B85",
    stopWash: "rgba(226,139,133,0.12)",
    brand: "verdant",
    isDark: true,
  },

  /** verdant — light. Parchment ground with a deep pine signal. */
  clay: {
    bg: "#F2EEE5",
    surface: "#F8F5EE",
    card: "#FEFCF7",
    inset: "#E9E3D7",
    border: "rgba(33,38,30,0.12)",
    borderStrong: "rgba(33,38,30,0.24)",
    text: "#1D241C",
    muted: "#5C685A",
    faint: "#8A948A",
    onText: "#FEFCF7",
    accent: "#2F5D50",
    accent2: "#427C6B",
    accentWash: "rgba(47,93,80,0.10)",
    accentLine: "rgba(47,93,80,0.28)",
    onAccent: "#F7FBF9",
    ok: "#3F6B4E",
    okWash: "rgba(63,107,78,0.10)",
    stop: "#9E3A34",
    stopWash: "rgba(158,58,52,0.10)",
    brand: "verdant",
    isDark: false,
  },

  /** azure — dark. Slate ground, powder-blue signal. */
  graphite: {
    bg: "#0C1117",
    surface: "#111821",
    card: "#16202B",
    inset: "#080D12",
    border: "rgba(230,238,247,0.11)",
    borderStrong: "rgba(230,238,247,0.21)",
    text: "#EAF0F7",
    muted: "#9AA8B7",
    faint: "#6E7D8D",
    onText: "#0C1117",
    accent: "#7FB2E5",
    accent2: "#A6C9EE",
    accentWash: "rgba(127,178,229,0.13)",
    accentLine: "rgba(127,178,229,0.34)",
    onAccent: "#071018",
    ok: "#6FC0A2",
    okWash: "rgba(111,192,162,0.12)",
    stop: "#E28B85",
    stopWash: "rgba(226,139,133,0.12)",
    brand: "azure",
    isDark: true,
  },

  /** azure — light. Porcelain ground with an ink-blue signal. */
  silver: {
    bg: "#F1F3F5",
    surface: "#F7F8FA",
    card: "#FFFFFF",
    inset: "#E7EAEE",
    border: "rgba(20,28,38,0.11)",
    borderStrong: "rgba(20,28,38,0.22)",
    text: "#131A22",
    muted: "#5C6875",
    faint: "#8A96A3",
    onText: "#FFFFFF",
    accent: "#2E5C8A",
    accent2: "#4779A8",
    accentWash: "rgba(46,92,138,0.10)",
    accentLine: "rgba(46,92,138,0.26)",
    onAccent: "#FFFFFF",
    ok: "#2F6B4F",
    okWash: "rgba(47,107,79,0.10)",
    stop: "#9E3A34",
    stopWash: "rgba(158,58,52,0.10)",
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

/**
 * The ivory/copper ground is the house style. A dark ground is a preference a
 * visitor can ask for, not the default a first-time visitor is handed.
 */
export const DEFAULT_THEME_NAME: BrandThemeName = "gold";

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
