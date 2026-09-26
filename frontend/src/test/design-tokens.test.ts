import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..");
const STYLES = join(SRC, "styles", "index.css");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const css = readFileSync(STYLES, "utf8");
const sourceFiles = walk(SRC);

/** Custom properties declared in the :root / .dark blocks. */
const definedTokens = new Set(
  [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]),
);

/**
 * Tokens that are not ours to define: Radix injects these at runtime, and the
 * inventory feature declares its own `--inv-*` names in a generated
 * style element rather than in index.css.
 */
const EXTERNAL = /^--(radix-|inv-)/;

/** Strips block, whole-line and trailing comments so prose is not scanned. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    // Trailing comments, skipping anything that looks like a URL scheme.
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
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
  "lib/export/utils.ts", // builds HTML/PDF strings outside the DOM
  "features/pos/utils.ts", // canvas confetti particle colours
]);

describe("design tokens", () => {
  it("declares the tokens the Tailwind config and feature code expect", () => {
    const expected = [
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
      "--border",
      "--border-strong",
      "--shadow-accent",
      "--chart-1",
      "--chart-8",
      "--font-mono",
    ];
    const missing = expected.filter((token) => !definedTokens.has(token));
    expect(missing).toEqual([]);
  });

  it("defines a light and a dark value for every chart series token", () => {
    for (let i = 1; i <= 8; i += 1) {
      const occurrences = [...css.matchAll(new RegExp(`--chart-${i}\\s*:`, "g"))]
        .length;
      expect(occurrences, `--chart-${i} must be set in both modes`).toBe(2);
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
      for (const match of code.matchAll(/var\((--[a-z0-9-]+)/g)) {
        const token = match[1];
        if (EXTERNAL.test(token)) continue;
        if (!definedTokens.has(token)) {
          offenders.push(`${rel}: ${token}`);
        }
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
      if (LITERAL_COLOR_ALLOWLIST.has(rel)) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      for (const match of code.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
        offenders.push(`${rel}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
