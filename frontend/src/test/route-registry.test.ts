import { describe, it, expect } from "vitest";
import {
  APP_ROUTES,
  NAV_ROUTES,
  PAGE_ROUTES,
  getAllNavItems,
  getAllPaths,
  getMobileNavItems,
  getNavGroups,
  getSearchEntries,
  matchRoute,
  permissionKeyForPath,
  resolvePageMeta,
  NAV_GROUPS,
} from "@/app/route-registry";
import { PERMISSION_PAGES } from "@/features/users/constants";
import { getHomePath, getProfilePath, normalizeRole } from "@/lib/access/roles";

const ALL_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "BARBER",
  "ACCOUNTANT",
] as const;

const permissionIds = new Set(PERMISSION_PAGES.map((page) => page.id));

describe("route registry integrity", () => {
  it("declares no duplicate paths", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const path of getAllPaths()) {
      if (seen.has(path)) dupes.push(path);
      seen.add(path);
    }
    expect(dupes).toEqual([]);
  });

  it("gives every route a non-empty title", () => {
    const bad = APP_ROUTES.filter((route) => !route.title?.trim()).map(
      (route) => route.path,
    );
    expect(bad).toEqual([]);
  });

  it("gives every page route an auth policy", () => {
    const bad = PAGE_ROUTES.filter(
      (route) => !route.public && (!route.roles || route.roles.length === 0),
    ).map((route) => route.path);
    expect(bad).toEqual([]);
  });

  it("only uses known roles", () => {
    const bad: string[] = [];
    for (const route of APP_ROUTES) {
      for (const role of route.roles ?? []) {
        if (!ALL_ROLES.includes(role as (typeof ALL_ROLES)[number])) {
          bad.push(`${route.path}: ${role}`);
        }
      }
      for (const role of route.nav?.roles ?? []) {
        if (!ALL_ROLES.includes(role as (typeof ALL_ROLES)[number])) {
          bad.push(`${route.path} (nav): ${role}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("points every redirect at a real route", () => {
    const paths = new Set(getAllPaths());
    const bad = APP_ROUTES.filter(
      (route) => route.redirectTo && !paths.has(route.redirectTo.split("?")[0]),
    ).map((route) => `${route.path} -> ${route.redirectTo}`);
    expect(bad).toEqual([]);
  });

  it("gives every redirect entry a component-free definition", () => {
    const bad = APP_ROUTES.filter(
      (route) => route.redirectTo && route.component,
    ).map((route) => route.path);
    expect(bad).toEqual([]);
  });

  it("gives every page route a component", () => {
    const bad = PAGE_ROUTES.filter((route) => !route.component).map(
      (route) => route.path,
    );
    expect(bad).toEqual([]);
  });

  it("never puts a redirect or a public route in the menu", () => {
    const bad = NAV_ROUTES.filter(
      (route) => route.redirectTo || route.public,
    ).map((route) => route.path);
    expect(bad).toEqual([]);
  });

  it("only embeds into routes that exist", () => {
    const paths = new Set(getAllPaths());
    const bad = APP_ROUTES.filter(
      (route) => route.embeddedIn && !paths.has(route.embeddedIn),
    ).map((route) => `${route.path} -> ${route.embeddedIn}`);
    expect(bad).toEqual([]);
  });

  it("registers every nav entry in the permission matrix or as a legacy alias", () => {
    // The permission matrix predates the registry, so a few keys are known
    // aliases. Everything else must line up or per-user overrides go dead.
    const LEGACY_ALIASES = new Set([
      "/owner/expenses/archive", // duplicate of /expenses/archive
      "/owner/connected-pages", // removed band-aid page
    ]);
    const bad = NAV_ROUTES.filter(
      (route) =>
        !permissionIds.has(route.path) && !LEGACY_ALIASES.has(route.path),
    ).map((route) => route.path);
    expect(bad).toEqual([]);
  });

  it("has no unreachable page: every page is a menu item, embedded, or a drilldown target", () => {
    const reachable = new Set<string>();
    for (const route of NAV_ROUTES) reachable.add(route.path);
    for (const route of APP_ROUTES) {
      if (route.embeddedIn) reachable.add(route.path);
      if (route.redirectTo) reachable.add(route.redirectTo.split("?")[0]);
    }
    // Drilldown pages are reached from their parent page's own buttons.
    const DRILLDOWNS = new Set([
      "/customers/:id",
      "/owner/customers/archive",
      "/invoices/archive",
      "/inventory/archive",
      "/inventory/bundles",
      "/expenses/archive",
      "/owner/expenses/archive",
      "/owner/hr/archive",
      "/owner/payroll/archive",
    ]);
    for (const path of DRILLDOWNS) reachable.add(path);

    const orphans = PAGE_ROUTES.filter(
      (route) => !reachable.has(route.path),
    ).map((route) => route.path);
    expect(orphans).toEqual([]);
  });

  it("keeps every drilldown page reachable from a real parent", () => {
    // Each drilldown must have at least one nav sibling in the same feature so
    // the user is never stranded.
    const navPaths = new Set(getAllNavItems().map((item) => item.to));
    const PAIRS: Record<string, string> = {
      "/customers/:id": "/customers",
      "/owner/customers/archive": "/customers",
      "/invoices/archive": "/invoices",
      "/inventory/archive": "/inventory",
      "/inventory/bundles": "/inventory",
      "/expenses/archive": "/expenses",
      "/owner/expenses/archive": "/expenses",
      "/owner/hr/archive": "/owner/hr",
      "/owner/payroll/archive": "/owner/payroll",
    };
    for (const [drilldown, parent] of Object.entries(PAIRS)) {
      expect(
        navPaths.has(parent),
        `${drilldown} has no menu parent at ${parent}`,
      ).toBe(true);
      expect(matchRoute(drilldown)?.path).toBe(drilldown);
    }
  });
});

describe("nav derivation", () => {
  it("emits every group in declared order", () => {
    const ids = getNavGroups().map((group) => group.id);
    expect(ids).toEqual(NAV_GROUPS.map((group) => group.id));
  });

  it("sorts items inside each group by declared order", () => {
    for (const group of getNavGroups()) {
      const paths = group.items.map((item) => item.to);
      expect(paths.length).toBeGreaterThan(0);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it("gives every nav item a label, icon and role list", () => {
    for (const item of getAllNavItems()) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
      expect(item.roles.length).toBeGreaterThan(0);
    }
  });

  it("never grants a menu entry to a role the route blocks", () => {
    // A menu entry the user can see but not open is a dead end. A route with no
    // explicit roles admits every authenticated user, so nothing can exceed it.
    const bad: string[] = [];
    for (const route of NAV_ROUTES) {
      const routeRoles = route.roles;
      if (!routeRoles) continue;
      const navRoles = route.nav!.roles ?? [];
      const extra = navRoles.filter((role) => !routeRoles.includes(role));
      if (extra.length) {
        bad.push(
          `${route.path} menu grants ${extra.join(",")} but route does not`,
        );
      }
    }
    expect(bad).toEqual([]);
  });

  it("gives every role a reachable home page", () => {
    for (const role of ALL_ROLES) {
      const home = getHomePath(role);
      const route = matchRoute(home);
      expect(route, `no route for ${role} home ${home}`).toBeTruthy();
      expect(
        route!.roles?.includes(normalizeRole(role)),
        `${role} home ${home} does not admit its own role`,
      ).toBe(true);
    }
  });

  it("gives every role a reachable profile page", () => {
    for (const role of ALL_ROLES) {
      const profile = getProfilePath(role);
      expect(matchRoute(profile), `no route for ${role} profile`).toBeTruthy();
    }
  });

  it("keeps the mobile bar within five items per role", () => {
    const items = getMobileNavItems();
    for (const role of ALL_ROLES) {
      const visible = items.filter((item) => item.roles.includes(role));
      expect(
        visible.length,
        `${role} has ${visible.length} mobile items`,
      ).toBeLessThanOrEqual(5);
      expect(visible.length, `${role} has no mobile home`).toBeGreaterThan(0);
    }
  });

  it("exposes only role-filterable command-palette entries", () => {
    for (const entry of getSearchEntries()) {
      expect(entry.roles.length).toBeGreaterThan(0);
    }
    expect(getSearchEntries().length).toBeGreaterThan(0);
  });
});

describe("matchRoute", () => {
  it("resolves static paths", () => {
    expect(matchRoute("/inventory")?.title).toBe("المخزون");
  });

  it("resolves param paths to their pattern", () => {
    expect(matchRoute("/customers/42")?.path).toBe("/customers/:id");
    expect(matchRoute("/customers/abc-123")?.path).toBe("/customers/:id");
  });

  it("tolerates a trailing slash", () => {
    expect(matchRoute("/inventory/")?.path).toBe("/inventory");
  });

  it("prefers a static route over a param route", () => {
    // /inventory/bundles is static and must not be swallowed by /customers/:id
    expect(matchRoute("/inventory/bundles")?.path).toBe("/inventory/bundles");
  });

  it("returns undefined for unknown paths", () => {
    expect(matchRoute("/definitely/not/a/route")).toBeUndefined();
    expect(matchRoute("")).toBeUndefined();
  });
});

describe("permission key resolution", () => {
  it("collapses a param path to its pattern so overrides apply", () => {
    // Regression: hasRoleAccess used to look up permissions["/customers/42"],
    // which never matches the matrix key "/customers/:id", so per-user
    // revocations on detail pages silently did nothing.
    expect(permissionKeyForPath("/customers/42")).toBe("/customers/:id");
    expect(permissionKeyForPath("/customers/999")).toBe("/customers/:id");
  });

  it("keeps static paths as-is", () => {
    expect(permissionKeyForPath("/owner/financial")).toBe("/owner/financial");
  });

  it("falls back to the raw path for unknown routes", () => {
    expect(permissionKeyForPath("/legacy/thing")).toBe("/legacy/thing");
  });
});

describe("page meta", () => {
  it("resolves titles for every registry path", () => {
    for (const route of APP_ROUTES) {
      const meta = resolvePageMeta(route.path);
      expect(meta.title, `no title for ${route.path}`).toBeTruthy();
    }
  });

  it("resolves titles for param routes", () => {
    expect(resolvePageMeta("/customers/7").title).toBe("ملف العميل");
  });

  it("falls back for unknown paths", () => {
    expect(resolvePageMeta("/nope").title).toBe("النظام الإداري المتكامل");
  });

  it("has a title for every page the sidebar can reach", () => {
    for (const item of getAllNavItems()) {
      expect(resolvePageMeta(item.to).title).not.toBe(
        "النظام الإداري المتكامل",
      );
    }
  });
});
