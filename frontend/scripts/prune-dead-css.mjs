/**
 * One-off cleanup: strip rules whose selectors reference only classes that no
 * component emits.
 *
 * Safety rules baked in:
 *  - Recharts/Radix render their own class names into the DOM, so those rules
 *    are kept even though nothing in src/ mentions them by name.
 *  - A rule is dropped only when EVERY selector in its selector list is dead.
 *    One live selector keeps the whole rule.
 *  - A rule containing an attribute selector is never dropped: the CSS may be
 *    targeting a `data-*` hook that a component sets at runtime.
 *  - @media / @supports / @layer / @container are walked recursively; a wrapper
 *    whose body becomes empty is dropped too.
 *  - @keyframes / @font-face / @property are always kept.
 *
 * Usage:
 *   node scripts/prune-dead-css.mjs            rewrite legacy.css
 *   node scripts/prune-dead-css.mjs --check    report only, exit 1 if it would prune
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = join(HERE, "..", "src", "styles", "legacy.css");
const CHECK_ONLY = process.argv.includes("--check");

/** Classes with zero references anywhere in src/ — verified by grep first. */
const DEAD = new Set([
  "adaptive-card-grid",
  "adaptive-grid",
  "animate-fade-up",
  "app-shell__drawer-backdrop",
  "app-shell__drawer-panel",
  "app-shell__layout",
  "app-shell__mobile-drawer",
  "card-gold",
  "card-interactive",
  "card-glass",
  "container-page",
  "data-card",
  "desktop-only",
  "glass-card",
  "glass-effect",
  "hover-lift",
  "legend-scroll",
  "mobile-only",
  "num-cell",
  "premium-button",
  "premium-card",
  "premium-control-surface",
  "premium-filter-shell",
  "premium-input",
  "premium-native-select",
  "premium-select-content",
  "scroll-area",
  "section-pad",
  "sidebar-item",
  "sidebar-item__icon-wrap",
  "sidebar-item__label",
  "sidebar-modern",
  "sidebar-modern__edge",
  "sidebar-modern__glow",
  "sidebar-modern__surface",
  "stat-cell",
  "stats-grid",
  "status-badge",
  "table-wrapper__head",
  "tap-active",
  "text-accent-strong",
  "text-balance",
  "topbar",
  "topbar-modern",
  "topbar-modern__cta",
  "topbar-modern__icon-btn",
  "topbar-modern__profile",
  "touch-target-sm",
  "truncate-3",
]);

/** Class names owned by a library that renders them into the DOM. */
const FOREIGN_PREFIXES = ["recharts-", "radix-", "Mui", "ProseMirror", "cm-"];

const NESTED_AT_RULES = /^(?:@media|@supports|@layer|@container)\b/;

/** Splits a selector list on top-level commas, ignoring commas inside :is()/:not(). */
function splitSelectors(list) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Peels leading comments off a prelude.
 *
 * Without this, `/* Sidebar modern *\/ .sidebar-modern` is the "prelude", the
 * at-rule test never sees `@layer utilities`, and the whole layer is treated as
 * one opaque style rule — so nothing inside it is ever examined. This single
 * detail is why the first pruning pass removed 7 rules instead of ~50.
 */
function splitLeadingComments(text) {
  let rest = text;
  let comments = "";
  for (;;) {
    const match = rest.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)+)/);
    if (!match) break;
    comments += match[1];
    rest = rest.slice(match[1].length);
  }
  return { comments, rest: rest.trim() };
}

/** True when every class in the selector is known-dead. */
function selectorIsDead(selector) {
  // An attribute selector means the rule targets a runtime `data-*` hook.
  if (/\[[^\]]*\]/.test(selector)) return false;

  const classes = [...selector.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
  if (classes.length === 0) return false;
  if (classes.some((c) => FOREIGN_PREFIXES.some((p) => c.startsWith(p)))) return false;
  return classes.every((c) => DEAD.has(c));
}

/**
 * Parses a stylesheet body into rules and re-emits it without the dead ones.
 * Returns the new text plus what was removed, for reporting.
 */
function prune(text, trail = []) {
  let out = "";
  let k = 0;
  const removed = [];
  let bytes = 0;

  while (k < text.length) {
    const leading = text.slice(k).match(/^\s+/);
    if (leading) {
      out += leading[0];
      k += leading[0].length;
      continue;
    }

    const braceStart = text.indexOf("{", k);
    if (braceStart === -1) {
      out += text.slice(k);
      break;
    }

    const rawPrelude = text.slice(k, braceStart);
    const { comments, rest: prelude } = splitLeadingComments(rawPrelude);
    let depth = 0;
    let end = braceStart;
    for (; end < text.length; end += 1) {
      if (text[end] === "{") depth += 1;
      else if (text[end] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const block = text.slice(braceStart, end + 1);
    const ruleEnd = end + 1;
    const where = [...trail, prelude].join(" > ");

    if (NESTED_AT_RULES.test(prelude)) {
      const inner = prune(block.slice(1, -1), [...trail, prelude]);
      if (inner.text.trim() === "") {
        removed.push(`${where}  (empty after pruning)`);
        bytes += ruleEnd - k;
      } else {
        out += `${comments}${prelude}{${inner.text}}`;
        removed.push(...inner.removed);
        bytes += inner.bytes;
      }
      k = ruleEnd;
      continue;
    }

    // @keyframes / @font-face / @property and any other at-rule: untouched.
    if (prelude.startsWith("@")) {
      out += `${comments}${prelude}${block}`;
      k = ruleEnd;
      continue;
    }

    const selectors = splitSelectors(prelude);
    if (selectors.length > 0 && selectors.every(selectorIsDead)) {
      removed.push(where);
      bytes += ruleEnd - k;
      k = ruleEnd;
      continue;
    }

    out += `${comments}${prelude}${block}`;
    k = ruleEnd;
  }

  return { text: out, removed, bytes };
}

const source = readFileSync(TARGET, "utf8");
const result = prune(source);

const before = (Buffer.byteLength(source) / 1024).toFixed(1);
const after = (Buffer.byteLength(result.text) / 1024).toFixed(1);

if (CHECK_ONLY) {
  console.log(`would remove ${result.removed.length} rule(s), ${(result.bytes / 1024).toFixed(1)} KiB`);
  for (const r of result.removed) console.log(`  - ${r.replace(/\s+/g, " ")}`);
  if (result.removed.length) process.exit(1);
} else {
  writeFileSync(TARGET, result.text, "utf8");
  console.log(`legacy.css: ${before} KiB -> ${after} KiB`);
  console.log(`removed ${result.removed.length} rule(s), ${(result.bytes / 1024).toFixed(1)} KiB\n`);
  for (const r of result.removed) console.log(`  - ${r.replace(/\s+/g, " ")}`);
}
