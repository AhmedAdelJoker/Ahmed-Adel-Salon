export const ROLE_PERMISSIONS = {
  admin: [
    "dashboard",
    "reception",
    "billing",
    "reports",
    "barbers",
    "settings",
    "profile",
    "activity-log",
  ],
  manager: ["dashboard", "reports", "settings", "profile", "activity-log"],
  cashier: ["dashboard", "reception", "billing", "settings", "profile"],
  barber: ["dashboard", "barbers", "settings", "profile"],
};
export function canAccess(role, page) {
  return ROLE_PERMISSIONS[role]?.includes(page);
}
