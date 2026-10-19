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
            {phone ? (
              <a href={`tel:${phone}`} className="mk-btn mk-btn-primary mk-btn-lg">
                {t("landing.callUs")}
                <span className="numeric ms-2">{phone}</span>
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

        <div className="mk-c-grid">
          <div className="mk-c-card">
            {address ? (
              <div className="mk-c-row">
                <div className="mk-c-row__ic" aria-hidden="true">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3>{t("landing.addressLabel")}</h3>
                  <p>{address}</p>
                </div>
              </div>
            ) : null}

            {phone ? (
              <div className="mk-c-row">
                <div className="mk-c-row__ic" aria-hidden="true">
                  <Phone size={18} />
                </div>
                <div>
                  <h3>{t("landing.phoneLabel")}</h3>
                  <p className="numeric">{phone}</p>
                </div>
              </div>
            ) : null}

            {!address && !phone ? (
              <p className="mk-lead">{t("landing.contactMissing")}</p>
            ) : null}
          </div>

          {/*
            The map column. A link, not a picture: the pin and the grid were a
            placeholder in the mockup, and shipping them as-is would show every
            salon a location that is not theirs.
          */}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mk-map"
            >
              <span className="mk-map__label">
                <MapPin size={20} aria-hidden="true" />
                {address || t("landing.viewMap")}
              </span>
              <span className="mk-map__cta">{t("landing.viewMap")}</span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}