import confetti from "canvas-confetti";
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
