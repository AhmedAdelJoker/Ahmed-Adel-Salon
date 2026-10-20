export function slugifyPublicValue(value: unknown = "") {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "salon";
}

export interface PublicSettings {
  public_slug?: string;
  publicSlug?: string;
  salon_name?: string;
  salonName?: string;
  [key: string]: unknown;
}

export function resolvePublicSlug(settings: PublicSettings = {}) {
  return slugifyPublicValue(
    settings?.public_slug ||
      settings?.publicSlug ||
      settings?.salon_name ||
      settings?.salonName ||
      "salon",
  );
}

export function buildPublicSalonPath(settings: PublicSettings = {}) {
  return `/salon/${resolvePublicSlug(settings)}`;
}

export function buildPublicBookingPath(settings: PublicSettings = {}) {
  return `${buildPublicSalonPath(settings)}/book`;
}

/**
 * Build a wa.me link.
 *
 * This lived in `LandingPage` only, which meant the booking confirmation could
 * not offer WhatsApp without duplicating it — and duplicating it is how the bug
 * came about in the first place: the country code was hard-coded to Egypt, so
 * `wa.me/2<number>` was produced for every salon in every country, and
 * `wa.me/22…` whenever the stored number already began with a 2.
 *
 * `VITE_WHATSAPP_COUNTRY` supplies the dialling prefix. Anything already
 * carrying a `+` is passed through untouched, since that is unambiguous.
 */
export function buildWhatsappUrl(
  rawNumber: unknown,
  countryCode: string | undefined = import.meta.env.VITE_WHATSAPP_COUNTRY as string | undefined,
): string | null {
  const digits = String(rawNumber || "").replace(/\D/g, "");
  if (!digits) return null;

  if (String(rawNumber).trim().startsWith("+")) {
    return `https://wa.me/${digits}`;
  }

  const prefix = String(countryCode || "").replace(/\D/g, "");
  const alreadyPrefixed = prefix.length > 0 && digits.startsWith(prefix);
  return `https://wa.me/${alreadyPrefixed ? digits : `${prefix}${digits}`}`;
}
