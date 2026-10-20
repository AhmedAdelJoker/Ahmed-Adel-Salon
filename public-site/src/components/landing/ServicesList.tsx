/**
 * ServicesList.tsx — services as the mockup's card grid.
 *
 * Each service is a `mk-svc` card: name (linked to its own page) with the
 * price on the top band, description underneath, and a meta footer with the
 * duration, one tier chip and the booking action. The tier chip is assigned
 * by price band, not stored — one chip per card, `featured` wins when the
 * owner has flagged the service.
 */

import { useMemo, useState } from "react";
import { ArrowUpLeft } from "lucide-react";

import { buildSizes, buildSrcSet, resolveAssetUrl } from "../../lib/imageOptimizer";
import type { BrandTheme } from "../../lib/theme";

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export interface ServiceItem {
  id?: string | number;
  name: string;
  description: string;
  image?: string | null;
  duration?: string;
  price: number;
  featured?: boolean;
  /** `category_id` from the catalogue; `null` when the service has none. */
  categoryId?: string | number | null;
  categoryName?: string | null;
  /** 'premium' for the top-priced band; 'basic' otherwise. */
  tier?: "basic" | "premium";
}

export interface ServicesListProps {
  theme: BrandTheme;
  t: Translate;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  services: ServiceItem[];
  currency: string;
  onBook: (service: ServiceItem) => void;
  /** Salon public slug; when set, names link to `/salon/:slug/service/:id`. */
  salonSlug?: string;
  /**
   * Category chips for the filter row.
   *
   * Optional and self-limiting: with fewer than two categories the row is not
   * rendered at all, because a single chip plus "All" is a control that does
   * nothing a reader can see.
   */
  categories?: { id: string; name: string }[];
}

export default function ServicesList({
  t,
  eyebrow,
  title,
  subtitle,
  services,
  currency,
  onBook,
  salonSlug,
  categories,
}: ServicesListProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  /**
   * Tier badge.
   *
   * "Premium" is assigned by price band, not stored: the salon has no such
   * field, and inventing a persisted tier would mean an owner-facing setting
   * that does nothing. The top third of the catalogue gets the badge — enough
   * services to be a meaningful choice, few enough that the label stays
   * aspirational instead of appearing on half the menu.
   */
  const premiumCutoff = useMemo(() => {
    const prices = services.map((service) => service.price).filter((price) => price > 0);
    if (prices.length < 3) return Infinity;
    const sorted = [...prices].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.67)];
  }, [services]);

  /**
   * Filtering is a projection of the full list, never a second source of truth.
   */
  const visible = useMemo(() => {
    return (!activeCategory
      ? services
      : services.filter(
          (service) => service.categoryId != null && String(service.categoryId) === activeCategory,
        )
    ).map((service) => ({
      ...service,
      tier:
        service.price > 0 && service.price >= premiumCutoff
          ? ("premium" as const)
          : ("basic" as const),
    }));
  }, [services, activeCategory, premiumCutoff]);

  if (services.length === 0) {
    return (
      <section id="services" className="mk-shell py-[length:var(--section-y)]">
        <p className="mk-empty">{t("landing.noServices")}</p>
      </section>
    );
  }

  const filterRow = categories && categories.length > 1;

  return (
    <section id="services" className="mk-shell py-[length:var(--section-y)]">
      <header className="mk-svc-head">
        <div>
          {eyebrow ? <p className="mk-eyebrow">{eyebrow}</p> : null}
          <h2 className="mk-h2" style={{ marginTop: eyebrow ? "0.75rem" : undefined }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mk-lead" style={{ marginTop: "1.25rem" }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* Filter row. Hidden when the catalogue has fewer than two categories —
            "All" alone is a control with nothing to do. */}
        {filterRow ? (
          <div role="group" aria-label={t("landing.filtersTitle")} className="mk-filters">
            <button
              type="button"
              aria-pressed={activeCategory === null}
              onClick={() => setActiveCategory(null)}
            >
              {t("landing.filtersAll")}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {visible.length === 0 ? (
        <p className="mk-empty">{t("landing.noMatches")}</p>
      ) : (
        <div className="mk-svc-grid">
          {visible.map((service, index) => (
            <article key={service.id ?? `${service.name}-${index}`} className="mk-svc">
              <div className="mk-svc-top">
                {/*
                  The service photo. Real data shown small so the cards stay
                  cards; the large version lives on the service's own page.
                  `alt=""` because the name is the adjacent heading —
                  announcing both would double-read it.
                */}
                {service.image ? (
                  <img
                    src={service.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="mk-svc-thumb"
                  />
                ) : null}

                {/*
                  The service name links to its own page. A `Service` with an
                  `Offer` at a stable URL is what lets a search result show a
                  price instead of making the visitor click through, and it is
                  the page a stylist's regular client bookmarks.
                */}
                <h4>
                  {salonSlug ? (
                    <a href={`/salon/${salonSlug}/service/${service.id}`}>{service.name}</a>
                  ) : (
                    service.name
                  )}
                </h4>

                <span className="mk-price numeric">
                  {service.price} {currency}
                </span>
              </div>

              {service.description ? <p className="mk-svc-desc">{service.description}</p> : null}

              <div className="mk-svc-meta">
                {/* `duration` arrives fully localized ("30 دقيقة") from the page. */}
                {service.duration ? (
                  <span className="numeric">{service.duration}</span>
                ) : null}

                {/*
                  One chip per card: the owner's `featured` flag wins, then the
                  computed premium band.
                */}
                {service.featured ? (
                  <span className="mk-tag">{t("landing.featured")}</span>
                ) : service.tier === "premium" ? (
                  <span className="mk-tier mk-tier-premium">{t("landing.tierPremium")}</span>
                ) : (
                  <span className="mk-tier mk-tier-basic">{t("landing.tierBasic")}</span>
                )}

                <button type="button" onClick={() => onBook(service)} className="mk-book-link">
                  {t("landing.bookService")}
                  <ArrowUpLeft size={14} aria-hidden="true" className="rtl:rotate-180" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** Build the view model from the API's loosely typed service records. */
export function toServiceItems(
  services: Record<string, unknown>[],
  t: Translate,
): ServiceItem[] {
  const asText = (value: unknown): string =>
    typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";

  return services.map((service) => {
    const price = Number(asText(service.price) || 0);
    const duration = asText(service.duration_minutes) || asText(service.duration);
    const image = resolveAssetUrl(service.image_url);

    return {
      id: service.id as string | number | undefined,
      name: asText(service.name_ar) || asText(service.name) || t("landing.serviceFallbackName"),
      description:
        asText(service.description_ar) ||
        asText(service.description) ||
        t("landing.serviceFallbackDescription"),
      image: image ? `${image}${image.includes("?") ? "&" : "?"}w=160` : null,
      duration: duration ? duration : undefined,
      price: Number.isFinite(price) ? price : 0,
      featured: Boolean(service.is_featured),
    };
  });
}

/** Exported for the offer cards, which use the same image treatment. */
export { buildSrcSet, buildSizes };
