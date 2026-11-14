/**
 * Appointment status vocabulary, shared by the barber dashboard, the bookings
 * list and the workstation.
 *
 * ## Why this is one module and not three
 *
 * The status maps were duplicated in four places (`useBarberBookings`,
 * `BarberSchedule`, `WorkStationHeader`, and inline conditionals in `QueueTab`),
 * and the status *buttons* were duplicated in more. That produced a real
 * behavioural fork, not just a maintenance cost:
 *
 * - `waiting -> in-service` was reachable from three places
 * - `in-service -> completed` was reachable from five
 *
 * and the dashboard/bookings copies fired the mutation immediately, while the
 * workstation copy routed through a confirmation dialog. Two screens, one
 * endpoint, two different amounts of care.
 *
 * ## The transition table mirrors the backend
 *
 * `_BARBER_TRANSITIONS` in `backend/app/api/v1/endpoints/barber.py` is the
 * authority. This is a copy of it, and the UI must offer exactly what the API
 * will accept -- otherwise the button renders, the barber taps it, and the
 * server answers 409. If you change one, change the other:
 *
 *     pending            -> in-service, waiting, confirmed, cancelled, no_show
 *     confirmed          -> in-service, waiting, cancelled, no_show
 *     waiting            -> in-service, confirmed, cancelled, no_show
 *     in-service         -> ready_for_payment, cancelled
 *     in_progress        -> ready_for_payment, cancelled
 *     ready_for_payment  -> (terminal)
 *     completed          -> (terminal)
 *     done               -> (terminal)
 *     cancelled          -> (terminal)
 *     no_show            -> (terminal)
 */

export type StatusVariant =
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "outline"
  | "secondary";

export const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  waiting: "في الانتظار",
  "in-service": "قيد الخدمة",
  in_progress: "قيد التنفيذ",
  ready_for_payment: "بانتظار الدفع",
  completed: "مكتمل",
  done: "منتهي",
  cancelled: "ملغي",
  no_show: "لم يحضر",
};

export const STATUS_VARIANTS: Record<string, StatusVariant> = {
  pending: "secondary",
  confirmed: "info",
  waiting: "warning",
  "in-service": "info",
  in_progress: "info",
  ready_for_payment: "success",
  completed: "success",
  done: "success",
  cancelled: "danger",
  no_show: "danger",
};

/** Canonical statuses, matching `KNOWN_APPOINTMENT_STATUSES`. */
export const KNOWN_STATUSES = Object.keys(STATUS_LABELS);

/** What a barber may move each status to. Mirrors `_BARBER_TRANSITIONS`. */
export const BARBER_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["in-service", "waiting", "confirmed", "cancelled", "no_show"],
  confirmed: ["in-service", "waiting", "cancelled", "no_show"],
  waiting: ["in-service", "confirmed", "cancelled", "no_show"],
  "in-service": ["ready_for_payment", "cancelled"],
  in_progress: ["ready_for_payment", "cancelled"],
  ready_for_payment: [],
  completed: [],
  done: [],
  cancelled: [],
  no_show: [],
};

/**
 * The API accepts `completed` as an alias and stores `ready_for_payment`: the
 * barber taps "finish" and the shop moves the row into the POS queue.
 */
export function canonicalStatus(status: string | null | undefined): string {
  if (!status) return "pending";
  return status === "completed" ? "ready_for_payment" : status;
}

export function allowedTransitions(
  status: string | null | undefined,
): readonly string[] {
  return BARBER_TRANSITIONS[canonicalStatus(status)] ?? [];
}

/** Terminal statuses have no actions, so the UI renders a badge instead. */
export function isTerminal(status: string | null | undefined): boolean {
  return allowedTransitions(status).length === 0;
}

export function statusLabel(status: string | null | undefined): string {
  const key = canonicalStatus(status);
  return STATUS_LABELS[key] ?? key;
}

export function statusVariant(
  status: string | null | undefined,
): StatusVariant {
  const key = canonicalStatus(status);
  return STATUS_VARIANTS[key] ?? "secondary";
}

/**
 * The one place a status-change failure becomes a sentence a barber can act on.
 *
 * Before the state machine existed the endpoint answered 200 to anything, so the
 * UI only ever had one error to say -- "try again" -- and had no idea which
 * failures were even possible. Now there are three distinct ones, and "try again"
 * is actively misleading for two of them:
 *
 * - 422: the status is not a real one. Retrying sends the same bad value.
 * - 409: the move is not legal from here. Retrying sends the same illegal move,
 *   and the usual cause is that someone else (the cashier, the reception desk,
 *   another tab) already advanced the appointment.
 * - anything else: a genuine transient failure, where retrying is right.
 */
export function statusChangeMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const detail = String(
    (error as { response?: { data?: { detail?: unknown } } })?.response?.data
      ?.detail ?? "",
  );

  if (status === 409) {
    // The backend already lists what *is* allowed, in the detail string:
    //
    //   "لا يمكن الانتقال من 'X' إلى 'Y'. المسموح: in-service, cancelled"
    //
    // The marker is Arabic, so matching an English `allowed:` here would never
    // fire against the real API and every 409 would fall through to the generic
    // sentence. Both markers are accepted; the Arabic one is the live one.
    const allowed = detail.match(/(?:المسموح|allowed)\s*:\s*(.+)$/i)?.[1];
    if (allowed && allowed.trim()) {
      return `هذه الخطوة غير متاحة الآن. المسموح: ${allowed.trim()}`;
    }
    return "هذه الخطوة غير متاحة من الحالة الحالية. حدّث الصفحة وحاول مجدداً.";
  }

  if (status === 422) {
    return "قيمة الحالة غير معروفة.";
  }

  return "تعذر تحديث الحالة. أعد المحاولة.";
}