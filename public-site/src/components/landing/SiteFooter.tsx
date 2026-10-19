import type { Translate } from "./OwnerSections";

export interface SiteFooterProps {
  salonName: string;
  salonSlug?: string;
  logoImage?: string | null;
  tagline?: string;
  phone?: string;
  whatsappUrl?: string;
  mapsUrl?: string;
  address?: string;
  socialLinks: { key: string; icon: string; href: string; label: string }[];
  navLinks: { id: string; label: string }[];
  bookingPath: string;
  /** Salon photos from `landing_portfolio`, already resolved to URLs. */
  photos: string[];
  hasPortfolio: boolean;
  t: Translate;
}

/**
 * Site footer.
 *
 * Three columns, following the mockup: the brand wide on the left with the
 * tagline and the contact details, the page links, then the social accounts.
 *
 * The contact details were a fourth column here before. They belong under the
 * brand — a phone number sitting three columns away from the salon's name is
 * the first thing a visitor looks for and the last thing they find. Nothing was
 * dropped: phone, WhatsApp, maps and address all still render, they render
 * once, and the column only disappears when the salon published none of them.
 */
export default function SiteFooter({
  salonName,
  salonSlug,
  logoImage,
  tagline,
  phone,
  whatsappUrl,
  mapsUrl,
  address,
  socialLinks,
  navLinks,
  bookingPath,
  photos,
  hasPortfolio,
  t,
}: SiteFooterProps) {
  const year = new Date().getFullYear();
  const showPhotos = photos.length > 0;
  const hasContact = Boolean(phone || whatsappUrl || mapsUrl || address);

  return (
    <footer className="mk-footer">
      {showPhotos ? (
        <ul className="grid grid-cols-3 gap-px sm:grid-cols-6">
          {photos.map((src, index) => (
            <li key={`${src}-${index}`}>
              <a
                href="#portfolio"
                className="group block aspect-[4/3] overflow-hidden bg-inset"
                aria-label={t("landing.workGallery")}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mk-shell">
        <div className="mk-f-grid">
          {/* ── Brand, tagline, contact ──────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3">
              <span className="mk-mark">
                {logoImage ? (
                  <img src={logoImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[length:var(--step--1)] font-bold">
                    {salonName.charAt(0)}
                  </span>
                )}
              </span>
              <span className="text-[length:var(--step-1)] font-bold">{salonName}</span>
            </div>

            <p
              className="mt-4 max-w-[40ch] text-[length:var(--step--1)]"
              style={{ color: "var(--c-muted)" }}
            >
              {tagline || t("landing.professionalSalon")}
            </p>

            {hasContact ? (
              <ul className="mt-5 space-y-2">
                {address ? (
                  <li className="text-[length:var(--step--1)]" style={{ color: "var(--c-faint)" }}>
                    {address}
                  </li>
                ) : null}
                {phone ? (
                  <li>
                    <a
                      href={`tel:${phone}`}
                      className="numeric text-[length:var(--step--1)] font-bold transition-opacity duration-200 hover:opacity-80"
                      style={{ color: "var(--c-muted)" }}
                      dir="ltr"
                    >
                      {phone}
                    </a>
                  </li>
                ) : null}
                {whatsappUrl ? (
                  <li>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[length:var(--step--1)] font-bold transition-opacity duration-200 hover:opacity-80"
                      style={{ color: "var(--c-muted)" }}
                    >
                      {t("landing.whatsapp")}
                    </a>
                  </li>
                ) : null}
                {mapsUrl ? (
                  <li>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[length:var(--step--1)] font-bold transition-opacity duration-200 hover:opacity-80"
                      style={{ color: "var(--c-muted)" }}
                    >
                      {t("landing.viewMap")}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          {/* ── Page links ──────────────────────────────────────────── */}
          <nav aria-label={t("nav.services")}>
            <h2 className="mk-f-h">{t("footer.links")}</h2>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.id}>
                  <a href={`#${link.id}`} className="mk-f-link">
                    {link.label}
                  </a>
                </li>
              ))}
              {hasPortfolio ? (
                <li>
                  <a href="#portfolio" className="mk-f-link">
                    {t("landing.workGallery")}
                  </a>
                </li>
              ) : null}
              {salonSlug ? (
                <li>
                  <a href={`/salon/${salonSlug}`} className="mk-f-link">
                    {t("landing.hairSalonIn", { salon: salonName })}
                  </a>
                </li>
              ) : null}
              <li>
                <a href={bookingPath} className="mk-f-link" style={{ color: "var(--c-accent)" }}>
                  {t("landing.bookYourAppointment")}
                </a>
              </li>
            </ul>
          </nav>

          {/* ── Social ──────────────────────────────────────────────── */}
          <div>
            <h2 className="mk-f-h">{t("footer.followUs")}</h2>
            {socialLinks.length > 0 ? (
              <ul className="mk-social">
                {socialLinks.map((item) => (
                  <li key={item.key}>
                    <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
                      <SocialGlyphIcon icon={item.icon} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mk-f-bot">
          <span>{t("landing.copyright", { year })}</span>
          <span>
            {address ? `${address} · ` : ""}
            {t("footer.languageSwitch")}
          </span>
        </div>
      </div>
    </footer>
  );
}

/**
 * Brand marks drawn as glyphs rather than imported from `lucide-react`, because
 * that set ships no brand icons. Inline, so there is no third-party icon font
 * and no dependency that could silently change shape. Mirrors the copy already
 * in `LandingPage`.
 */
function SocialGlyphIcon({ icon }: { icon: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", "aria-hidden": true as const };
  switch (icon) {
    case "facebook":
      return (
        <svg {...common} fill="currentColor">
          <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common} fill="currentColor">
          <path d="M16 3h-3v11a2.5 2.5 0 1 1-2-2.45V8.5A5.5 5.5 0 1 0 16 14V9.2a6.3 6.3 0 0 0 4 1.3V7.5A3.5 3.5 0 0 1 16 3z" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="currentColor">
          <path d="M22 12s0-3.2-.4-4.7a2.9 2.9 0 0 0-2-2C18 4.9 12 4.9 12 4.9s-6 0-7.6.4a2.9 2.9 0 0 0-2 2C2 8.8 2 12 2 12s0 3.2.4 4.7a2.9 2.9 0 0 0 2 2c1.6.4 7.6.4 7.6.4s6 0 7.6-.4a2.9 2.9 0 0 0 2-2C22 15.2 22 12 22 12zM10 15.5v-7l6 3.5z" />
        </svg>
      );
  }
}