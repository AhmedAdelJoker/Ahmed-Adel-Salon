import confetti from "canvas-confetti";
import {
  normalizeLoyaltySettings,
  tierForVisits,
} from "@/features/loyalty/utils/loyaltyHelpers";
import type { LoyaltyTier } from "@/types/loyalty";
import type { CartItem, POSRecord } from "@/features/pos/types";
import i18n from "@/i18n";
import { currencyLabel } from "@/lib/core/currency";

export const triggerSuccessEffect = (): void => {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#6366f1", "#38bdf8", "#10b981"],
  });
};

/**
 * Single source of truth for "is this shift open?". The status string used to
 * be re-listed (["open","opened","OPEN","OPENED"]) in CheckoutBar and
 * ShiftSidebar verbatim; a new status spelling added on the backend would have
 * to be fixed in two places. Case-insensitive against lowercase forms.
 */
export const isOpenShiftStatus = (
  shift: { status?: string | null } | null | undefined,
): boolean =>
  Boolean(
    shift && ["open", "opened"].includes(String(shift.status || "open").toLowerCase()),
  );

/**
 * The loyalty tier a customer currently belongs to, resolved from their visit
 * count against the owner's configured ladder.
 *
 * The stored `current_tier` string is not used as the key: it holds whatever
 * name the owner gave the tier (and legacy rows still hold "Bronze" while the
 * configured names are Arabic), so matching on it silently produced a badge
 * in the wrong language and a missing discount. `tierForVisits` is the same
 * algorithm the backend applies when it assigns and prices a tier.
 */
export const resolveCustomerTier = (
  customer: POSRecord | null | undefined,
  loyaltySettingsRaw: unknown,
): LoyaltyTier | null => {
  if (!customer) return null;
  const settings = normalizeLoyaltySettings(loyaltySettingsRaw);
  if (!settings.enabled || settings.tiers.length === 0) return null;
  const visits = Number(customer.visits_count ?? customer.visitsCount ?? 0);
  if (!Number.isFinite(visits)) return null;
  return tierForVisits(settings, visits);
};

export interface DiscountAllowance {
  /** "percent" is a share of the subtotal, "fixed" an amount in currency. */
  type: "percent" | "fixed";
  value: number;
  /** The largest discount the cashier may apply without a manager. */
  allowed: number;
  /** Human-readable limit, e.g. "10% من إجمالي الفاتورة". */
  label: string;
}

/**
 * The discount a cashier may apply without a manager's approval.
 *
 * The limit is the owner's setting (`cashier_discount_limit_*`), not a
 * constant: the POS used to hardcode 40%, which had nothing to do with what
 * the server enforces — so the till either blocked a discount the shop allows
 * or let the cashier type one the server refuses. The rule mirrors
 * `app.core.pos.cashier_discount_limit`, including the fact that the type
 * spelling is owner-editable ("percent" and "percentage" both mean a share).
 */
export const cashierDiscountAllowance = (
  businessSettings: POSRecord | null | undefined,
  subtotal: number,
): DiscountAllowance => {
  const rawType = String(
    businessSettings?.cashierDiscountLimitType ??
      businessSettings?.cashier_discount_limit_type ??
      "percent",
  )
    .trim()
    .toLowerCase();
  const rawValue = Number(
    businessSettings?.cashierDiscountLimitValue ??
      businessSettings?.cashier_discount_limit_value ??
      0,
  );
  const value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
  const isPercent = ["percent", "percentage", "pct", "%"].includes(rawType);
  const base = Number.isFinite(Number(subtotal)) ? Math.max(0, Number(subtotal)) : 0;
  const allowed = isPercent ? (base * value) / 100 : value;
  return {
    type: isPercent ? "percent" : "fixed",
    value,
    allowed,
    label: isPercent
      ? i18n.t("pos:logic.discount_limit_percent", { value })
      : `${value} ${currencyLabel(businessSettings?.currency)}`,
  };
};

