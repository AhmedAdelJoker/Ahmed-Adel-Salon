export function slugifyPublicValue(value = "") {
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

export function resolvePublicSlug(settings = {}) {
  return slugifyPublicValue(
    settings?.public_slug ||
      settings?.publicSlug ||
      settings?.salon_name ||
      settings?.salonName ||
      "salon",
  );
}

export function buildPublicSalonPath(settings = {}) {
  return `/salon/${resolvePublicSlug(settings)}`;
}

export function buildPublicBookingPath(settings = {}) {
  return `${buildPublicSalonPath(settings)}/book`;
}
