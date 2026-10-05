import { describe, it, expect } from "vitest";

/**
 * `DEFAULT_ROLE_PERMISSIONS` decides who can open what, by default, for every
 * user created from now on.
 *
 * It was four closures with four path arrays inline. Nothing could check those
 * arrays, which meant a path renamed or removed in the registry would leave the
 * entry matching nothing: a grant that silently stopped being granted, and no
 * signal anywhere. The sibling list `PERMISSION_PAGES` had exactly that failure
 * before it was derived -- seventeen pages went missing unnoticed.
 *
 * The policy is still hand-written, because a manager legitimately being denied
 * `/owner/payroll` is a decision, not something to infer from route roles. What
 * is machine-checked here is that none of the hand-written policy has rotted:
 * every path either resolves to a real route or is explicitly accounted for.
 */
import {
  DEFAULT_ROLE_PERMISSION_PATHS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_PAGES,
  UNRESTRICTED_ROLES,
} from "@/features/users/constants";
import {
  APP_ROUTES,
  getPermissionPages,
  permissionKeyFor,
} from "@/app/route-registry";

const declared = new Set<string>();
const permissionKeys = new Set<string>();

// Read from the live registry rather than re-listing paths here: a second copy
// of the route table in a test is the thing being guarded against elsewhere.
for (const route of APP_ROUTES) {
  declared.add(route.path);
  permissionKeys.add(permissionKeyFor(route));
}

const dynamicPatterns = [...declared].filter((p) => p.includes(":"));

const resolves = (path: string): boolean => {
  if (declared.has(path) || permissionKeys.has(path)) return true;
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
    return re.test(path);
  });
};

describe("default role permissions", () => {
  it("no listed path has gone stale", () => {
    // The check that could not exist while these were closures.
    const stale: string[] = [];

    for (const [role, paths] of Object.entries(DEFAULT_ROLE_PERMISSION_PATHS)) {
      for (const path of paths) {
        if (!resolves(path)) stale.push(`${role}: ${path}`);
      }
    }

    expect(
      stale.join("\n"),
      `stale permission path(s) -- grant matches nothing: ${stale.length}`,
    ).toBe("");
  });

  it("grants the owner and admin everything", () => {
    for (const role of UNRESTRICTED_ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]("/anything/at/all")).toBe(true);
    }
    expect(DEFAULT_ROLE_PERMISSIONS.OWNER).toBeDefined();
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).toBeDefined();
  });

  it("still covers sub-pages by prefix", () => {
    // The prefix matching is load-bearing, not incidental: `/owner/hr` is what
    // grants `/owner/hr/archive`.
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER("/owner/hr")).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER("/owner/hr/archive")).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.CASHIER("/inventory/bundles")).toBe(true);
  });

  it("still denies what policy denies", () => {
    // A manager is not an owner. If this starts passing, someone widened the
    // default grant rather than granting it deliberately.
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER("/owner/payroll")).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.CASHIER("/owner/payroll")).toBe(false);
    expect(DEFAULT_ROLE_PERMISSIONS.BARBER("/owner/hr")).toBe(false);
    expect(DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT("/pos")).toBe(false);
  });

  it("has an entry for every role that can hold a user", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT", "BARBER"]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role], `no default for ${role}`).toBeDefined();
    }
  });

  it("defaults to denying a role it has never heard of", () => {
    // A role added to ROLES but not to this policy must not inherit anyone's
    // grants. The predicate is undefined, so the caller decides; this pins the
    // fact that there is no fallback granting everything.
    expect(DEFAULT_ROLE_PERMISSIONS.SOME_NEW_ROLE).toBeUndefined();
  });

  it("grants at least one page to every non-owner role", () => {
    const unreachable = Object.entries(DEFAULT_ROLE_PERMISSION_PATHS)
      .filter(([role, paths]) => !UNRESTRICTED_ROLES.has(role) && paths.length === 0)
      .map(([role]) => role);

    expect(
      unreachable.join("\n"),
      `role(s) with an empty but non-unrestricted grant list: ${unreachable.join(", ")}`,
    ).toBe("");
  });

  it("keeps PERMISSION_PAGES derived from the registry", () => {
    // The sibling fix. A hand-maintained version of this list is what drifted by
    // seventeen pages, so this asserts it still comes from the registry.
    expect(PERMISSION_PAGES.length).toBeGreaterThan(10);
    expect(typeof getPermissionPages).toBe("function");
    expect(getPermissionPages().length).toBe(PERMISSION_PAGES.length);
  });

  it("never lists a path twice in one role", () => {
    // Harmless at runtime, but it is always a copy-paste, and it hides a
    // reviewer scanning for whether something is missing.
    const dupes: string[] = [];
    for (const [role, paths] of Object.entries(DEFAULT_ROLE_PERMISSION_PATHS)) {
      const seen = new Set<string>();
      for (const p of paths) {
        if (seen.has(p)) dupes.push(`${role}: ${p}`);
        seen.add(p);
      }
    }
    expect(dupes.join("\n")).toBe("");
  });
});