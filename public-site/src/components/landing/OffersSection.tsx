import { Sparkles, Tag, Timer } from "lucide-react";

import type { BrandTheme } from "../../lib/theme";
import type { Translate } from "./OwnerSections";

export interface OfferItem {
  id?: string | number;
  name: string;
  description?: string;
  /** Final price. Omitted when the salon only configured a percentage off. */
  price?: number | null;
  /** Percent off, used to derive the strike-through original price. */
  discountPercent?: number | null;
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

/**
 * Offers section.
 *
 * `#offers` was in the header nav while the section itself had been dropped, so
 * the link was dead. Offers also carry a real conversion lever the rest of the
 * page lacks: a reason to book *now* rather than "when you need a haircut".
 */
export default function OffersSection({
  theme,
  offers,
  title,
  subtitle,
  onBook,
  salonSlug,
  t,
}: OffersSectionProps) {
  if (!offers.length) return null;

  return (
    <section id="offers" className="mx-auto w-full max-w-7xl px-4 py-[length:var(--section-y)] sm:px-6 lg:px-8">
      <div
        className="rounded-[2.5rem] border p-8 sm:p-12 lg:p-14"
        style={{ backgroundColor: theme.card, borderColor: theme.border }}
      >
        <header className="mb-10 max-w-2xl">
          <p
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: theme.accent }}
          >
            {t("landing.specialOffer")}
          </p>
          <h2
            className="text-[length:var(--step-2)] font-bold leading-[1.2] tracking-normal text-balance"
            style={{ color: theme.text }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-4 text-sm font-bold leading-7 sm:text-base" style={{ color: theme.muted }}>
              {subtitle}
            </p>
          ) : null}
        </header>

        <ul className="grid gap-5 lg:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id ?? offer.name}
              offer={offer}
              theme={theme}
              onBook={onBook}
              salonSlug={salonSlug}
              t={t}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function OfferCard({
  offer,
  theme,
  onBook,
  salonSlug,
  t,
}: {
  offer: OfferItem;
  theme: BrandTheme;
  onBook: (offer: OfferItem) => void;
  salonSlug?: string;
  t: Translate;
}) {
  /**
   * A discount percentage is only worth showing as a struck-through original
   * price when the final price is known — otherwise the visitor sees a number
   * with no reference to compare it against, which reads as noise.
   */
  const originalPrice =
    offer.price != null && offer.discountPercent
      ? Math.round((offer.price / (1 - offer.discountPercent / 100)) * 100) / 100
      : null;

  return (
    <li
      className="flex h-full flex-col rounded-3xl border p-6"
      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
          style={{ backgroundColor: `${theme.accent}1F`, color: theme.accent }}
        >
          {offer.discountPercent ? (
            <Tag size={12} aria-hidden="true" />
          ) : (
            <Sparkles size={12} aria-hidden="true" />
          )}
          <span className="numeric">{offer.discountPercent ? `-${offer.discountPercent}%` : t("landing.limitedOffer")}</span>
        </span>
      </div>

      <h3 className="text-lg font-bold leading-7" style={{ color: theme.text }}>
        {salonSlug && offer.id != null ? (
          <a
            href={`/salon/${salonSlug}/offer/${offer.id}`}
            className="transition hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {offer.name}
          </a>
        ) : (
          offer.name
        )}
      </h3>
      {offer.description ? (
        <p className="mt-2 flex-1 text-sm font-bold leading-7" style={{ color: theme.muted }}>
          {offer.description}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      {offer.price != null ? (
        <p className="mt-5 flex items-baseline gap-2.5">
          {originalPrice != null ? (
            <span className="numeric text-sm font-bold line-through" style={{ color: theme.muted }}>
              {formatPrice(originalPrice, offer.currency)}
            </span>
          ) : null}
          <span className="numeric text-2xl font-bold" style={{ color: theme.accent }}>
            {formatPrice(offer.price, offer.currency)}
          </span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => onBook(offer)}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ backgroundColor: theme.accent, color: "var(--c-bg)" }}
      >
        <Timer size={16} aria-hidden="true" />
        {t("landing.bookOffer")}
      </button>
    </li>
  );
}

function formatPrice(value: number, currency: string) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded % 1 === 0 ? rounded : rounded.toFixed(2)} ${currency}`;
}