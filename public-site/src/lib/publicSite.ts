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
