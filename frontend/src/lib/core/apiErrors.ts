/**
 * Turns any axios/FastAPI rejection into a list of human-readable lines.
 *
 * FastAPI returns 422 as `detail: [{loc, msg, type}, ...]`, and a plain string
 * for business-rule rejections. Showing only the first line hid everything else
 * the server had already told us.
 */
export type ApiErrorLine = { field?: string; message: string };

const FIELD_LABELS: Record<string, string> = {
  working_hours: "ساعات العمل",
  salon_name: "اسم المنشأة",
  shop_phone: "رقم التواصل",
  shop_whatsapp: "الواتساب",
  address: "العنوان",
  receipt_footer: "تذييل الإيصال",
  currency: "العملة",
  logo_url: "الشعار",
  google_maps_url: "رابط الخريطة",
  monthly_revenue_target: "هدف المبيعات الشهري",
  loyalty_settings: "إعدادات الولاء",
  expected_version: "إصدار الإعدادات",
};

const humanize = (raw: string): string => {
  const stripped = raw
    .replace(/^Value error,\s*/i, "")
    .replace(/_/g, " ")
    .trim();
  if (!stripped) return "قيمة غير صالحة";
  if (/^string too (short|long)$/i.test(stripped)) {
    return stripped.toLowerCase().includes("long") ? "القيمة طويلة جداً" : "القيمة قصيرة جداً";
  }
  if (/field required/i.test(stripped)) return "حقل مطلوب";
  if (/^input should be a valid/i.test(stripped)) return "صيغة غير صالحة";
  return stripped;
};

const labelFor = (loc: unknown): string | undefined => {
  if (!Array.isArray(loc)) return undefined;
  const parts = loc.filter((p) => p !== "body" && typeof p === "string");
  if (!parts.length) return undefined;
  const key = parts[parts.length - 1];
  return FIELD_LABELS[key] ?? key;
};

export const isConflict = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 409;
};

export const toErrorLines = (error: unknown, fallback: string): ApiErrorLine[] => {
  const response = (error as { response?: { data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return [{ message: detail.trim() }];
  }

  if (Array.isArray(detail) && detail.length) {
    const lines = detail
      .map((entry) => {
        if (entry && typeof entry === "object") {
          const record = entry as { msg?: unknown; message?: unknown; loc?: unknown };
          const raw =
            typeof record.msg === "string"
              ? record.msg
              : typeof record.message === "string"
                ? record.message
                : "";
          if (!raw) return null;
          return { field: labelFor(record.loc), message: humanize(raw) };
        }
        if (typeof entry === "string" && entry.trim()) {
          return { message: humanize(entry) };
        }
        return null;
      })
      .filter((line): line is ApiErrorLine => line !== null);

    const deduped = lines.filter(
      (line, index) =>
        lines.findIndex(
          (other) => other.field === line.field && other.message === line.message,
        ) === index,
    );
    if (deduped.length) return deduped;
  }

  if (error instanceof Error && error.message) {
    const message = error.message.replace(/^Request failed with status code \d+$/i, "").trim();
    if (message && !/^Request failed/i.test(message)) {
      return [{ message }];
    }
  }

  return [{ message: fallback }];
};

export const errorHeadline = (lines: ApiErrorLine[], fallback: string): string => {
  if (!lines.length) return fallback;
  const [first] = lines;
  if (lines.length === 1) return first.message;
  return `${first.message} (+${lines.length - 1} خطأ آخر)`;
};
