/**
 * Chart series palette.
 *
 * Recharts takes plain colour strings for `fill`, `stroke` and `stopColor`, and
 * SVG resolves CSS custom properties in all three, so the series can follow the
 * theme instead of being frozen at light-mode hex. `--chart-1..8` are defined
 * for both the light and dark blocks in `src/styles/index.css`.
 *
 * The palette deliberately starts on the brand gold so the first series in any
 * chart reads as the product colour rather than an arbitrary default.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

/** Series colour for a categorical index, wrapping around the palette. */
export function chartColor(index: number): string {
  if (!Number.isFinite(index) || index < 0) return CHART_COLORS[0];
  return CHART_COLORS[Math.floor(index) % CHART_COLORS.length];
}

/**
 * Translucent variant of a series colour.
 *
 * Callers used to build these by appending an alpha suffix to a hex string,
 * which silently produces invalid CSS once the value is a `var()` reference.
 */
export function chartColorAlpha(color: string, percent = 10): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
