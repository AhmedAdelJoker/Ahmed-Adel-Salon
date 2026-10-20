import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..");
const STYLES_DIR = join(SRC, "styles");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Every stylesheet, concatenated.
 *
 * Reading only `index.css` used to be enough because it held every token.
 * It is now a thin aggregator (`@import` + `@theme`), so a single-file read
 * reports every token as undefined. The audit's `--sidebar-*`, `--shadow-neon`
 * and `--bg-elevated` bugs survived precisely because the checker never opened
 * the file those names were declared in.
 */
function readAllStyles(): { name: string; code: string }[] {
  return readdirSync(STYLES_DIR)
    .filter((file) => file.endsWith(".css"))
    .sort()
    .map((file) => ({ name: file, code: readFileSync(join(STYLES_DIR, file), "utf8") }));
}

const styles = readAllStyles();
const css = styles.map((s) => s.code).join("\n");
const sourceFiles = walk(SRC);

/** Custom properties declared anywhere in the token layer. */
const definedTokens = new Set(
  [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]),
);

/**
 * Tokens that are not ours to define:
 *  - Radix injects `--radix-*` at runtime (available height, transform origin)
 *  - the inventory feature declares its own `--inv-*` names in a generated
 *    style element rather than in a stylesheet
 *  - Tailwind injects font defaults and these fall back safely
 */
const EXTERNAL = /^--(radix-|inv-|default-font-)/;

/** Strips block, whole-line and trailing comments so prose is not scanned. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    // Trailing comments, skipping anything that looks like a URL scheme.
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function collectUndefinedVarRefs(code: string, filter?: (ref: string) => boolean) {
  const offenders: string[] = [];
  for (const match of code.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    const token = match[1];
    if (EXTERNAL.test(token)) continue;
    if (definedTokens.has(token)) continue;
    if (filter && !filter(token)) continue;
    offenders.push(token);
  }
  return offenders;
}

/**
 * Colour literals are legitimate in a few places, none of which are the app
 * chrome: the printable shift report, the printable thermal receipt, and the
 * jsPDF/QR writer. Social brand marks are also literal by definition.
 */
const LITERAL_COLOR_ALLOWLIST = new Set([
  "pages/cashier/POS/components/ShiftSidebar.tsx", // print stylesheet
  "lib/print/receipt.ts", // thermal receipt
  "pages/owner/BusinessSettingsPage.tsx", // jsPDF QR colours
  "pages/owner/WebsiteSettingsPanel.tsx", // social brand marks
  "pages/cashier/POS/components/SuccessOverlay.tsx", // canvas confetti
  "components/layout/DynamicBackground.tsx", // decorative gradient
  "components/shared/ThemeSwitcher.tsx", // inline preview swatches
  "components/shared/AppearancePanel.tsx", // accent swatches must show the colour they select
  "lib/export/utils.ts", // builds HTML/PDF strings outside the DOM
  "features/pos/utils.ts", // canvas confetti particle colours
]);

/**
 * Tests are exempt.
 *
 * An assertion that reads its expectation back out of the token layer verifies
 * only that the token equals itself. `expect(themeColor).toBe("#08080a")` is
 * the whole point: it pins the literal so a change to the palette has to be a
 * deliberate edit in two places. Applying the hex ban to tests would make them
 * weaker, not stronger.
 */
function isTestFile(rel: string): boolean {
  return rel.startsWith("test/");
}

