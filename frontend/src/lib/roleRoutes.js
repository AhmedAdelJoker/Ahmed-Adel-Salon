const ROLE_HOME_PATHS = {
  OWNER: "/owner",
  ADMIN: "/owner",
  MANAGER: "/manager",
  CASHIER: "/cashier",
  BARBER: "/barber",
};

const ROLE_ALIASES = {
  SUPER_ADMIN: "ADMIN",
  SUPERADMIN: "ADMIN",
  OWNER_USER: "OWNER",
  MANAGER_USER: "MANAGER",
  CASHIER_USER: "CASHIER",
  BARBER_USER: "BARBER",
};

export function normalizeRole(role) {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();
  return ROLE_ALIASES[normalized] || normalized;
}

export function hasRoleAccess(user, allowedRoles = [], pagePath = null) {
  if (!user) return false;

  // Support both user object and role string
  const isObject = typeof user === "object";
  const role = isObject ? user.role : user;
  const permissions = isObject ? (user.permissions || {}) : {};
  
  // 1. If there's an explicit permission for this pagePath, it takes precedence
  if (pagePath && permissions[pagePath] !== undefined) {
    return permissions[pagePath] === true;
  }

  const normalizedRole = normalizeRole(role);

  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }

  return allowedRoles.some((item) => normalizeRole(item) === normalizedRole);
}

export function filterByRole(items = [], user) {
  if (!user) return [];
  return Array.isArray(items)
    ? items.filter((item) => hasRoleAccess(user, item.roles, item.to))
    : [];
}

export function getHomePath(role) {
  return ROLE_HOME_PATHS[normalizeRole(role)] || "/login";
}

export function getProfilePath(role) {
  return "/settings";
}

export function getSettingsPath(role) {
  return hasRoleAccess(role, ["OWNER", "ADMIN"]) ? "/owner/settings" : null;
}

export function getServicesPath(role) {
  return hasRoleAccess(role, ["OWNER", "ADMIN"])
    ? "/owner/settings?tab=services"
    : null;
}

export function isOwnerLike(role) {
  return hasRoleAccess(role, ["OWNER", "ADMIN"]);
}

export function isManagementLike(role) {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER"]);
}

export { ROLE_HOME_PATHS };
