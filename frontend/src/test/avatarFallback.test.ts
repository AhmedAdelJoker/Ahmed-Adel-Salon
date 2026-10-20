import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * An `<img>` whose `src` comes from a stored path needs an `onError`.
 *
 * `users.profile_image_url` holds a path, not the file. The file can fail to be
 * written, move with the data directory, or be cleaned up later -- and when it
 * does, an `<img>` with no `onError` renders a broken-image placeholder
 * permanently. The only evidence is one console line, which is why both
 * registered accounts in this workspace ended up pointing at uploads that do not
 * exist and nobody noticed for months.
 *
 * `EmployeeAvatar` has always handled this. The two components that build an
 * `<img>` by hand -- `Header` and `Sidebar` -- did not, and they are the two
 * that are on screen at all times.
 *
 * This reads the source rather than rendering, because the failure is an absent
 * prop, and a render test cannot tell an absent `onError` from an `<img>` that
 * happens to load. It is a lint, expressed as a test, so it cannot be disabled
 * without someone deleting a file that says why.
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

describe("avatars degrade instead of breaking", () => {
  const files = walk(SRC);

  it("found the component tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("every <img> sourced from a stored path handles load failure", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // Every <img .../> that interpolates a path or a stored url.
      const images = text.match(/<img\b[^>]*\/>/g) ?? [];
      for (const img of images) {
        const fromStoredPath = /src=\{[^}]*(staticURL|avatar|image|Image|photo|Photo)/.test(
          img
        );
        if (fromStoredPath && !/onError=/.test(img)) {
          const line = text.slice(0, text.indexOf(img)).split("\n").length;
          offenders.push(`${file.slice(SRC.length + 1)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Header and Sidebar both fall back to initials", () => {
    // The two places that render the signed-in user's own avatar, on every
    // page, at all times.
    for (const file of ["components/layout/Header.tsx", "components/layout/Sidebar.tsx"]) {
      const text = readFileSync(join(SRC, file), "utf8");
      expect(text, `${file} has no onError on its avatar`).toMatch(/onError=/);
      expect(text, `${file} lost its initials fallback`).toMatch(/getInitials\(\)/);
    }
  });
});