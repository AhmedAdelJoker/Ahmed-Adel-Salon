import { DEFAULT_SECURITY_SETTINGS, SECURITY_SETTINGS_STORAGE_KEY } from "./constants";

export const riskKeywords =
  /delete|cancel|refund|discount|permission|login|failed|export|import|invoice|shift/i;

export function asArray(response: any) {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "---";
  try {
    return new Date(value).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    return String(value);
  }
}

export function getUserName(user: any) {
  return (
    user?.full_name ||
    user?.fullName ||
    user?.display_name ||
    user?.username ||
    user?.email ||
    "مستخدم غير محدد"
  );
}

export function getRole(user: any) {
  return user?.role || user?.role_name || user?.roleName || "user";
}

export function getId(item: any) {
  return (
    item?.id ||
    item?.user_id ||
    item?.userId ||
    item?.employee_id ||
    item?.employeeId
  );
}

export function sanitizeSecuritySettings(input: Record<string, any> = {}) {
  const merged = {
    ...DEFAULT_SECURITY_SETTINGS,
    ...(input && typeof input === "object" ? input : {}),
  };

  return {
    ...merged,
    sessionTimeoutMinutes: Math.max(
      5,
      Number(
        merged.sessionTimeoutMinutes ??
          DEFAULT_SECURITY_SETTINGS.sessionTimeoutMinutes,
      ) || DEFAULT_SECURITY_SETTINGS.sessionTimeoutMinutes,
    ),
    maxFailedLoginAttempts: Math.max(
      1,
      Number(
        merged.maxFailedLoginAttempts ??
          DEFAULT_SECURITY_SETTINGS.maxFailedLoginAttempts,
      ) || DEFAULT_SECURITY_SETTINGS.maxFailedLoginAttempts,
    ),
  };
}

export function readStoredSecuritySettings() {
  try {
    const raw = localStorage.getItem(SECURITY_SETTINGS_STORAGE_KEY);
    return raw
      ? sanitizeSecuritySettings(JSON.parse(raw))
      : sanitizeSecuritySettings(DEFAULT_SECURITY_SETTINGS);
  } catch (err) {
    return sanitizeSecuritySettings(DEFAULT_SECURITY_SETTINGS);
  }
}

export async function captureRequest(request: Promise<any>) {
  try {
    const response = await request;
    return { ok: true, response } as const;
  } catch (error) {
    return { ok: false, error } as const;
  }
}
