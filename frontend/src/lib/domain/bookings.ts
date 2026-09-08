// ═══════════════════════════════════════════════════════════════
// BOOKING STATUS CONSTANTS — Single Source of Truth
// ═══════════════════════════════════════════════════════════════

// Re-export calculateEndTime for convenience
export { calculateEndTime } from "@/lib/format/date";

// Raw statuses as stored in the database
export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  WAITING: "waiting",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  READY_FOR_PAYMENT: "ready_for_payment",
  DONE: "done",
  CANCELLED: "cancelled",
  AUTO_CANCELLED: "auto_cancelled",
};

// Grouped status categories for filtering
export const STATUS_GROUPS = {
  SCHEDULING: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED],
  ACTIVE: [BOOKING_STATUS.WAITING, BOOKING_STATUS.IN_PROGRESS],
  RECEPTION: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.READY_FOR_PAYMENT],
  CLOSED: [BOOKING_STATUS.DONE],
  CANCELLED: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.AUTO_CANCELLED],
};

// All active statuses (not cancelled, not done)
export const ACTIVE_STATUSES = [
  ...STATUS_GROUPS.SCHEDULING,
  ...STATUS_GROUPS.ACTIVE,
  ...STATUS_GROUPS.RECEPTION,
];

// Unified status configuration with labels, colors, and display info
export const STATUS_CONFIG = {
  [BOOKING_STATUS.PENDING]: {
    key: "PENDING",
    raw: "pending",
    label: "قيد المراجعة",
    labelEn: "Pending",
    variant: "info",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    ring: "ring-blue-500/30",
    dot: "bg-blue-500",
    group: "scheduling",
    order: 1,
  },
  [BOOKING_STATUS.CONFIRMED]: {
    key: "CONFIRMED",
    raw: "confirmed",
    label: "مؤكد",
    labelEn: "Confirmed",
    variant: "warning",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    ring: "ring-amber-500/30",
    dot: "bg-amber-500",
    group: "scheduling",
    order: 2,
  },
  [BOOKING_STATUS.WAITING]: {
    key: "WAITING",
    raw: "waiting",
    label: "بانتظار الخدمة",
    labelEn: "Waiting",
    variant: "info",
    color: "text-blue-600",
    bg: "bg-blue-600/10",
    border: "border-blue-600/20",
    ring: "ring-blue-600/30",
    dot: "bg-blue-600",
    group: "active",
    order: 3,
  },
  [BOOKING_STATUS.IN_PROGRESS]: {
    key: "IN_PROGRESS",
    raw: "in_progress",
    label: "قيد التنفيذ",
    labelEn: "In Progress",
    variant: "accent",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    ring: "ring-indigo-500/30",
    dot: "bg-indigo-500",
    group: "active",
    order: 4,
  },
  [BOOKING_STATUS.COMPLETED]: {
    key: "COMPLETED",
    raw: "completed",
    label: "مكتمل - مراجعة",
    labelEn: "Completed - Review",
    variant: "success",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    ring: "ring-emerald-500/30",
    dot: "bg-emerald-500",
    group: "reception",
    order: 5,
  },
  [BOOKING_STATUS.READY_FOR_PAYMENT]: {
    key: "READY_FOR_PAYMENT",
    raw: "ready_for_payment",
    label: "جاهز للدفع",
    labelEn: "Ready for Payment",
    variant: "success",
    color: "text-emerald-600",
    bg: "bg-emerald-600/10",
    border: "border-emerald-600/20",
    ring: "ring-emerald-600/30",
    dot: "bg-emerald-600",
    group: "reception",
    order: 6,
  },
  [BOOKING_STATUS.DONE]: {
    key: "DONE",
    raw: "done",
    label: "مكتمل",
    labelEn: "Done",
    variant: "secondary",
    color: "text-slate-400",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    ring: "ring-slate-400/30",
    dot: "bg-slate-400",
    group: "closed",
    order: 7,
  },
  [BOOKING_STATUS.CANCELLED]: {
    key: "CANCELLED",
    raw: "cancelled",
    label: "ملغي",
    labelEn: "Cancelled",
    variant: "danger",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    ring: "ring-rose-500/30",
    dot: "bg-rose-500",
    group: "cancelled",
    order: 8,
  },
  [BOOKING_STATUS.AUTO_CANCELLED]: {
    key: "AUTO_CANCELLED",
    raw: "auto_cancelled",
    label: "ملغي تلقائياً",
    labelEn: "Auto Cancelled",
    variant: "danger",
    color: "text-rose-400",
    bg: "bg-rose-400/10",
    border: "border-rose-400/20",
    ring: "ring-rose-400/30",
    dot: "bg-rose-400",
    group: "cancelled",
    order: 9,
  },
};

