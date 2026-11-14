/**
 * Booking draft persistence.
 *
 * A booking form asks for name, phone, services, barber, date, time and notes.
 * That is seven fields typed on a phone, often over mobile data, for an
 * appointment that happens minutes to days later. Losing all of it to an
 * accidental refresh, a backgrounded tab on iOS, or a dropped connection at the
 * submit step is the single most avoidable way this form fails.
 *
 * The draft is deliberately scoped to the device and holds no secrets beyond
 * what the visitor already typed into the page:
 *  - it is stored under a per-salon key, so a shared kiosk does not leak one
 *    visitor's phone number into the next;
 *  - it is cleared on successful submission, which is the only point where the
 *    data now lives in a database instead of the visitor's own browser;
 *  - it is read defensively, because `localStorage` throws outright in Safari
 *    private mode and when a site is opened from a `file://` origin.
 */

const STORAGE_PREFIX = "salon-pro:booking-draft";

function storageKey(salonSlug?: string | null): string {
  return `${STORAGE_PREFIX}:${salonSlug || "default"}`;
}

/** localStorage is not merely "possibly empty" — accessing it can throw. */
function safeStorage(): Storage | null {
  try {
    const probe = "__salon_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface BookingDraft<T> {
  form: T;
  /** Epoch ms, used to expire stale drafts instead of resurrecting old ones. */
  savedAt: number;
}

/** Drafts older than this are discarded: a week-old half-filled form is noise. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function readBookingDraft<T>(salonSlug?: string | null): BookingDraft<T> | null {
  const storage = safeStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(storageKey(salonSlug));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as BookingDraft<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || !parsed.form) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      storage.removeItem(storageKey(salonSlug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeBookingDraft<T>(form: T, salonSlug?: string | null): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(salonSlug), JSON.stringify({ form, savedAt: Date.now() }));
  } catch {
    // A full or unavailable quota must never interrupt the booking itself.
  }
}

export function clearBookingDraft(salonSlug?: string | null): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(salonSlug));
  } catch {
    /* nothing to do */
  }
}