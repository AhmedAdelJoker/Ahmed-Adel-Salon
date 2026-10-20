/**
 * audit-i18n-keys.mjs — find t() calls whose key is not in the catalogue.
 *
 * The parity test only proved that `ar` and `en` list the same keys. It said
 * nothing about whether the keys the code actually calls exist, so a page could
 * render the literal string "landing.openNow" to visitors and every test would
 * still pass.
 *
 * Run with: node scripts/audit-i18n-keys.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const i18nSource = await fs.readFile(path.join(root, "src/lib/i18n.ts"), "utf8");

/** Keys declared in the Arabic catalogue — the source of truth. */
const arabicBlock = i18nSource.slice(
  i18nSource.indexOf("const ar = {"),
  i18nSource.indexOf("const en:"),
);
const known = new Set(
  [...arabicBlock.matchAll(/^\s{2}"([^"]+)":/gm)].map((m) => m[1]),
);

const files = await walk(path.join(root, "src"));
const missing = new Map();

for (const file of files) {
  if (file.endsWith(path.join("lib", "i18n.ts"))) continue;
  const source = await fs.readFile(file, "utf8");
  // Strip comments so prose about keys is not mistaken for a call site.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  for (const match of code.matchAll(/\bt\(\s*["'`]([a-z][A-Za-z0-9_.]*)["'`]/g)) {
    const key = match[1];
    if (known.has(key)) continue;
    const line = code.slice(0, match.index).split("\n").length;
    if (!missing.has(key)) missing.set(key, []);
    missing.get(key).push(`${path.relative(root, file)}:${line}`);
  }
}

console.log(`catalogue keys: ${known.size}`);
console.log(`referenced but missing: ${missing.size}\n`);

for (const [key, sites] of [...missing].sort()) {
  console.log(`  ${key}`);
  for (const site of sites) console.log(`      ${site}`);
}

if (missing.size > 0) {
  console.log("\nAdd these to the `ar` and `en` catalogues in src/lib/i18n.ts.");
  process.exitCode = 1;
}
