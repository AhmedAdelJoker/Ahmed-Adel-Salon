import { getPermissionPages } from "@/app/route-registry";

/**
 * Rows shown in the permissions matrix.
 *
 * Derived from the route registry so a new page cannot be added to the router
 * without also becoming grantable per user. The previous hand-written list had
 * drifted and was missing seventeen menu pages.
 */
export const PERMISSION_PAGES = getPermissionPages();

/**
 * Default permission grants per role, as data.
 *
 * These are *policy*, not a mirror of the registry: a manager may legitimately
 * be denied `/owner/payroll` even though the route exists. So this is not
 * derived. But it used to live inside four closures, where a path could be
 * renamed or deleted in the registry and the entry here would carry on
 * matching nothing -- a grant that silently stopped being granted, with no
 * signal anywhere. The comment above `PERMISSION_PAGES` records that exact
 * drift happening to a sibling list: seventeen pages went missing before
 * anyone looked.
 *
 * Exposed as data so `defaultRolePermissions.test.ts` can check every path
 * still resolves to a real route. The policy stays hand-written; what is
 * machine-checked is that none of it has gone stale.
 *
 * Prefix matching is deliberate and load-bearing: `/owner/hr` covers
 * `/owner/hr/archive`, and `/inventory` covers `/inventory/bundles`. That is why
 * these are prefixes and not exact keys.
 */
export const DEFAULT_ROLE_PERMISSION_PATHS: Record<string, string[]> = {
  OWNER: [],
  ADMIN: [],
  MANAGER: [
    "/manager",
    "/attendance",
    "/approvals",
    "/pos",
    "/bookings",
    "/reception-board",
    "/schedule",
    "/customers",
    "/customers/:id",
    "/owner/customers/archive",
    "/inventory",
    "/inventory/archive",
    "/inventory/bundles",
    "/invoices",
    "/invoices/archive",
    "/expenses",
    "/activity-logs",
    "/owner/security-access",
    "/owner/hr",
    "/owner/hr/archive",
    "/owner/working-hours",
    "/owner/loyalty-settings",
    "/owner/reports",
    "/owner/payroll",
    "/owner/payroll/archive",
    "/owner/adjustment-requests",
    "/owner/expenses/archive",
    "/expenses/archive",
    "/profile",
    "/settings",
  ],
  CASHIER: [
    "/cashier",
    "/pos",
    "/bookings",
    "/reception-board",
    "/schedule",
    "/customers",
    "/inventory",
    "/inventory/archive",
    "/inventory/bundles",
    "/invoices",
    "/invoices/archive",
    "/expenses",
    "/owner/cashbox",
    "/expenses/archive",
    "/profile",
    "/settings",
  ],
  ACCOUNTANT: [
    "/accountant",
    "/attendance",
    "/inventory",
    "/inventory/archive",
    "/expenses",
    "/expenses/archive",
    "/owner/expenses/archive",
    "/invoices/archive",
    "/owner/customers/archive",
    "/owner/financial",
    "/owner/reports",
    "/owner/daily-summary",
    "/owner/employee-reports",
    "/owner/payroll",
    "/owner/payroll/archive",
    "/owner/cashbox",
    "/owner/adjustment-requests",
    "/activity-logs",
    "/profile",
    "/settings",
  ],
  BARBER: [
    "/barber",
    "/barber/workstation",
    "/barber/clients",
    "/barber/earnings",
    "/barber/availability",
    "/barber/profile",
    "/barber/bookings",
    "/bookings",
    "/schedule",
    "/reception-board",
    "/profile",
    "/settings",
  ],
};

/**
 * OWNER and ADMIN get everything, so their grant is not a path list at all. The
 * empty arrays above record that as "no restriction", which is the same fact a
 * reader has to infer from a function body today.
 */
export const UNRESTRICTED_ROLES = new Set(["OWNER", "ADMIN"]);

export const DEFAULT_ROLE_PERMISSIONS: Record<string, (id: string) => boolean> =
  Object.fromEntries(
    Object.entries(DEFAULT_ROLE_PERMISSION_PATHS).map(([role, paths]) => [
      role,
      UNRESTRICTED_ROLES.has(role)
        ? () => true
        : (id: string) => paths.some((p) => id.startsWith(p)),
    ]),
  );
