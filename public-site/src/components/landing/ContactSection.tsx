/**
 * ContactSection — the closing band of the landing page.
 *
 * Two things this block deliberately does not do:
 *
 * 1. It does not draw the opening hours. `OwnerSections` renders those, with
 *    the open/closed label; an earlier version of the page drew the same seven
 *    rows here as well, so every salon showed "ساعات العمل" twice.
 * 2. It does not draw a fake map. The mockup's `.map` is a decorative grid with
 *    a pin and a caption that lead nowhere. When the owner has configured a
 *    maps URL the block becomes a real link out to that address, labelled with
 *    it; when they have not, the column is dropped and the card spans the full
 *    grid instead of leaving an empty box.
 *
 * Every field is optional, so a salon that published nothing renders no rows
 * rather than rows reading "undefined".
 */

import { MapPin, Phone } from "lucide-react";

export interface ContactSectionProps {
  t: (key: string, vars?: Record<string, unknown>) => string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  address?: string;
  phone?: string;
  whatsappUrl?: string;
  mapsUrl?: string;
}

export default function ContactSection({
  t,
  eyebrow,
  title,
  subtitle,
  address,
  phone,
  whatsappUrl,
  mapsUrl,
}: ContactSectionProps) {
  return (
    <section id="contact" className="mk-contact">
      <div className="mk-shell">
        <div className="mk-svc-head">
          <div>
            {eyebrow ? <p className="mk-eyebrow">{eyebrow}</p> : null}
            {title ? (
              <h2 className="mk-h2" style={{ marginTop: "0.75rem" }}>
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="mk-lead">{subtitle}</p> : null}
          </div>

          <div className="mk-c-actions">
            {/*
              The actions are verbs; the facts are data.

              The call button used to print the number as well ("اتصل بنا
              01094693361") and the facts row below printed it again, so the
              same eleven digits appeared twice in one section. The button now
              says what it does and the number lives once, in the facts row,
              where it is a `tel:` link like every other piece of data on the
              page.

              The number is still in the accessible name, so a screen reader
              hears the digits it is about to dial.
            */}
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="mk-btn mk-btn-primary mk-btn-lg"
                aria-label={`${t("landing.callUs")} ${phone}`}
              >
                <Phone size={16} aria-hidden="true" />
                {t("landing.callUs")}
              </a>
            ) : null}
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mk-btn mk-btn-ghost mk-btn-lg"
              >
                {t("landing.whatsapp")}
              </a>
            ) : null}
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mk-btn mk-btn-ghost mk-btn-lg"
              >
                <MapPin size={16} aria-hidden="true" className="ms-2 inline-block align-[-2px]" />
                {t("landing.viewMap")}
              </a>
            ) : null}
          </div>
        </div>

        {/*
          A facts strip, not a card. The old version wrapped one or two rows in
          a half-page box, so a salon with a phone number and no street address
          showed a large empty panel. The rows now share a single rule and the
          map lives in the header action, where it is a link rather than an
          empty decorative tile.
        */}
        {address || phone ? (
          <div className="mk-c-facts">
            {address ? (
              <div className="mk-c-fact">
                <MapPin size={18} aria-hidden="true" />
                <div>
                  <h3>{t("landing.addressLabel")}</h3>
                  <p>{address}</p>
                </div>
              </div>
            ) : null}

            {phone ? (
              <div className="mk-c-fact">
                <Phone size={18} aria-hidden="true" />
                <div>
                  <h3>{t("landing.phoneLabel")}</h3>
                  {/*
                    A `tel:` link, not plain text: the number is the salon's
                    primary contact detail and every other piece of data on the
                    page that can be acted on is a link.
                  */}
                  <a
                    href={`tel:${phone}`}
                    className="numeric block w-fit transition-opacity duration-200 hover:opacity-75"
                    style={{ color: "var(--c-text)" }}
                    dir="ltr"
                  >
                    {phone}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mk-lead">{t("landing.contactMissing")}</p>
        )}
      </div>
    </section>
  );
}