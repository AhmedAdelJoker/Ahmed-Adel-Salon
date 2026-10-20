/**
 * Codemod: physical spacing utilities → logical ones.
 *
 * The app renders in both RTL (Arabic) and LTR (English). Tailwind already
 * emits logical variants for every affected utility, so the migration is purely
 * mechanical — but doing it by hand across 389 occurrences in 148 files is
 * exactly the kind of chore that gets half-finished and leaves a few pages
 * mirrored.
 *
 * Mappings (all natively supported by Tailwind v4):
 *   ml-* → ms-*   mr-* → me-*   pl-* → ps-*   pr-* → pe-*
 *   left-* → start-*   right-* → end-*
 *   border-l-* → border-s-*   border-r-* → border-e-*
 *   scroll-ml-* → scroll-ms-*   scroll-mr-* → scroll-me-*
 *
 * Preserved: every variant prefix (hover:, sm:, dark:, peer-*, data-*, …) and
 * every arbitrary value (ml-[52px] → ms-[52px]).
 *
 * Deliberately NOT migrated, and reported instead:
 *   - `left-1/2` — the centring idiom. Paired with a physical translate it is
 *     already correct in both directions; converting only the offset would
 *     break centring.
 *   - `translate-x-*` — a hover-slide direction, not a spacing utility. It has
 *     no logical equivalent and needs a paired `rtl:` variant, which is a
 *     human decision.
 *   - `rounded-l-*` / `rounded-r-*` / `text-left` / `text-right` — often an
 *     intentional affordance rather than a layout edge.
 *
 * Usage:
 *   node scripts/codemod-logical-spacing.mjs            safe set, in place
 *   node scripts/codemod-logical-spacing.mjs --check    safe set, report only
 *   node scripts/codemod-logical-spacing.mjs --full     also convert insets
 *   node scripts/codemod-logical-spacing.mjs --full --check
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");
const CHECK_ONLY = process.argv.includes("--check");
const FULL = process.argv.includes("--full");

/**
 * Unambiguous: margin, padding and border-side.
 *
 * These only ever resolve against the inline axis, so swapping the physical
 * keyword for its logical twin is behaviour-preserving in LTR and a bug fix in
 * RTL. Nothing else about the declaration changes.
 */
const SAFE_MAP = [
  ["border-l-", "border-s-"],
  ["border-r-", "border-e-"],
  ["scroll-ml-", "scroll-ms-"],
  ["scroll-mr-", "scroll-me-"],
  ["ml-", "ms-"],
  ["mr-", "me-"],
  ["pl-", "ps-"],
  ["pr-", "pe-"],
];

/**
 * Deferred to `--full`: absolute insets.
 *
 * `left-*` and `right-*` sit on top of absolutely positioned elements whose
 * position may be decided by Radix/Popper alignment, a sibling transform, or a
 * `data-[side]` attribute. Converting them changes which edge the browser
 * anchors to, which is correct in principle but not verifiable by types, lint
 * or unit tests — and getting it wrong silently overlays a menu off-screen.
 * They are converted explicitly, on a per-file basis, after the safe set has
 * been verified.
 */
const FULL_MAP = [
  ["left-", "start-"],
  ["right-", "end-"],
];

const MAP = FULL ? [...SAFE_MAP, ...FULL_MAP] : SAFE_MAP;

/** Tokens left for a human, with the reason. */
const SKIP_EXACT = new Set(["left-1/2"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Splits `hover:sm:dark:ml-2` into its variant chain and the utility itself. */
function splitVariants(token) {
  const parts = token.split(":");
  const utility = parts.pop();
  return { prefix: parts.length ? `${parts.join(":")}:` : "", utility };
}

/** Converts one class token, or returns null when it should be left alone. */
function convertToken(token) {
  const { prefix, utility } = splitVariants(token);
  if (SKIP_EXACT.has(utility)) return null;
  if (utility.startsWith("translate-x-")) return null;

  for (const [from, to] of MAP) {
    if (utility.startsWith(from) && utility.length > from.length) {
      return `${prefix}${to}${utility.slice(from.length)}`;
    }
  }
  return null;
}

const changedFiles = [];
const skipped = [];
let totalConverted = 0;

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const original = readFileSync(file, "utf8");

  // Operate on the contents of string literals only, so identifiers, import
  // paths and property names are never touched. A class name can only ever
  // appear inside a string.
  const converted = original.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
    (literal) => {
      const body = literal.slice(1, -1);
      let touched = false;

      const next = body
        .split(/(\s+)/)
        .map((chunk) => {
          if (/^\s*$/.test(chunk)) return chunk;
          const bare = chunk.replace(/^["'`]|["'`.,:;()[\]{}]+$/g, "");
          const result = convertToken(bare);
          if (result === null) {
            if (SKIP_EXACT.has(splitVariants(bare).utility) || bare.startsWith("translate-x-")) {
              skipped.push(`${rel}: ${bare}`);
            }
            return chunk;
          }
          if (result === bare) return chunk;
          touched = true;
          totalConverted += 1;
          // Preserve any surrounding punctuation from the original chunk.
          const lead = chunk.match(/^["'`]/)?.[0] ?? "";
          const tail = chunk.match(/["'`.,:;()[\]{}]+$/)?.[0] ?? "";
          return `${lead}${result}${tail}`;
        })
        .join("");

      return touched ? `"${next}"` : literal;
    },
  );

  if (converted !== original) {
    changedFiles.push({ rel, before: original, after: converted });
  }
}

if (CHECK_ONLY) {
  console.log(
    `would convert ${totalConverted} utility occurrence(s) across ${changedFiles.length} file(s)`,
  );
  for (const f of changedFiles.slice(0, 60)) console.log(`  ${f.rel}`);
  if (totalConverted) process.exit(1);
} else {
  for (const f of changedFiles) writeFileSync(join(SRC, f.rel), f.after, "utf8");
  console.log(
    `converted ${totalConverted} utility occurrence(s) across ${changedFiles.length} file(s)`,
  );
}

const uniqueSkipped = [...new Set(skipped)];
if (uniqueSkipped.length) {
  console.log(`\n${uniqueSkipped.length} token(s) left for manual review:`);
  for (const s of uniqueSkipped) console.log(`  ${s}`);
}

/** Counts the physical insets that remain after the safe pass. */
function auditInsets() {
  const prefixes = FULL_MAP.map(([from]) => from);
  let count = 0;
  for (const file of walk(SRC)) {
    const code = readFileSync(file, "utf8");
    for (const m of code.matchAll(
      /(?<![\w-])((?:[\w-]+:)*)(left|right)-(\S+)/g,
    )) {
      const utility = `${m[2]}-${m[3]}`;
      if (SKIP_EXACT.has(utility) || SKIP_EXACT.has(m[3])) continue;
      if (prefixes.some((p) => utility.startsWith(p))) count += 1;
    }
  }
  return count;
}

if (!FULL) {
  const remaining = auditInsets();
  console.log(
    `\n${remaining} absolute-inset token(s) still physical. Re-run with --full, or` +
      ` migrate per file — see the FULL_MAP note at the top of this script.`,
  );
}
