import { permissionKeyForPath } from "@/app/route-registry";

const ROLE_HOME_PATHS: Record<string, string> = {
  OWNER: "/owner",
  ADMIN: "/owner",
  MANAGER: "/manager",
  CASHIER: "/cashier",
  BARBER: "/barber",
  ACCOUNTANT: "/accountant",
};

const ROLE_ALIASES: Record<string, string> = {
  SUPER_ADMIN: "ADMIN",
  SUPERADMIN: "ADMIN",
  OWNER_USER: "OWNER",
  MANAGER_USER: "MANAGER",
  CASHIER_USER: "CASHIER",
  BARBER_USER: "BARBER",
};

export function normalizeRole(role: unknown): string {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();
  return ROLE_ALIASES[normalized] || normalized;
}

export function hasRoleAccess(user: any, allowedRoles: any[] = [], pagePath: string | null = null): boolean {
  if (!user) return false;

  // Support both user object and role string
  const isObject = typeof user === "object";
  const role = isObject ? user.role : user;
  const permissions = isObject ? user.permissions || {} : {};

  // 1. If there's an explicit permission for this page, it takes precedence.
  //    The key is resolved through the route registry so a param route looks up
  //    its pattern ("/customers/:id") instead of the live path
  //    ("/customers/42"). Without this, per-user revocations on any detail page
  //    were stored but never applied.
  if (pagePath) {
    const key = permissionKeyForPath(pagePath);
    if (permissions[key] !== undefined) {
      return permissions[key] === true;
    }
    // Fall back to the raw key for server-defined permissions that predate the
    // registry, and to the pattern when the live path is a known route.
    if (key !== pagePath && permissions[pagePath] !== undefined) {
      return permissions[pagePath] === true;
    }
  }

  const normalizedRole = normalizeRole(role);

  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }

  return allowedRoles.some((item) => normalizeRole(item) === normalizedRole);
}

export function getHomePath(role: unknown): string {
  return ROLE_HOME_PATHS[normalizeRole(role)] || "/login";
}

export function getProfilePath(role: unknown): string {
  return "/settings";
}

export function getSettingsPath(role: unknown): string | null {
  return hasRoleAccess(role, ["OWNER", "ADMIN"]) ? "/owner/settings" : null;
}

export function getServicesPath(role: unknown): string | null {
  return hasRoleAccess(role, ["OWNER", "ADMIN"])
    ? "/owner/settings?tab=services"
    : null;
}

export function isOwnerLike(role: unknown): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN"]);
}

export function isManagementLike(role: unknown): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER"]);
}

export { ROLE_HOME_PATHS };