describe("design tokens", () => {
  it("ships the v2 token layer as separate stylesheets", () => {
    // Guards the aggregator contract: index.css must stay a thin entry point,
    // and the ramp/semantic/legacy layers must remain individually addressable.
    const names = styles.map((s) => s.name);
    expect(names).toContain("tokens.css");
    expect(names).toContain("base.css");
    expect(names).toContain("index.css");
  });

  it("declares the tokens the Tailwind config and feature code expect", () => {
    const expected = [
      // v1 bridge — still consumed by ~365 unmigrated files
      "--primary",
      "--primary-soft",
      "--primary-foreground",
      "--success",
      "--warning",
      "--danger",
      "--info",
      "--text-main",
      "--text-muted",
      "--bg-card",
      "--bg-soft",
      "--bg-elevated",
      "--border",
      "--border-strong",
      "--shadow-accent",
      "--chart-1",
      "--chart-8",
      "--font-mono",
      // v2 semantic layer
      "--surface-canvas",
      "--surface-raised",
      "--surface-sunken",
      "--surface-overlay",
      "--surface-glass",
      "--content-primary",
      "--content-secondary",
      "--content-tertiary",
      "--content-inverse",
      "--line-subtle",
      "--line-default",
      "--line-strong",
      "--status-success",
      "--status-warning",
      "--status-danger",
      "--status-info",
      "--action-primary",
      "--focus-ring",
      // depth / shape / motion
      "--elevation-1",
      "--elevation-4",
      "--glow-accent",
      "--radius-sm",
      "--radius-pill",
      "--blur-glass",
      "--gradient-accent",
      "--ease-out",
      "--duration-base",
    ];
    const missing = expected.filter((token) => !definedTokens.has(token));
    expect(missing).toEqual([]);
  });

  it("repairs the tokens that were referenced but never declared", () => {
    // Each of these was consumed by a component or by tailwind.config.js while
    // resolving to nothing, so the declaration was silently dropped. The
    // audit listed them as live visual bugs.
    const previouslyUndefined = [
      "--bg-elevated",
      "--text-inverse",
      "--primary-muted",
      "--secondary",
      "--secondary-soft",
      "--secondary-dark",
      "--accent-light",
      "--accent-dark",
      "--sidebar-stroke",
      "--sidebar-surface",
      "--sidebar-surface-strong",
      "--sidebar-glow",
      "--shadow-neon",
    ];
    const missing = previouslyUndefined.filter((token) => !definedTokens.has(token));
    expect(missing).toEqual([]);
  });

  it("defines a light and a dark value for every chart series token", () => {
    for (let i = 1; i <= 8; i += 1) {
      const occurrences = [...css.matchAll(new RegExp(`--chart-${i}\\s*:`, "g"))].length;
      expect(occurrences, `--chart-${i} must be set in both modes`).toBe(2);
    }
  });

  it("declares every accent theme with the same ramp depth", () => {
    const accents = ["indigo", "violet", "cyan", "emerald", "gold"];
    for (const accent of accents) {
      const block = css.slice(css.indexOf(`[data-accent="${accent}"]`));
      if (block === css) {
        throw new Error(`[data-accent="${accent}"] block is missing`);
      }
      // Only the values up to the next top-level selector belong to this block.
      const scoped = block.slice(0, block.search(/\n\[data-accent=|^\s{0,2}\[data-theme=/m));
      for (const step of [50, 100, 300, 500, 700, 900, 950]) {
        expect(
          scoped,
          `[data-accent="${accent}"] is missing --accent-${step}`,
        ).toContain(`--accent-${step}:`);
      }
      expect(scoped, `[data-accent="${accent}"] is missing --accent-hue`).toContain(
        "--accent-hue:",
      );
    }
  });

  it("defines every density step the layout reads", () => {
    for (const step of ["row-y", "cell-y", "cell-x", "control-h", "section-gap", "font-base"]) {
      const name = `--density-${step}`;
      const occurrences = [...css.matchAll(new RegExp(`${name}\\s*:`, "g"))].length;
      // comfortable (default) + compact + spacious
      expect(occurrences, `${name} must cover all three densities`).toBe(3);
    }
  });

  it("never references a custom property that is not defined", () => {
    // Regression guard. `var(--text)` and `var(--muted)` were used for chart
    // axis tick fills; both were undefined, which left the axis labels of the
    // owner reports, financial reports and sales chart invisible.
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      if (rel === "test/design-tokens.test.ts") continue;
      const code = stripComments(readFileSync(file, "utf8"));
      for (const token of collectUndefinedVarRefs(code)) {
        offenders.push(`${rel}: ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never references an undefined custom property from inside a stylesheet", () => {
    // The gap that let `--sidebar-stroke`, `--sidebar-surface-strong`,
    // `--sidebar-surface`, `--sidebar-glow` and `--shadow-neon` ship broken:
    // the previous guard only walked .ts/.tsx, never the CSS that declared
    // them, so ~600 lines of layout silently resolved to no value at all.
    const offenders: string[] = [];
    for (const sheet of styles) {
      const code = stripComments(sheet.code);
      for (const token of new Set(collectUndefinedVarRefs(code))) {
        offenders.push(`${sheet.name}: ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never self-references a custom property in @theme", () => {
    // `@theme` emits each key as a `:root` declaration, so
    // `--radius-sm: var(--radius-sm)` is a cycle that resolves to the
    // invalid value. The pre-v2 index.css shipped exactly this.
    const offenders: string[] = [];
    for (const sheet of styles) {
      // Comments are stripped first: explaining *why* a construct is banned
      // naturally quotes it, and the prose must not trip its own guard.
      const code = stripComments(sheet.code);
      for (const match of code.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(\s*\1\s*\)/gi)) {
        offenders.push(`${sheet.name}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never wraps a full colour value in hsl()/rgb()", () => {
    // `--border` is an rgba() value, so `hsl(var(--border))` is invalid CSS and
    // the declaration is dropped. The payroll tooltip had exactly this.
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      if (rel === "test/design-tokens.test.ts") continue;
      const code = stripComments(readFileSync(file, "utf8"));
      for (const match of code.matchAll(/(hsl|rgb|hwb|lab|lch|oklch)\(\s*var\(--/g)) {
        offenders.push(`${rel}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps raw hex out of the app chrome", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      if (LITERAL_COLOR_ALLOWLIST.has(rel) || isTestFile(rel)) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      for (const match of code.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
        offenders.push(`${rel}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps hex literals inside the token layer, and only there", () => {
    // The one sanctioned home for raw colour values. Anything else has to
    // reference a token, which is what makes a re-theme a one-file change.
    const allowed = new Set(["tokens.css"]);
    const offenders: string[] = [];
    for (const sheet of styles) {
      if (allowed.has(sheet.name)) continue;
      const code = stripComments(sheet.code);
      for (const match of code.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
        offenders.push(`${sheet.name}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