/**
 * A product-only offer: it bundles products and no services.
 *
 * These are the only offers the manual sale may sell. They are stock-tracked
 * exactly like a product and never attributed to an expert, while the invoice
 * still carries them as a normal `offer` line with its own price.
 */
export const isProductOnlyOffer = (
  offer: POSRecord | null | undefined,
): boolean => {
  if (!offer) return false;
  const products = Array.isArray(offer.offer_products)
    ? offer.offer_products
    : [];
  const services = Array.isArray(offer.services) ? offer.services : [];
  return products.length > 0 && services.length === 0;
};

/**
 * How many whole offers the shelf can currently honour.
 *
 * One offer consumes `line.quantity` units of each of its products, so the
 * limit is the smallest component ratio. A missing component means the offer
 * cannot be assembled at all, which reads as zero rather than infinity.
 */
export const offerAvailableUnits = (
  offer: POSRecord | null | undefined,
  products: POSRecord[] = [],
): number => {
  if (!isProductOnlyOffer(offer)) return 0;

  const lines = (offer as POSRecord).offer_products as POSRecord[];
  let available = Number.POSITIVE_INFINITY;

  for (const line of lines) {
    const lineQty = Number(line.quantity ?? line.qty ?? 0);
    if (!Number.isFinite(lineQty) || lineQty <= 0) return 0;

    const productId = line.product_id ?? line.productId;
    const product = products.find(
      (row) => String(row.id) === String(productId),
    );
    if (!product) return 0;

    const stock = Number(product.quantity ?? product.stock ?? 0);
    if (!Number.isFinite(stock) || stock < 0) return 0;

    available = Math.min(available, Math.floor(stock / lineQty));
  }

  return Number.isFinite(available) ? Math.max(0, available) : 0;
};

/**
 * Whether a cart line must be attributed to an expert.
 *
 * Products and product-only offers come off the shelf; nothing was
 * "performed", so they carry no employee and no commission.
 */
export const cartLineNeedsExpert = (item: {
  type: string;
  isProductOffer?: boolean;
}): boolean =>
  item.type === "service" ||
  (item.type === "offer" && !item.isProductOffer);

/**
 * Build the cart that represents one appointment's services. Used by both
 * loading a queue card (SessionsQueue) and the `/bookings → /pos` handoff, so
 * the two entry points cannot drift apart on field spellings.
 */
export const appointmentToCartItems = (
  appointment: POSRecord | null | undefined,
  barbers: POSRecord[] = [],
  fallbackBarberId: string | number | null = null,
): CartItem[] => {
  if (!appointment) return [];
  const appointmentId =
    appointment.appointment_id || appointment.appointmentId || appointment.id;
  const appointmentBarberId =
    appointment.employee_id ||
    appointment.employeeId ||
    appointment.barber_id ||
    appointment.barberId ||
    "";
  const barber = barbers.find(
    (b) => String(b.id) === String(appointmentBarberId),
  );

  return (appointment.services || []).map((svc: POSRecord) => {
    const serviceId = svc.service_id || svc.serviceId || svc.id;
    return {
      id: serviceId,
      serviceId,
      service_id: serviceId,
      uid: `appointment-${appointmentId}-service-${serviceId}-${Math.random()}`,
      name:
        svc.service_name_snapshot ||
        svc.service_name ||
        svc.serviceName ||
        svc.name ||
        i18n.t("pos:items.service"),
      price: Number(
        svc.price_snapshot ??
          svc.price ??
          svc.unit_price ??
          svc.unitPrice ??
          0,
      ),
      quantity: 1,
      durationMinutes: Number(
        svc.duration_snapshot_minutes ??
          svc.durationSnapshotMinutes ??
          svc.duration_minutes ??
          0,
      ) || undefined,
      type: "service",
      barberId: appointmentBarberId
        ? Number(appointmentBarberId)
        : fallbackBarberId
          ? Number(fallbackBarberId)
          : null,
      barberName:
        barber?.display_name ||
        barber?.displayName ||
        barber?.full_name ||
        barber?.fullName ||
        i18n.t("pos:cart.expert_fallback"),
    };
  });
};
