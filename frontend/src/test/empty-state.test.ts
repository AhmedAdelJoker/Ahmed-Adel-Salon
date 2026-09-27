import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const sourceFiles = walk(SRC);
const canonical = join(SRC, "components", "shared", "EmptyState.tsx");

/**
 * The literal attribute prefix of an `<EmptyState ...>` opening tag.
 *
 * A prop whose value is a nested element (`action={<Button variant="outline" />}`)
 * makes the opening tag span those characters, so a naive scan would read the
 * Button's own `variant`. Only the run of attributes before the first `{` is
 * unambiguously the EmptyState's own.
 */
function literalProps(code: string): string[] {
  const props: string[] = [];
  for (const match of code.matchAll(/<EmptyState\b/g)) {
    const rest = code.slice(match.index);
    const brace = rest.indexOf("{");
    const end = rest.search(/[>]/);
    const stop = brace === -1 ? end : Math.min(brace, end === -1 ? brace : end);
    props.push(rest.slice(0, stop === -1 ? rest.length : stop));
  }
  return props;
}

describe("empty state is a single component", () => {
  it("keeps one implementation", () => {
    const implementations = sourceFiles.filter((file) => {
      if (file === canonical) return false;
      const rel = relative(SRC, file).replace(/\\/g, "/");
      if (!/EmptyState/i.test(rel)) return false;
      if (rel.startsWith("test/")) return false;
      const code = readFileSync(file, "utf8");
      // A definition, not a re-export.
      return /export\s+(default\s+)?function\s+EmptyState|export\s+const\s+EmptyState/.test(
        code,
      );
    });
    expect(implementations).toEqual([]);
  });

  it("has no other module defining an EmptyState", () => {
    const definitions: string[] = [];
    for (const file of sourceFiles) {
      if (file === canonical) continue;
      const rel = relative(SRC, file).replace(/\\/g, "/");
      if (rel.startsWith("test/")) continue;
      const code = readFileSync(file, "utf8");
      if (
        /export\s+(default\s+)?function\s+EmptyState|export\s+const\s+EmptyState/.test(
          code,
        )
      ) {
        definitions.push(rel);
      }
    }
    expect(definitions).toEqual([]);
  });

  it("uses one prop vocabulary", () => {
    // The old components each accepted a different name for the same string.
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const tag of literalProps(readFileSync(file, "utf8"))) {
        for (const legacy of ["text=", "description=", "desc="]) {
          if (new RegExp(`\\s${legacy}`).test(tag)) {
            offenders.push(`${relative(SRC, file)}: ${legacy}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("only uses known variants", () => {
    const known = new Set(["page", "section", "table", "inline", "board"]);
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const tag of literalProps(readFileSync(file, "utf8"))) {
        const variant = tag.match(/variant="([^"]+)"/);
        if (variant && !known.has(variant[1])) {
          offenders.push(`${relative(SRC, file)}: ${variant[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never puts markup or interpolation in a literal prop", () => {
    // A bulk rewrite flattened a `<br />` and a `{date}` into string
    // attributes, which renders the tag as visible text. Either belongs in a
    // JSX expression container.
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const tag of literalProps(readFileSync(file, "utf8"))) {
        for (const match of tag.matchAll(/\s(?:title|message)="([^"]*)"/g)) {
          if (/[<>]|\{\w/.test(match[1])) {
            offenders.push(`${relative(SRC, file)}: ${match[0].trim()}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("is announced to assistive tech", () => {
    const code = readFileSync(canonical, "utf8");
    expect(code).toMatch(/role="status"/);
    expect(code).toMatch(/aria-live="polite"/);
  });
});
