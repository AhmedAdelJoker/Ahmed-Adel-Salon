import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * No hardcoded currency symbol in a component.
 *
 * This is the test that makes the currency setting real. `formatCurrency` can
 * read `business_settings.currency` perfectly and it will change nothing if the
 * prices on screen are literal `ج.م` -- which is the state this file was written
 * in: 41 occurrences of the symbol in components, and a picker in settings that
 * saved a value nobody displayed.
 *
 * The rule is narrow on purpose. A symbol in a sentence ("السعر (ج.م)"), in a
 * filter option whose text is the value ("0 ج.م"), or in the settings picker
 * itself is legitimate, so those are allowed. A symbol standing next to a value
 * the component is rendering is not.
 *
 * Run: npx vitest run src/test/no-hardcoded-currency.test.ts
 */
const SRC = join(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "node_modules" ? [] : walk(full);
    }
    return full.endsWith(".tsx") ? [full] : [];
  });
}

/** The symbol on its own, or immediately beside a value. */
const NEXT_TO_A_VALUE = /(?<!\w)(ج\.م|ر\.س|د\.إ|ر\.ق|د\.ك|د\.أ)\s*\{|\{\s*[^}]+\}\s*(ج\.م|ر\.س|د\.إ|ر\.ق|د\.ك|د\.أ)/;

describe("no hardcoded currency symbols in components", () => {
  const files = walk(SRC);

  it("found the component tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no component renders a symbol beside its own value", () => {
    const offences: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, index) => {
        if (NEXT_TO_A_VALUE.test(line)) {
          offences.push(
            `${file.slice(SRC.length + 1)}:${index + 1}  ${line.trim().slice(0, 90)}`
          );
        }
      });
    }
    expect(offences).toEqual([]);
  });

  it("the currency picker stores codes, not symbols", () => {
    // The picker listed `value="ج.م"` as a fifth option, identical to the EGP
    // entry above it. Choosing it wrote a rendered symbol into
    // business_settings.currency, which no formatter can interpret -- and the
    // column is a String(10), so the database accepted it.
    const settings = readFileSync(join(SRC, "pages/owner/Settings.tsx"), "utf8");
    const values = [...settings.matchAll(/SelectItem\s+value="([^"]*)"/g)].map(
      (m) => m[1]
    );
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toMatch(/^[A-Z]{3}$/);
    }
  });
});