// Canonical status normalization: maps any raw/variant status to canonical form
const NORMALIZE_MAP = {
  // From raw DB values
  pending: BOOKING_STATUS.PENDING,
  confirmed: BOOKING_STATUS.CONFIRMED,
  waiting: BOOKING_STATUS.WAITING,
  in_progress: BOOKING_STATUS.IN_PROGRESS,
  completed: BOOKING_STATUS.COMPLETED,
  ready_for_payment: BOOKING_STATUS.READY_FOR_PAYMENT,
  done: BOOKING_STATUS.DONE,
  cancelled: BOOKING_STATUS.CANCELLED,
  auto_cancelled: BOOKING_STATUS.AUTO_CANCELLED,
  // Legacy/variant forms
  PENDING: BOOKING_STATUS.PENDING,
  SCHEDULED: BOOKING_STATUS.PENDING,
  CONFIRMED: BOOKING_STATUS.CONFIRMED,
  WAITING: BOOKING_STATUS.WAITING,
  IN_PROGRESS: BOOKING_STATUS.IN_PROGRESS,
  COMPLETED: BOOKING_STATUS.COMPLETED,
  READY_FOR_PAYMENT: BOOKING_STATUS.READY_FOR_PAYMENT,
  DONE: BOOKING_STATUS.DONE,
  CANCELLED: BOOKING_STATUS.CANCELLED,
  AUTO_CANCELLED: BOOKING_STATUS.AUTO_CANCELLED,
  // POS bridge variants (map to canonical)
  "in-service": BOOKING_STATUS.IN_PROGRESS,
  ready_for_pos: BOOKING_STATUS.READY_FOR_PAYMENT,
  paid: BOOKING_STATUS.DONE,
  invoiced: BOOKING_STATUS.DONE,
  closed: BOOKING_STATUS.DONE,
  // Board-specific labels
  AT_RECEPTION: BOOKING_STATUS.COMPLETED,
  AT_CASHIER: BOOKING_STATUS.READY_FOR_PAYMENT,
  ACTIVE_BOARD: BOOKING_STATUS.WAITING,
};

/**
 * Normalize any status string to canonical form.
 * @param {string|null} status - Raw status from DB or UI
 * @returns {string} Canonical status (BOOKING_STATUS value)
 */
export function normalizeStatus(status) {
  const value = String(status || "")
    .toLowerCase()
    .trim();
  return (
    NORMALIZE_MAP[value] || NORMALIZE_MAP[String(status || "").trim()] || value
  );
}

/**
 * Get status config for display purposes.
 * @param {string|null} status - Raw or canonical status
 * @returns {object} Status config with label, color, bg, etc.
 */
export function getStatusConfig(status) {
  const canonical = normalizeStatus(status);
  return (
    STATUS_CONFIG[canonical] || {
      key: "UNKNOWN",
      raw: status,
      label: status || "غير معروف",
      labelEn: "Unknown",
      variant: "outline",
      color: "text-slate-400",
      bg: "bg-slate-400/10",
      border: "border-slate-400/20",
      ring: "ring-slate-400/30",
      dot: "bg-slate-400",
      group: "unknown",
      order: 99,
    }
  );
}

/**
 * Check if a status belongs to a specific group.
 * @param {string} status - Raw or canonical status
 * @param {string} group - Group name: 'scheduling', 'active', 'reception', 'closed', 'cancelled'
 */
export function isStatusInGroup(status, group) {
  const canonical = normalizeStatus(status);
  const config = STATUS_CONFIG[canonical];
  return config?.group === group;
}

/**
 * Get all statuses in a group.
 * @param {string} group - Group name
 */
export function getStatusesByGroup(group) {
  return Object.values(STATUS_CONFIG).filter(
    (config) => config.group === group,
  );
}

/**
 * Check if status is cancellable (can be cancelled by user action).
 */
export function isCancellable(status) {
  const canonical = normalizeStatus(status);
  return [
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.WAITING,
  ].includes(canonical);
}

/**
 * Check if status is active (not closed, not cancelled).
 */
export function isActive(status) {
  const canonical = normalizeStatus(status);
  return ACTIVE_STATUSES.includes(canonical);
}

/**
 * Check if status is terminal (done or cancelled).
 */
export function isTerminal(status) {
  const canonical = normalizeStatus(status);
  return (
    canonical === BOOKING_STATUS.DONE ||
    canonical === BOOKING_STATUS.CANCELLED ||
    canonical === BOOKING_STATUS.AUTO_CANCELLED
  );
}

/**
 * Get the next logical status transitions for a given status.
 * @param {string} currentStatus
 * @returns {string[]} Array of valid next statuses
 */
export function getValidTransitions(currentStatus) {
  const canonical = normalizeStatus(currentStatus);
  const transitions = {
    [BOOKING_STATUS.PENDING]: [
      BOOKING_STATUS.CONFIRMED,
      BOOKING_STATUS.WAITING,
      BOOKING_STATUS.CANCELLED,
    ],
    [BOOKING_STATUS.CONFIRMED]: [
      BOOKING_STATUS.WAITING,
      BOOKING_STATUS.CANCELLED,
    ],
    [BOOKING_STATUS.WAITING]: [
      BOOKING_STATUS.IN_PROGRESS,
      BOOKING_STATUS.CANCELLED,
    ],
    [BOOKING_STATUS.IN_PROGRESS]: [
      BOOKING_STATUS.COMPLETED,
      BOOKING_STATUS.CANCELLED,
    ],
    [BOOKING_STATUS.COMPLETED]: [BOOKING_STATUS.READY_FOR_PAYMENT],
    [BOOKING_STATUS.READY_FOR_PAYMENT]: [BOOKING_STATUS.DONE],
    [BOOKING_STATUS.DONE]: [],
    [BOOKING_STATUS.CANCELLED]: [],
    [BOOKING_STATUS.AUTO_CANCELLED]: [],
  };
  return transitions[canonical] || [];
}

/**
 * Booking source display config.
 */
export const BOOKING_SOURCE = {
  shop: {
    label: "محل",
    labelEn: "Shop",
    icon: "Home",
    color: "text-amber-600",
  },
  online: {
    label: "أونلاين",
    labelEn: "Online",
    icon: "Globe",
    color: "text-sky-600",
  },
};

export function getBookingSourceConfig(source) {
  return BOOKING_SOURCE[source] || BOOKING_SOURCE.shop;
}
