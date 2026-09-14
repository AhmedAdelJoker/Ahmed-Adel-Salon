export const DEFAULT_SECURITY_SETTINGS = {
  enforceStrongPasswords: true,
  requireShiftForSales: true,
  lockClosedShiftEdits: true,
  enableActivityLogs: true,
  restrictExportsToManagers: true,
  requireDiscountApproval: true,
  sessionTimeoutMinutes: 60,
  maxFailedLoginAttempts: 5,
};

export const SECURITY_SETTINGS_STORAGE_KEY = "security.access.settings";

export const ROLE_LABELS: Record<string, string> = {
  owner: "مالك النظام",
  admin: "مدير النظام",
  manager: "مدير",
  cashier: "كاشير",
  barber: "خبير",
  user: "مستخدم",
};

export const DEFAULT_SECURITY_SYNC_STATUS = {
  settingsSource: "local" as "server" | "local",
  sessionsAvailable: false,
  usersAvailable: false,
  logsAvailable: false,
  lastMessage: "",
};
