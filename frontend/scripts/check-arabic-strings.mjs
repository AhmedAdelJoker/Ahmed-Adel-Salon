/**
 * Scans source files for Arabic copy that has picked up stray Latin fragments.
 *
 * These are almost always typos introduced while writing UI strings — a
 * half-typed English word spliced into an Arabic sentence. They compile, they
 * typecheck, they pass every test, and they ship straight to the user, so
 * nothing else in the toolchain catches them.
 *
 * Precision matters more than recall here. A naive "any Latin in an Arabic
 * string" rule produced 120 hits, 118 of them intentional: `Walk-in`,
 * `YYYY-MM-DD`, `Master Barber`, `KPIs`. Those are deliberate bilingual terms
 * and flagging them would train everyone to ignore the output.
 *
 * The rule that actually isolates a typo: a Latin run glued directly onto an
 * Arabic character with no space or separator between them. Deliberate terms
 * are always parenthesised, hyphenated, or space-separated; a splice is not.
 * That took the count from 120 down to the 2 genuine defects.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");

/**
 * An Arabic character glued directly onto a Latin run with nothing between
 * them, or vice versa. Unicode property escapes keep this readable and avoid
 * hand-maintaining the Arabic block.
 *
 * A path separator counts as glue: `الصفوف/le` is a splice, while a
 * parenthesised or space-separated term like `(Walk-in)` or `YYYY-MM-DD` is
 * intentional bilingual copy and is correctly ignored.
 */
const SPLICED =
  /([\p{Script=Arabic}])([A-Za-z]{2,})|([A-Za-z]{2,})([\p{Script=Arabic}])|([\p{Script=Arabic}][/\\])([A-Za-z]{2,})/gu;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Extracts the double-quoted, single-quoted and template-literal strings. */
function stringLiterals(line) {
  const out = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  for (const m of line.matchAll(pattern)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return out;
}

const findings = [];

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, index) => {
    // Skip import paths, class names and identifiers: they are not user copy.
    if (/^\s*(import|export)\b/.test(line)) return;
    if (/\bclassName=/.test(line)) return;
    if (/\b(?:from|import)\s+["']/.test(line)) return;

    for (const literal of stringLiterals(line)) {
      for (const match of literal.matchAll(SPLICED)) {
        findings.push({
          file: rel,
          line: index + 1,
          snippet: match[0],
          context: literal.trim().slice(0, 100),
        });
      }
    }
  });
}

if (findings.length === 0) {
  console.log("no spliced Arabic/Latin strings found");
} else {
  console.log(`${findings.length} spliced string(s):\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  "${f.snippet}"`);
    console.log(`      ${f.context}\n`);
  }
  process.exit(1);
}
