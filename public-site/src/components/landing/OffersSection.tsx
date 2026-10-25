/**
 * OffersSection.tsx — the mockup's offers band.
 *
 * `#offers` was in the header nav while the section itself had been dropped, so
 * the link was dead. The band is a gradient card holding an intro cell followed
 * by real offers, each with an accent rule on the inline-start edge, the
 * old→new price line, and a booking action.
 */

import { ArrowRight } from "lucide-react";

import type { BrandTheme } from "../../lib/theme";
import type { Translate } from "./OwnerSections";

export interface OfferItem {
  id?: string | number;
  name: string;
  description?: string;
  /** Final price. 0/omitted when the salon only configured a percentage off. */
  price?: number | null;
  /** Original price when the payload provides it; else derived from the % off. */
  originalPrice?: number | null;
  /** Percent off, used to derive the strike-through original price. */
  discountPercent?: number | null;
  /** Owner-uploaded offer image, already resolved to an absolute URL. */
  image?: string | null;
  currency: string;
}

export interface OffersSectionProps {
  theme: BrandTheme;
  offers: OfferItem[];
  title: string;
  subtitle?: string;
  onBook: (offer: OfferItem) => void;
  /** Salon public slug; when set, each card links to `/salon/:slug/offer/:id`. */
  salonSlug?: string;
  t: Translate;
}

export default function OffersSection({
  offers,
  title,
  subtitle,
  onBook,
  salonSlug,
  t,
}: OffersSectionProps) {
  if (!offers.length) return null;

  return (
    <section id="offers" className="mk-shell py-[length:var(--section-y)]">
      <div className="mk-offers mk-offers--section">
        <div>
          <p className="mk-eyebrow">{t("landing.specialOffer")}</p>
          <h2 className="mk-h3" style={{ marginTop: "0.5rem" }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mk-lead" style={{ marginTop: "0.75rem" }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {offers.map((offer) => {
          /**
           * A discount is only worth showing as a struck-through original price
           * when the final price is known — otherwise the visitor sees a number
           * with no reference to compare it against, which reads as noise. A
           * zero payload price means "no final price configured", not free.
           */
          const finalPrice = offer.price && offer.price > 0 ? offer.price : null;
          const originalPrice =
            offer.originalPrice && finalPrice != null && offer.originalPrice > finalPrice
              ? offer.originalPrice
              : finalPrice != null && offer.discountPercent
                ? Math.round((finalPrice / (1 - offer.discountPercent / 100)) * 100) / 100
                : null;

          return (
            <article key={offer.id ?? offer.name} className="mk-offer">
              {offer.image ? (
                /* Same media band pattern as the service cards: the photo sits
                   edge-to-edge on the inline-start edge and zooms softly on
                   hover. A dimmed scrim keeps the band's dark gradient
                   underneath coherent when the photo is bright. */
                <div className="mk-offer__media" aria-hidden="true">
                  <img
                    src={offer.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="mk-offer__media-scrim" />
                </div>
              ) : null}

              {finalPrice != null ? (
                <p className="mk-offer__prices numeric">
                  {originalPrice != null ? (
                    <>
                      <span className="mk-offer__old">
                        {formatPrice(originalPrice, offer.currency)}
                      </span>
                      {/*
                        The arrow points from the old price to the new one.
                        A literal "→" is a left-to-right arrow, so in an
                        Arabic page it pointed back at the old price instead
                        of leading to the new one.
                      */}
                      <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
                    </>
                  ) : null}
                  <span className="mk-offer__new">{formatPrice(finalPrice, offer.currency)}</span>
                </p>
              ) : offer.discountPercent ? (
                <p className="mk-offer__new numeric">-{offer.discountPercent}%</p>
              ) : null}

              <h4>
                {salonSlug && offer.id != null ? (
                  <a href={`/salon/${salonSlug}/offer/${offer.id}`}>{offer.name}</a>
                ) : (
                  offer.name
                )}
              </h4>

              {offer.description ? <p className="mk-offer__desc">{offer.description}</p> : null}

              <button
                type="button"
                onClick={() => onBook(offer)}
                className="mk-btn mk-btn-primary mk-btn-sm"
                style={{ marginTop: "1rem" }}
              >
                {t("landing.bookOffer")}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatPrice(value: number, currency: string) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded % 1 === 0 ? rounded : rounded.toFixed(2)} ${currency}`;
}
