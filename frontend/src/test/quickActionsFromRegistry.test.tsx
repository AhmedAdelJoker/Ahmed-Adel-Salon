import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The quick-action grid listed eight destinations as a hand-written array:
 *
 *     const items = [
 *       { label: "الموظفين", icon: Users, to: "/owner/hr", ... },
 *       { label: "الخدمات", to: "/owner/settings?tab=services", ... },
 *       ...
 *     ];
 *
 * A second copy of the navigation, sitting next to the sidebar which already
 * had the authoritative list in the route registry. The two were free to
 * disagree, and the grid was the one nobody thought to update: rename a route in
 * the registry and the sidebar follows, while the grid keeps pointing at the old
 * path under a label nothing else in the product uses.
 *
 * Two of the old entries were also unreachable-by-accident rather than by
 * design -- `/owner/settings?tab=services` is a query-string variant the
 * registry does not model as a route at all, so it could never have been
 * generated.
 *
 * The grid is now driven by a `quick` flag on the registry's nav specs, and
 * filtered with the same `hasRoleAccess` call the sidebar uses.
 */
const mockUser: { current: unknown } = { current: null };

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

const importQuickActions = async () => {
  const mod = await import("@/features/reports-dashboard/components/QuickActions");
  return mod.QuickActions;
};

let QuickActions: any;

describe("quick actions come from the route registry", () => {
  beforeEach(async () => {
    vi.resetModules();
    QuickActions = await importQuickActions();
    mockUser.current = { full_name: "Owner", role: "OWNER" };
  });

  it("declares no paths of its own", async () => {
    // The strongest form of the property: this file must not contain a route
    // path at all. If someone adds one back, this fails rather than silently
    // creating a second source of truth.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/features/reports-dashboard/components/QuickActions.tsx",
      ),
      "utf8",
    );

    const paths = source.match(/["'`]\/[a-z][^"'`]*["'`]/gi) ?? [];
    expect(paths, `hardcoded path(s) in QuickActions: ${paths.join(", ")}`).toEqual(
      [],
    );
  });

  it("renders the routes the registry flags as quick", async () => {
    const { getQuickNavItems } = await import("@/app/route-registry");
    const expected = getQuickNavItems();

    expect(expected.length).toBeGreaterThan(0);

    render(<QuickActions onNavigate={vi.fn()} />);

    for (const item of expected) {
      expect(screen.getByText(item.label), item.label).toBeTruthy();
    }
  });

  it("covers the daily operations it used to cover", async () => {
    // The old hand-written list, as a set of destinations. Losing one silently
    // would be a real regression, so they are pinned rather than left to the
    // registry flag alone.
    const { getQuickNavItems } = await import("@/app/route-registry");
    const paths = new Set(getQuickNavItems().map((i) => i.to));

    for (const path of [
      "/owner/hr",
      "/owner/reports",
      "/inventory",
      "/bookings",
      "/owner/settings",
      "/owner/security-access",
      "/activity-logs",
    ]) {
      expect(paths.has(path), `${path} is no longer a quick action`).toBe(true);
    }
  });

  it("navigates to the registry path, not a hand-written one", async () => {
    const onNavigate = vi.fn();
    const { getQuickNavItems } = await import("@/app/route-registry");
    const [first] = getQuickNavItems();

    render(<QuickActions onNavigate={onNavigate} />);
    screen.getByText(first.label).closest("button")?.click();

    expect(onNavigate).toHaveBeenCalledWith(first.to);
  });

  it("gives every entry a unique key", async () => {
    // React duplicate-key warnings are easy to miss in a test run and produce
    // state bleeding between rows rather than a visible failure.
    const { getQuickNavItems } = await import("@/app/route-registry");
    const keys = getQuickNavItems().map((i) => i.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("hides the grid rather than showing an empty one", async () => {
    // Mocked rather than monkeypatched: module exports are getter-only.
    vi.resetModules();
    vi.doMock("@/app/route-registry", () => ({
      getQuickNavItems: () => [],
    }));

    const Fresh = await import(
      "@/features/reports-dashboard/components/QuickActions"
    );

    const { container } = render(<Fresh.QuickActions onNavigate={vi.fn()} />);
    expect(container.textContent ?? "").not.toContain("وصول سريع");

    vi.doUnmock("@/app/route-registry");
  });
});