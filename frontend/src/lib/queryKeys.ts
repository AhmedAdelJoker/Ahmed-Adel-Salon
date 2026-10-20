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

/**
 * Keyword fallbacks for events whose name we do not recognise.
 *
 * Both Latin and Arabic spellings are listed because the backend emits the
 * Latin `event` names, but a `message` arriving on an unrecognised shape is
 * frequently the human-readable Arabic one.
 *
 * `strong` marks a term that only ever appears in one domain's vocabulary
 * ("وردية", "مخزون"), so a single hit is already enough to refetch that slice.
 * Generic terms ("فاتورة" also shows up in shift and expense copy) require a
 * second independent group to agree, which keeps an unrelated notification
 * from triggering a broad refetch.
 */
const KEYWORD_FALLBACKS: Array<{
  words: string[];
  keys: QueryKey[];
  strong?: boolean;
}> = [
  {
    words: ["invoice", "bill", "payment", "فاتورة", "دفعة", "سداد"],
    keys: [["invoices"], ["dashboard"]],
  },
  {
    words: ["appointment", "booking", "موعد", "حجز"],
    keys: [["appointments"], ["schedule"]],
    strong: true,
  },
  {
    words: ["shift", "drawer", "وردية", "درج"],
    keys: [["pos-shifts"], ["pos"]],
    strong: true,
  },
  {
    words: ["cash", "vault", "cashbox", "خزنة", "خزينة", "نقدية"],
    keys: [["cashbox"], ["reports"]],
    strong: true,
  },
  {
    words: ["stock", "inventory", "product", "مخزون", "منتج", "صنف"],
    keys: [["inventory"], ["products"]],
    strong: true,
  },
  {
    words: ["customer", "loyalty", "عميل", "ولاء"],
    keys: [["customers"]],
  },
  {
    words: ["payroll", "salary", "راتب", "مستحقات"],
    keys: [["payroll"]],
    strong: true,
  },
  {
    words: ["expense", "مصروف", "مصروفات"],
    keys: [["expenses"]],
    strong: true,
  },
  {
    words: ["attendance", "presence", "حضور", "انصراف"],
    keys: [["attendance"]],
    strong: true,
  },
  {
    words: ["employee", "staff", "موظف", "عامل"],
    keys: [["employees"], ["hr"]],
    strong: true,
  },
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

  if (matches.length === 0) return [];

  // A single strong hit (a term unique to one domain) is enough; otherwise two
  // independent groups must agree before anything is refetched.
  if (matches.length < 2 && !matches.some((match) => match.strong)) return [];

  return matches.flatMap((match) => match.keys);
}