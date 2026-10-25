import confetti from "canvas-confetti";
import {
  normalizeLoyaltySettings,
  tierForVisits,
} from "@/features/loyalty/utils/loyaltyHelpers";
import type { LoyaltyTier } from "@/types/loyalty";
import type { CartItem, POSRecord } from "@/features/pos/types";

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
        "خدمة",
      price: Number(
        svc.price_snapshot ??
          svc.price ??
          svc.unit_price ??
          svc.unitPrice ??
          0,
      ),
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
        "الخبير",
    };
  });
};
