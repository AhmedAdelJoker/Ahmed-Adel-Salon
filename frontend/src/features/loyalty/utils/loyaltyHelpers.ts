import type { LoyaltySavePayload, LoyaltySettings, LoyaltyTier } from "@/types/loyalty";

/** حدود القيم المسموحة — تُفرض قبل الحفظ لتطابق منطق حساب الخصم في الباك */
export const LOYALTY_LIMITS = {
  discountMax: 30,
  pointsPerEgpMin: 0.01,
  pointsPerEgpMax: 1,
  redemptionMin: 0.1,
  redemptionMax: 2,
} as const;

/** أمثلة المعاينة الحية داخل PreviewCard */
export const LOYALTY_PREVIEW = { amount: 500, visits: 7 } as const;

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: false,
  points_per_egp: 0.1, // 10 جنيه = 1 نقطة
  redemption_rate: 0.5, // 1 نقطة = 0.5 جنيه
  tiers: [
    { name: "برونزي", min_visits: 0, discount_percent: 0, color: "bg-orange-600" },
    { name: "فضي", min_visits: 6, discount_percent: 5, color: "bg-slate-400" },
    { name: "ذهبي", min_visits: 16, discount_percent: 10, color: "bg-amber-400" },
  ],
};

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** يوحّد مفاتيح snake/camel القادمة من الـ API ويتجاهل المفاتيح المجهولة */
export function normalizeLoyaltySettings(raw: unknown): LoyaltySettings {
  const record = (raw ?? {}) as Record<string, unknown>;
  const rawTiers = Array.isArray(record.tiers) ? (record.tiers as Record<string, unknown>[]) : [];
  return {
    enabled: Boolean(record.enabled),
    points_per_egp: toNumber(
      record.points_per_egp ?? record.pointsPerEgp,
      DEFAULT_LOYALTY_SETTINGS.points_per_egp,
    ),
    redemption_rate: toNumber(
      record.redemption_rate ?? record.redemptionRate,
      DEFAULT_LOYALTY_SETTINGS.redemption_rate,
    ),
    tiers: rawTiers
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        name: String(t.name ?? "").trim(),
        min_visits: Math.max(0, Math.floor(toNumber(t.min_visits ?? t.minVisits, 0))),
        discount_percent: toNumber(t.discount_percent ?? t.discountPercent, 0),
        color: String(t.color ?? "") || "bg-accent",
      })),
  };
}

/** حمولة الحفظ الموحدة — snake_case فقط، بلا مفاتيح مهملة مثل milestones */
export function toLoyaltyPayload(settings: LoyaltySettings): LoyaltySavePayload {
  return {
    loyalty_settings: {
      enabled: settings.enabled,
      points_per_egp: toNumber(settings.points_per_egp, DEFAULT_LOYALTY_SETTINGS.points_per_egp),
      redemption_rate: toNumber(settings.redemption_rate, DEFAULT_LOYALTY_SETTINGS.redemption_rate),
      tiers: settings.tiers.map((tier) => ({
        name: String(tier.name ?? "").trim(),
        min_visits: Math.max(0, Math.floor(toNumber(tier.min_visits, 0))),
        discount_percent: toNumber(tier.discount_percent, 0),
        color: tier.color || "bg-accent",
      })),
    },
  };
}

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** يرجع أول رسالة خطأ عربية، أو null إذا كانت الإعدادات صالحة للحفظ */
export function validateLoyaltySettings(settings: LoyaltySettings): string | null {
  if (!settings.tiers.length) return "أضف مستوى عضوية واحداً على الأقل";
  const seen = new Set<string>();
  let prevVisits = -1;
  for (const tier of settings.tiers) {
    const name = tier.name?.trim();
    if (!name) return "أدخل اسماً لكل مستوى";
    if (seen.has(name)) return `يوجد مستويان بنفس الاسم: «${name}»`;
    seen.add(name);
    const visits = Math.floor(Number(tier.min_visits));
    if (!Number.isFinite(visits) || visits < 0) {
      return `الزيارات المطلوبة لـ «${name}» يجب أن تكون رقماً غير سالب`;
    }
    if (visits <= prevVisits) {
      return `الزيارات يجب أن تتزايد: «${name}» (${visits}) أعلى من المستوى السابق (${prevVisits})`;
    }
    prevVisits = visits;
    const discount = Number(tier.discount_percent);
    if (!isInRange(discount, 0, LOYALTY_LIMITS.discountMax)) {
      return `نسبة خصم «${name}» بين 0 و ${LOYALTY_LIMITS.discountMax}%`;
    }
  }
  if (!isInRange(settings.points_per_egp, LOYALTY_LIMITS.pointsPerEgpMin, LOYALTY_LIMITS.pointsPerEgpMax)) {
    return `معدل الاكتساب بين ${LOYALTY_LIMITS.pointsPerEgpMin} و ${LOYALTY_LIMITS.pointsPerEgpMax} نقطة لكل جنيه`;
  }
  if (!isInRange(settings.redemption_rate, LOYALTY_LIMITS.redemptionMin, LOYALTY_LIMITS.redemptionMax)) {
    return `قيمة الاستبدال بين ${LOYALTY_LIMITS.redemptionMin} و ${LOYALTY_LIMITS.redemptionMax} جنيه لكل نقطة`;
  }
  return null;
}

/** نفس منطق الباك (update_customer_loyalty): أعلى مستوى تحققه الزيارات */
export function tierForVisits(settings: LoyaltySettings, visits: number): LoyaltyTier | null {
  const sorted = [...settings.tiers].sort((a, b) => Number(b.min_visits) - Number(a.min_visits));
  return sorted.find((t) => visits >= Number(t.min_visits)) ?? null;
}

export function pointsForAmount(settings: LoyaltySettings, amount: number): number {
  return amount * toNumber(settings.points_per_egp, 0);
}

export function valueForPoints(settings: LoyaltySettings, points: number): number {
  return points * toNumber(settings.redemption_rate, 0);
}
