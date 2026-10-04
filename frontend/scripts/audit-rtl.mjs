/**
 * Audits bidirectional (RTL/LTR) correctness in the class layer.
 *
 * The app ships Arabic-first with a real English locale, so every spacing and
 * inset utility that names a physical side is a latent bug: it will place a
 * margin or a border on the wrong edge the moment the locale flips. Tailwind
 * already emits logical variants (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`,
 * `end-*`, `border-s-*`, `border-e-*`); this reports the physical ones so they
 * can be migrated file by file.
 *
 * Excluded on purpose:
 *   - `left-` / `right-` used with a value that also carries `rtl:`/`ltr:`
 *     variants, since those are explicitly direction-aware.
 *   - `text-left` / `text-right`, which control the text alignment the author
 *     actually asked for, not a layout edge.
 *   - `rounded-l-*` / `rounded-r-*`, which are commonly used for affordances
 *     (a notch on the trailing edge of a card) rather than as spacing.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");

/**
 * Physical spacing/inset utilities that have a logical equivalent.
 *
 * Symmetric utilities are deliberately excluded. `px-4`, `mx-auto` and
 * `inset-x-0` apply to both edges, so they behave identically in RTL and
 * listing them tripled the report and buried the real defects. A first pass
 * that included them reported 904 hits; the actual asymmetric count is a
 * fraction of that, and those are the ones that break when the locale flips.
 */
const PHYSICAL = [
  // margin — asymmetric only
  "ml-", "mr-",
  // padding — asymmetric only
  "pl-", "pr-",
  // inset
  "left-", "right-",
  // border side
  "border-l", "border-r", "border-l-", "border-r-",
  // scroll margin
  "scroll-ml-", "scroll-mr-", "scroll-ml", "scroll-mr",
];

/**
 * Utilities where the physical direction is the author's explicit intent, or
 * where the value is inherently direction-neutral.
 *
 * `left-1/2` paired with a translate is the standard centring idiom and is
 * already correct in both directions: the element is centred, so the physical
 * left offset and the compensating physical translate cancel out. Migrating
 * it to `start-1/2` without also flipping the translate would break centring.
 */
const INTENTIONAL =
  /\b(?:text-left|text-right|rounded-l-|rounded-r-|space-x-reverse|translate-x-)\b|(?:^|:)left-1\/2$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Pulls every className string out of a source file. */
function classNames(code) {
  const found = new Set();
  const patterns = [
    /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g,
    /\bcn\([^)]*?"([^"]*)"/g,
    /"(?:[^"\\]|\\.)*\b(?:m[lrx]|p[lrx]|left|right|inset-x|border-[lr]|scroll-m[lr]|translate-x)-[^"\\]*(?:[^"\\]|\\.)*"/g,
  ];
  for (const pattern of patterns) {
    for (const m of code.matchAll(pattern)) {
      const raw = m[1] ?? m[2] ?? m[3] ?? m[0];
      for (const token of raw.split(/\s+/)) {
        const name = token.replace(/^[`'"]|[`'".,:;()]+$/g, "");
        if (name) found.add(name);
      }
    }
  }
  return [...found];
}

const rows = [];

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const code = readFileSync(file, "utf8");
  const hits = new Set();

  for (const name of classNames(code)) {
    if (INTENTIONAL.test(name)) continue;
    // A class paired with an explicit direction variant is fine.
    if (/-(?:rtl|ltr):/.test(name)) continue;
    const base = name.replace(/^(?:hover|focus|focus-visible|active|disabled|group-hover|peer-focus|dark|sm|md|lg|xl|2xl|print|aria-selected|data-\[[^\]]+\]):/g, "");
    if (PHYSICAL.some((p) => base.startsWith(p))) hits.add(name);
  }

  if (hits.size) rows.push({ file: rel, classes: [...hits].sort() });
}

const totalClasses = rows.reduce((sum, r) => sum + r.classes.length, 0);
rows.sort((a, b) => b.classes.length - a.classes.length);

console.log(`physical-direction utilities: ${totalClasses} across ${rows.length} file(s)\n`);
for (const row of rows.slice(0, 40)) {
  console.log(`  ${row.file}  (${row.classes.length})`);
  console.log(`      ${row.classes.slice(0, 8).join(" ")}${row.classes.length > 8 ? " …" : ""}`);
}
if (rows.length > 40) console.log(`\n  … and ${rows.length - 40} more files`);
