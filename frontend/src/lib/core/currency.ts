/**
 * The salon's currency, available to plain functions.
 *
 * `formatCurrency` is called from 85 files -- components, hooks, and one
 * non-React printer module -- so the currency cannot arrive as a hook
 * argument without threading it through every call site. Instead it is held
 * here, synchronously, and set once when the business settings load.
 *
 * That is a deliberate trade: a module-level variable is not reactive, so a
 * component will not re-render when the currency changes. That is acceptable
 * here for two reasons. The currency is a salon-wide setting changed from the
 * settings screen by an owner, not a per-user preference, so it changes on the
 * order of once in the life of an install. And when it does change, the
 * settings save already reloads the app data, so the next render picks it up.
 *
 * The default is EGP because that is the column default on the backend
 * (`business_settings.currency`), and a formatter that shows "USD" because
 * nobody set the field would be worse than one that shows the right currency by
 * accident.
 */

/** Currencies the UI has a label for. Anything else falls back to the code. */
const LABELS: Record<string, string> = {
  EGP: "ج.م",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SAR: "ر.س",
  AED: "د.إ",
  KWD: "د.ك",
  QAR: "ر.ق",
  JOD: "د.أ",
  MAD: "د.م.",
  TND: "د.ت",
  DZD: "د.ج",
  LYD: "د.ل",
  SDG: "ج.س.",
};

let current = "EGP";
const listeners = new Set<(code: string) => void>();

/** The currency currently in use, e.g. "EGP". */
export function getCurrency(): string {
  return current;
}

/** The display label for a currency code: the Arabic name for EGP, else the code. */
export function currencyLabel(code: string = current): string {
  return LABELS[code.toUpperCase()] ?? code.toUpperCase();
}

/**
 * Set the active currency. Call once, when business settings are loaded.
 *
 * Returns whether anything changed, so a caller can skip a refetch. Unknown
 * codes are accepted rather than rejected: a salon whose currency is not in the
 * label table should see the code itself, not the previous currency.
 */
export function setCurrency(code: string | null | undefined): boolean {
  const next = (code || "EGP").trim().toUpperCase();
  if (next === current) return false;
  current = next;
  for (const listener of listeners) listener(next);
  return true;
}

/** Subscribe to currency changes. Returns an unsubscribe function. */
export function onCurrencyChange(listener: (code: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Test-only. Resets to EGP so one test's currency cannot leak into the next,
 * which is the same class of bug as a leaked database row.
 */
export function __resetCurrencyForTests(): void {
  current = "EGP";
  listeners.clear();
}
