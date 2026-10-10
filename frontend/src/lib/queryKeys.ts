/**
 * Socket event → react-query key mapping.
 *
 * Kept in its own module (no React imports) so the mapping is pure and can be
 * unit-tested directly.
 *
 * The event payloads are loosely typed by design: the notification socket is a
 * firehose that emits different shapes (and the backend occasionally adds new
 * ones), so matching is done on the `event` / `type` string plus a few keyword
 * heuristics rather than an exhaustive union that would break on a new event.
 */

export type QueryKey = readonly unknown[];

/** Known event names emitted by the backend notification socket. */
const EVENT_ALIASES: Record<string, QueryKey[]> = {
  // Appointments
  appointment_created: [["appointments"], ["schedule"], ["reception"]],
  appointment_updated: [["appointments"], ["schedule"], ["reception"]],
  appointment_status_changed: [
    ["appointments"],
    ["schedule"],
    ["reception"],
    ["pos"],
  ],
  appointment_ready_for_payment: [["pos"], ["appointments"], ["reception"]],

  // Invoices / billing
  invoice_created: [["invoices"], ["dashboard"], ["cashbox"], ["reports"]],
  invoice_updated: [["invoices"], ["dashboard"]],
  invoice_paid: [["invoices"], ["dashboard"], ["cashbox"], ["reports"]],
  invoice_voided: [["invoices"], ["dashboard"], ["cashbox"], ["reports"]],

  // POS / shifts / money
  shift_opened: [["pos"], ["pos-shifts"]],
  shift_closed: [["pos-shifts"], ["reports"], ["cashbox"]],
  payment_received: [["cashbox"], ["dashboard"], ["reports"]],
  cash_transaction_created: [["cashbox"], ["reports"]],

  // Customers / loyalty
  customer_created: [["customers"], ["dashboard"]],
  customer_updated: [["customers"]],
  loyalty_points_changed: [["customers"], ["dashboard"]],

  // Products / inventory
  product_stock_changed: [["inventory"], ["products"]],
  inventory_log_created: [["inventory"], ["inventory-archive"]],

  // Staff
  employee_created: [["employees"], ["hr"]],
  employee_updated: [["employees"], ["hr"]],
  attendance_recorded: [["attendance"], ["dashboard"]],
  payroll_processed: [["payroll"], ["reports"]],
  expense_created: [["expenses"], ["reports"]],
  expense_approved: [["expenses"], ["cashbox"], ["reports"]],
};

const KEYWORD_FALLBACKS: Array<{ words: string[]; keys: QueryKey[] }> = [
  { words: ["invoice", "bill", "payment"], keys: [["invoices"], ["dashboard"]] },
  { words: ["appointment", "booking"], keys: [["appointments"], ["schedule"]] },
  { words: ["shift", "drawer"], keys: [["pos-shifts"], ["pos"]] },
  { words: ["cash", "vault", "cashbox"], keys: [["cashbox"], ["reports"]] },
  { words: ["stock", "inventory", "product"], keys: [["inventory"], ["products"]] },
  { words: ["customer", "loyalty"], keys: [["customers"]] },
  { words: ["payroll", "salary"], keys: [["payroll"]] },
  { words: ["expense"], keys: [["expenses"]] },
  { words: ["attendance", "presence"], keys: [["attendance"]] },
  { words: ["employee", "staff"], keys: [["employees"], ["hr"]] },
];

function normalise(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Reads the event name out of the several shapes the socket has used. */
function eventNameOf(payload: Record<string, unknown>): string {
  const candidates = [payload.event, payload.type, payload.action, payload.name];
  for (const candidate of candidates) {
    const value = normalise(candidate);
    if (value) return value.replace(/[\s-]+/g, "_");
  }
  return "";
}

/**
 * Returns the query keys an event should invalidate.
 * An empty array means "nothing specific" — the 30s sweep still covers it.
 */
export function keysForSocketEvent(payload: Record<string, unknown>): QueryKey[] {
  const event = eventNameOf(payload);
  if (event && EVENT_ALIASES[event]) return EVENT_ALIASES[event];

  // Fall back to scanning the whole payload for a known keyword.
  const haystack = Object.values(payload)
    .filter((value) => typeof value === "string")
    .map((value) => String(value).toLowerCase())
    .join(" ");

  if (!haystack) return [];

  const matches = KEYWORD_FALLBACKS.filter(({ words }) =>
    words.some((word) => haystack.includes(word)),
  );

  // Two independent keyword hits is enough signal; one is too noisy.
  if (matches.length < 2) return [];

  return matches.flatMap((match) => match.keys);
}