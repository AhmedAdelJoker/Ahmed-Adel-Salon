import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";

/**
 * Every internal link must resolve to a declared route.
 *
 * React Router renders a link to a missing path as a blank screen, not an
 * error, so a typo in `navigate(...)` produces no stack trace and no failed
 * test anywhere. It looks like a button that does nothing. Nothing else in the
 * suite would catch it: unit tests render the component that owns the link with
 * its own mock, and the routing tests assert the registry contains what it
 * contains -- neither asks whether the two agree with each other.
 *
 * This is that question.
 *
 * Both sources of truth are read. `router.tsx` declares `/` -> <HomeRedirect />
 * outside the registry, and a registry-only check reports every `navigate("/")`
 * as dead. A checker that cries wolf gets ignored, so it has to know the whole
 * surface.
 */
const SRC = resolve(process.cwd(), "src");

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
};

const registry = readFileSync(join(SRC, "app", "route-registry.tsx"), "utf8");
const router = readFileSync(join(SRC, "app", "router.tsx"), "utf8");

const declared = new Set<string>();
for (const m of registry.matchAll(/path:\s*"([^"]+)"/g)) declared.add(m[1]);
for (const m of router.matchAll(/<Route\s+[^>]*?path="([^"]+)"/g)) declared.add(m[1]);

const dynamicPatterns = [...declared].filter((p) => p.includes(":"));

const resolves = (href: string): boolean => {
  const clean = href.split(/[?#]/)[0];
  if (clean === "" || clean === "/") return declared.has(clean);
  if (declared.has(clean)) return true;
  return dynamicPatterns.some((pattern) => {
    const re = new RegExp(
      "^" +
        pattern
          .split("/")
          .map((seg) =>
            seg.startsWith(":")
              ? "[^/]+"
              : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          )
          .join("/") +
        "$",
    );
    return re.test(clean);
  });
};

// `onNavigate` was missing from the first version of this list, which made
// /owner/alerts look unreachable while the needs-attention card linked to it.
const LINK_PATTERNS = [
  /\bnavigate\(\s*["'`]([^"'`]+)["'`]/g,
  /\bonNavigate\(\s*["'`]([^"'`]+)["'`]/g,
  /\bto:\s*["'`]([^"'`]+)["'`]/g,
  /\bhref:\s*["'`]([^"'`]+)["'`]/g,
  /\bto=\{\s*["'`]([^"'`]+)["'`]/g,
];

const external = /^(https?:|mailto:|tel:|#|\/\/)/;

function collectLinks() {
  const found: { href: string; where: string }[] = [];

  for (const file of walk(SRC)) {
    if (file.includes("route-registry.tsx")) continue;

    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;

        for (const pattern of LINK_PATTERNS) {
          pattern.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = pattern.exec(line)) !== null) {
            if (external.test(m[1])) continue;
            found.push({ href: m[1], where: `${file}:${i + 1}` });
          }
        }
      });
  }

  return found;
}

describe("internal links resolve to declared routes", () => {
  const links = collectLinks();

  it("found links to check", () => {
    // Guards against the audit silently matching nothing, which would make every
    // assertion below pass for the wrong reason.
    expect(links.length).toBeGreaterThan(50);
  });

  it("has no dead link", () => {
    const dead = links.filter((l) => !resolves(l.href));

    expect(
      dead.map((d) => `${d.where} -> ${d.href}`).join("\n"),
      `dead internal link(s): ${dead.length}`,
    ).toBe("");
  });

  it("resolves the documented tricky cases", () => {
    // `/` is declared in router.tsx, not the registry.
    expect(declared.has("/")).toBe(true);
    expect(resolves("/")).toBe(true);

    // Query strings and hashes are stripped before matching.
    expect(resolves("/owner/hr?employeeId=3")).toBe(true);

    // Interpolated ids match a dynamic segment.
    expect(resolves("/customers/42")).toBe(true);

    // And something that genuinely does not exist still fails.
    expect(resolves("/owner/definitely-not-a-page")).toBe(false);
  });

  it("still routes every redirect alias somewhere real", () => {
    // Aliases are not orphans: they are compatibility paths. Each must name a
    // destination that exists, or the redirect lands the user on a blank screen.
    const aliases: { from: string; to: string }[] = [];
    for (const m of registry.matchAll(
      /path:\s*"([^"]+)",[\s\S]{0,400}?redirectTo:\s*"([^"]+)"/g,
    )) {
      aliases.push({ from: m[1], to: m[2] });
    }

    expect(aliases.length).toBeGreaterThan(0);

    const broken = aliases.filter((a) => !resolves(a.to));
    expect(
      broken.map((b) => `${b.from} -> ${b.to}`).join("\n"),
      "redirect target does not exist",
    ).toBe("");
  });

  it("has no page that neither the nav nor a link can reach", () => {
    // A page with no `nav` block and no literal link is invisible: not in the
    // sidebar, not in search, not from anywhere. Only `redirectTo` entries are
    // legitimately link-free.
    const navigable = new Set<string>();
    for (const m of registry.matchAll(
      /path:\s*"([^"]+)",[\s\S]{0,700}?nav:\s*\{/g,
    )) {
      navigable.add(m[1]);
    }

    const targets = new Set(
      links.map((l) => l.href.split(/[?#]/)[0].replace(/\$\{[^}]+\}/g, ":id")),
    );

    // Role home paths are reachable targets without appearing as a literal
    // anywhere: `getHomePath(role)` returns them. Read from the source rather
    // than hardcoded, so adding a role cannot make its own home look orphaned.
    const rolesSource = readFileSync(join(SRC, "lib", "access", "roles.ts"), "utf8");
    const homeBlock = rolesSource.match(
      /ROLE_HOME_PATHS[\s\S]*?=\s*\{([\s\S]*?)\}/,
    )?.[1];
    expect(homeBlock, "ROLE_HOME_PATHS should be readable").toBeTruthy();
    for (const m of homeBlock!.matchAll(/"(\/[^"]*)"/g)) targets.add(m[1]);

    const orphans = [...declared].filter(
      (p) =>
        !p.includes(":") &&
        p !== "/" &&
        p !== "*" &&
        !targets.has(p) &&
        !navigable.has(p) &&
        // `redirectTo` means it is an intentional compatibility alias.
        !new RegExp(
          `path:\\s*"${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}",[\\s\\S]{0,400}?redirectTo:`,
        ).test(registry),
    );

    expect(
      orphans.join("\n"),
      `page reachable from nowhere: ${orphans.length}`,
    ).toBe("");
  });

  it("flags duplicate paths that serve the same page under two prefixes", () => {
    // Not a dead end -- `/expenses/archive` and `/owner/expenses/archive` both
    // render ExpensesArchive -- but two addresses for one page means two places
    // to update and two that can drift in the permission map. Reported rather
    // than failed, so a deliberate alias can be justified in a follow-up.
    const byComponent = new Map<string, string[]>();
    for (const m of registry.matchAll(
      /path:\s*"([^"]+)",[\s\S]{0,300}?component:\s*([A-Za-z0-9_]+)/g,
    )) {
      const list = byComponent.get(m[2]) ?? [];
      list.push(m[1]);
      byComponent.set(m[2], list);
    }

    const duplicated = [...byComponent.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([component, paths]) => `${component}: ${paths.join(" , ")}`);

    // Pinned, not asserted empty: this documents the current state so a new
    // duplicate is visible in a diff.
    expect(duplicated.join("\n")).toMatchSnapshot();
  });
});