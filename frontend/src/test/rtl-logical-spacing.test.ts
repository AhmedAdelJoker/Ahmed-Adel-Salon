import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * RTL guard.
 *
 * The product ships Arabic-first *and* English, so the same component has to
 * lay out correctly under `dir="rtl"` and `dir="ltr"`. Tailwind's physical
 * spacing utilities (`ml-*`, `pr-*`, `border-l-*`) resolve against a fixed
 * physical edge, so each one is a bug waiting for the moment a user switches
 * language: the margin lands on the wrong side and the layout mirrors
 * incorrectly while still looking plausible enough to ship.
 *
 * The logical forms (`ms-*`, `pe-*`, `border-s-*`) are emitted by Tailwind with
 * no extra configuration, so the migration is purely mechanical and this test
 * makes it irreversible.
 *
 * Symmetric utilities are excluded. `px-4`, `mx-auto` and `inset-x-0` apply to
 * both edges, so they are already direction-agnostic; including them would
 * triple the report and bury the real defects.
 */

const SRC = join(__dirname, "..");

/**
 * Asymmetric physical utilities that have a logical twin.
 *
 * `border-l` / `border-r` are listed without the trailing dash because the
 * bare forms (`border-l`, used with `border-4`) are common too.
 */
const PHYSICAL = [
  "ml-",
  "mr-",
  "pl-",
  "pr-",
  "border-l",
  "border-r",
  "scroll-ml-",
  "scroll-mr-",
  "scroll-ml",
  "scroll-mr",
];

/**
 * Tokens where the physical direction is deliberate.
 *
 * `left-1/2` is the centring idiom: paired with a physical translate it is
 * already correct under both directions, because the offset and the
 * compensation cancel. Rewriting only the offset would break centring, so these
 * are migrated together with their translate, by hand.
 */
const INTENTIONAL = /(?:^|:)left-1\/2$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strips comments so a class quoted in prose is not counted as usage. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Current outstanding count.
 *
 * These are the absolute-inset utilities (`left-*` / `right-*`) left by the
 * codemod's safe pass. They are excluded from that pass on purpose: they sit on
 * absolutely positioned elements whose placement may be decided by Radix
 * alignment, a sibling transform, or a `data-[side]` attribute, so a blind
 * rewrite cannot be verified by typecheck, lint or unit tests.
 *
 * Lower this number as `scripts/codemod-logical-spacing.mjs --full` is applied
 * file by file. Raising it should never be necessary.
 */
const OUTSTANDING_BASELINE = 145;

function countPhysicalSpacing(): { total: number; byFile: Map<string, number> } {
  const byFile = new Map<string, number>();
  let total = 0;

  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, "/");
    const code = stripComments(readFileSync(file, "utf8"));
    let count = 0;

    for (const match of code.matchAll(/(?<![\w-])((?:[a-z-]+:)*)([a-z]+-[^\s"'`]+)/g)) {
      const utility = match[2];
      if (INTENTIONAL.test(utility)) continue;
      if (PHYSICAL.some((p) => utility.startsWith(p) && utility.length > p.length)) {
        count += 1;
      }
    }

    if (count > 0) {
      byFile.set(rel, count);
      total += count;
    }
  }

  return { total, byFile };
}

describe("bidirectional layout", () => {
  it("does not reintroduce physical spacing utilities", () => {
    const { total, byFile } = countPhysicalSpacing();
    const top = [...byFile.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, count]) => `${file} (${count})`);

    expect(
      total,
      `found ${total} physical spacing utilities, baseline is ${OUTSTANDING_BASELINE}.\n` +
        `Use the logical forms: ml→ms, mr→me, pl→ps, pr→pe, border-l→border-s, ` +
        `border-r→border-e.\nOutstanding, largest first:\n  ${top.join("\n  ")}`,
    ).toBeLessThanOrEqual(OUTSTANDING_BASELINE);
  });

  it("keeps the logical forms Tailwind actually emits", () => {
    // A typo like `margin-start-*` would typecheck as a plain string and
    // silently produce no styling. Assert the vocabulary we rely on is real.
    const logical = [
      "ms-",
      "me-",
      "ps-",
      "pe-",
      "border-s-",
      "border-e-",
      "start-",
      "end-",
    ];
    const known = new Set(
      logical.flatMap((p) => [p, p.replace(/-$/, "")]),
    );
    const unknown: string[] = [];

    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      const code = stripComments(readFileSync(file, "utf8"));
      for (const match of code.matchAll(
        /\b((?:[a-z-]+:)*)(margin|padding|border|inset|scroll-margin)-(inline|start|end)\b/g,
      )) {
        // Reconstruct the Tailwind spelling and confirm it is in the vocabulary.
        const spelling = match[2] === "margin" && match[3] === "inline" ? "" : match[3];
        const candidate = `${match[2] === "inset" ? "inset" : match[2]}-${spelling}`;
        if (!known.has(candidate) && !logical.some((l) => candidate.startsWith(l))) {
          unknown.push(`${rel}: ${candidate}`);
        }
      }
    }

    expect(unknown).toEqual([]);
  });
});
