import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PAGES = join(__dirname, "..", "pages");
const SHELL = join(__dirname, "..", "components", "shared", "PageShell.tsx");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const allTsx = walk(PAGES);

/** Top-level route components, i.e. the ones the registry lazy-loads. */
const routePages = allTsx.filter(
  (file) =>
    !/[\\/](components|POS|schedule)[\\/]/.test(file) &&
    !/(index|POSContext)\.tsx$/.test(file),
);

const read = (file: string) => readFileSync(file, "utf8");

describe("PageShell", () => {
  it("exists as the single page layout", () => {
    expect(readFileSync(SHELL, "utf8")).toMatch(/export function PageShell/);
  });

  it("keeps the bottom clearance for the fixed mobile nav", () => {
    const code = readFileSync(SHELL, "utf8");
    // The bar is fixed from the bottom on small screens and hidden at lg.
    expect(code).toMatch(/pb-16/);
    expect(code).toMatch(/lg:pb-/);
  });

  it("is not redefined anywhere else", () => {
    const offenders: string[] = [];
    for (const file of allTsx) {
      if (/export\s+(default\s+)?function\s+PageShell|export\s+const\s+PageShell/.test(
        read(file),
      )) {
        offenders.push(relative(PAGES, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps route pages off the old hand-rolled wrappers", () => {
    // Both the min-h-screen + max-w-7xl pair and a page-level max-w-* are the
    // pre-PageShell idiom. Route pages should get their layout from the shell.
    const offenders: string[] = [];
    for (const file of routePages) {
      const code = read(file);
      if (!/<PageShell/.test(code)) continue;
      if (/mx-auto max-w-(?!7xl)/.test(code)) {
        offenders.push(`${relative(PAGES, file)}: nested max-w-*`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("leaves no route page building its own page column", () => {
    // A page that both uses PageShell and still wraps its body in a
    // min-h-screen column has two layouts fighting each other. The centred
    // loading spinner is exempt: it is a transient full-height state, not a
    // competing page layout, and it is what the pre-shell code used.
    const offenders: string[] = [];
    for (const file of routePages) {
      const code = read(file);
      if (!/<PageShell/.test(code)) continue;
      for (const match of code.matchAll(/className="([^"]*\bmin-h-screen\b[^"]*)"/g)) {
        if (/items-center/.test(match[1]) && /justify-center/.test(match[1])) {
          continue;
        }
        offenders.push(`${relative(PAGES, file)}: min-h-screen alongside PageShell`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not override the shell's own rhythm per page", () => {
    // space-y-* and pb-* on a page root were overriding the gap the stylesheet
    // already defines, which is how the spacing drifted.
    const offenders: string[] = [];
    for (const file of routePages) {
      const code = read(file);
      for (const match of code.matchAll(/<PageShell([^>]*)>/g)) {
        const props = match[1];
        if (/\bspace-y-/.test(props)) {
          offenders.push(`${relative(PAGES, file)}: space-y-* on PageShell`);
        }
        if (/\bpb-\d/.test(props)) {
          offenders.push(`${relative(PAGES, file)}: pb-* on PageShell`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
