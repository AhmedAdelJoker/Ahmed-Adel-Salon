import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Locale integrity.
 *
 * The app is bilingual, and a missing translation key fails quietly in the way
 * that is worst for a product: i18next returns the key itself, or falls back to
 * the default locale, and the English UI quietly ships with a line of Arabic in
 * it. Nothing crashes, typecheck passes, and the defect reaches production.
 *
 * These assertions make that failure loud.
 */

const LOCALES = join(__dirname, "..", "i18n", "locales");

type Tree = { [key: string]: string | Tree };

function readLocale(language: string): Record<string, Tree> {
  const dir = join(LOCALES, language);
  const out: Record<string, Tree> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    out[file.replace(/\.json$/, "")] = JSON.parse(
      readFileSync(join(dir, file), "utf8"),
    ) as Tree;
  }
  return out;
}

/** Flattens a nested object to dotted paths, which is how i18next addresses it. */
function flatten(tree: Tree, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") keys.push(path);
    else keys.push(...flatten(value, path));
  }
  return keys;
}

function lookup(tree: Tree, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node && typeof node === "object") {
      return (node as Tree)[key];
    }
    return undefined;
  }, tree);
}

const languages = readdirSync(LOCALES).filter((entry) =>
  /^[a-z]{2}(-[A-Za-z]+)?$/.test(entry),
);

describe("i18n", () => {
  it("ships at least Arabic and English", () => {
    expect(languages.sort()).toEqual(["ar", "en"]);
  });

  it("has identical key sets in every locale", () => {
    // The failure this prevents: a key added to `ar` and forgotten in `en`
    // renders the Arabic string inside the English interface.
    const reference = "ar";
    const referenceKeys = new Set(
      Object.entries(readLocale(reference)).flatMap(([ns, tree]) =>
        flatten(tree).map((key) => `${ns}:${key}`),
      ),
    );

    const drift: string[] = [];
    for (const language of languages) {
      if (language === reference) continue;
      const keys = new Set(
        Object.entries(readLocale(language)).flatMap(([ns, tree]) =>
          flatten(tree).map((key) => `${ns}:${key}`),
        ),
      );
      for (const key of referenceKeys) {
        if (!keys.has(key)) drift.push(`${key} missing from ${language}`);
      }
      for (const key of keys) {
        if (!referenceKeys.has(key)) drift.push(`${key} not in ${reference}`);
      }
    }

    expect(drift).toEqual([]);
  });

  it("has no empty or whitespace-only values", () => {
    // i18next renders an empty string as a silently missing label, which reads
    // as a spacing bug rather than a translation bug.
    const empties: string[] = [];
    for (const language of languages) {
      for (const [ns, tree] of Object.entries(readLocale(language))) {
        for (const path of flatten(tree)) {
          const value = lookup(tree, path);
          if (typeof value !== "string" || value.trim() === "") {
            empties.push(`${language}/${ns}:${path}`);
          }
        }
      }
    }
    expect(empties).toEqual([]);
  });

  it("keeps interpolation placeholders consistent across locales", () => {
    // `{{name}}` present in one locale and missing in the other leaves the
    // placeholder visible in the rendered UI, e.g. "Welcome, {{user}}".
    const PLACEHOLDER = /\{\{\s*[\w.]+\s*\}\}/g;
    const drift: string[] = [];

    const byLocale = new Map(
      languages.map((language) => [language, readLocale(language)] as const),
    );
    const reference = byLocale.get("ar")!;

    for (const [ns, tree] of Object.entries(reference)) {
      for (const path of flatten(tree)) {
        const base = String(lookup(tree, path) ?? "").match(PLACEHOLDER)?.sort() ?? [];
        for (const [language, locale] of byLocale) {
          if (language === "ar") continue;
          const other = lookup(locale[ns] ?? {}, path);
          if (typeof other !== "string") continue;
          const theirs = other.match(PLACEHOLDER)?.sort() ?? [];
          if (JSON.stringify(base) !== JSON.stringify(theirs)) {
            drift.push(`${language}/${ns}:${path} → ${theirs.join(",")} vs ${base.join(",")}`);
          }
        }
      }
    }

    expect(drift).toEqual([]);
  });

  it("registers every namespace file in the i18n entry point", () => {
    // A namespace file that exists but is not registered loads as an empty
    // resource bundle, and every lookup silently falls through to the default.
    const entry = readFileSync(join(__dirname, "..", "i18n", "index.ts"), "utf8");
    const registered = new Set(
      [...entry.matchAll(/(\w+):\s*\w+(?:Common|Appearance)\b/g)].map((m) => m[1]),
    );
    const unregistered = [...new Set(Object.keys(readLocale("ar")))].filter(
      (ns) => !registered.has(ns),
    );
    expect(unregistered).toEqual([]);
  });

  it("does not leave Arabic inside the English locale", () => {
    // A copy-paste from the Arabic file is the single most common way a
    // bilingual app leaks its source language into the target one.
    const ARABIC = /[؀-ۿ]/;
    const leaks: string[] = [];

    for (const [ns, tree] of Object.entries(readLocale("en"))) {
      for (const path of flatten(tree)) {
        const value = String(lookup(tree, path) ?? "");
        if (ARABIC.test(value)) leaks.push(`en/${ns}:${path} → "${value}"`);
      }
    }

    expect(leaks).toEqual([]);
  });

  it("does not leave English inside the Arabic locale", () => {
    // The reverse leak, with one exception: a few loanwords are conventional in
    // Arabic UI and would read as errors if translated.
    const ALLOWED = /\b(?:SMTP|API|URL|ID|SSL|POS|QR|CSV|PDF|Excel|Web|Email|PIN|VAT)\b/;
    const leaks: string[] = [];

    for (const [ns, tree] of Object.entries(readLocale("ar"))) {
      for (const path of flatten(tree)) {
        const value = String(lookup(tree, path) ?? "");
        const stripped = value.replace(ALLOWED, "");
        if (/[A-Za-z]{3,}/.test(stripped)) leaks.push(`ar/${ns}:${path} → "${value}"`);
      }
    }

    expect(leaks).toEqual([]);
  });
});
