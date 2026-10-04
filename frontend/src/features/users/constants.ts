import { getPermissionPages } from "@/app/route-registry";

/**
 * Rows shown in the permissions matrix.
 *
 * Derived from the route registry so a new page cannot be added to the router
 * without also becoming grantable per user. The previous hand-written list had
 * drifted and was missing seventeen menu pages.
 */
export const PERMISSION_PAGES = getPermissionPages();

export const DEFAULT_ROLE_PERMISSIONS: Record<string, (id: string) => boolean> = {
  OWNER: () => true,
  ADMIN: () => true,
  MANAGER: (id) =>
    ["/manager","/attendance","/approvals","/pos","/bookings","/reception-board","/schedule","/customers","/customers/:id","/owner/customers/archive","/inventory","/inventory/archive","/inventory/bundles","/invoices","/invoices/archive","/expenses","/activity-logs","/owner/security-access","/owner/hr","/owner/hr/archive","/owner/working-hours","/owner/loyalty-settings","/owner/reports","/owner/payroll","/owner/payroll/archive","/owner/adjustment-requests","/owner/expenses/archive","/expenses/archive","/profile","/settings"].some((p) => id.startsWith(p)),
  CASHIER: (id) =>
    ["/cashier","/pos","/bookings","/reception-board","/schedule","/customers","/inventory","/inventory/archive","/inventory/bundles","/invoices","/invoices/archive","/expenses","/owner/cashbox","/expenses/archive","/profile","/settings"].some((p) => id.startsWith(p)),
  ACCOUNTANT: (id) =>
    ["/accountant","/attendance","/inventory","/inventory/archive","/expenses","/expenses/archive","/owner/expenses/archive","/invoices/archive","/owner/customers/archive","/owner/financial","/owner/reports","/owner/daily-summary","/owner/employee-reports","/owner/payroll","/owner/payroll/archive","/owner/cashbox","/owner/adjustment-requests","/activity-logs","/profile","/settings"].some((p) => id.startsWith(p)),
  BARBER: (id) =>
    ["/barber","/barber/workstation","/barber/clients","/barber/earnings","/barber/availability","/barber/profile","/barber/bookings","/bookings","/schedule","/reception-board","/profile","/settings"].some((p) => id.startsWith(p)),
};
