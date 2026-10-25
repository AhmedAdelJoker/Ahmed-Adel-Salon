/**
 * ServicesList.tsx — the price list, as a list.
 *
 * ## Why the cards went
 *
 * A grid of service cards reads as a product catalogue: every item the same
 * size, every description the same length, one image per cell. A salon's
 * services are a menu — the visitor scans names and prices vertically, then
 * picks one. A list with the price on the same baseline as the name is both
 * faster to read and far more honest about the fact that most services have no
 * photo.
 *
 * ## What is never invented
 *
 * The description is rendered only when the service actually has one. The
 * previous version fell back to a generic sentence ("خدمة مصممة بعناية...")
 * for every service, which reached the page, the JSON-LD and the meta
 * description. A service with no description now shows its duration and its
 * category instead — facts, not filler.
 */

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { buildSizes, buildSrcSet, resolveAssetUrl } from "../../lib/imageOptimizer";
import type { BrandTheme } from "../../lib/theme";

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export interface ServiceItem {
  id?: string | number;
  name: string;
  /** Empty when the owner has not written one; never a fallback sentence. */
  description: string;
  image?: string | null;
  duration?: string;
  price: number;
  featured?: boolean;
  /** `category_id` from the catalogue; `null` when the service has none. */
  categoryId?: string | number | null;
  categoryName?: string | null;
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

  const visible = useMemo(
    () =>
      !activeCategory
        ? services
        : services.filter(
            (service) =>
              service.categoryId != null &&
              String(service.categoryId) === activeCategory,
          ),
    [services, activeCategory],
  );

  /**
   * Grouped by category only when the catalogue actually has categories.
   *
   * With one category the group heading repeats the section title, so the
   * rows render as a single unlabelled list. With none (an older catalogue
   * that never sent them) the same thing happens.
   */
  const groups = useMemo(() => {
    if (!categories || categories.length < 2) {
      return [{ id: "all", name: "", services: visible }];
    }

    const known = new Set(categories.map((category) => category.id));
    const byCategory = new Map<string, ServiceItem[]>();
    const uncategorised: ServiceItem[] = [];

    for (const service of visible) {
      const id = service.categoryId != null ? String(service.categoryId) : "";
      if (!id || !known.has(id)) {
        uncategorised.push(service);
        continue;
      }
      const bucket = byCategory.get(id);
      if (bucket) bucket.push(service);
      else byCategory.set(id, [service]);
    }

    const result = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        services: byCategory.get(category.id) ?? [],
      }))
      .filter((group) => group.services.length > 0);

    if (uncategorised.length > 0) {
      result.push({ id: "other", name: t("landing.servicesOther"), services: uncategorised });
    }
    return result;
  }, [categories, visible, t]);

  if (services.length === 0) {
    return (
      <section id="services" className="mk-shell py-[length:var(--section-y)]">
        <p className="mk-empty">{t("landing.noServices")}</p>
      </section>
    );
  }

  const filterRow = categories && categories.length > 1;
  let rowIndex = 0;

  return (
    <section id="services" className="mk-shell py-[length:var(--section-y)]">
      <header className="mk-svc-head">
        <div>
          {eyebrow ? <p className="mk-eyebrow">{eyebrow}</p> : null}
          <h2 className="mk-h2" style={{ marginTop: eyebrow ? "0.75rem" : undefined }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mk-lead" style={{ marginTop: "1.15rem" }}>
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
        <div className="mk-menu">
          {groups.map((group) => (
            <div key={group.id} className="mk-menu-group">
              {group.name ? (
                <h3 className="mk-menu-group-title">{group.name}</h3>
              ) : null}
              {group.services.map((service) => {
                rowIndex += 1;
                return (
                  <article
                    key={service.id ?? `${service.name}-${rowIndex}`}
                    className="mk-menu-row"
                    data-featured={service.featured ? "true" : "false"}
                  >
                    <span className="mk-menu-num" aria-hidden="true">
                      {String(rowIndex).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                      <h4 className="mk-menu-name">
                        {salonSlug ? (
                          <a href={`/salon/${salonSlug}/service/${service.id}`}>
                            {service.name}
                          </a>
                        ) : (
                          service.name
                        )}
                      </h4>

                      {service.description ? (
                        <p className="mk-menu-desc">{service.description}</p>
                      ) : null}

                      <div className="mk-menu-meta">
                        {service.duration ? (
                          <span className="numeric">{service.duration}</span>
                        ) : null}
                        {service.featured ? (
                          <span style={{ color: "var(--c-accent)" }}>
                            {t("landing.featured")}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span className="mk-menu-price">
                      {service.price} <small>{currency}</small>
                    </span>

                    <button
                      type="button"
                      onClick={() => onBook(service)}
                      className="mk-menu-book"
                    >
                      {t("landing.bookService")}
                      {/*
                        The arrow points the way the row reads. `ArrowUpLeft`
                        with `rtl:rotate-180` faced backwards in both
                        directions — in Latin it pointed into the label, and in
                        Arabic it pointed the wrong way entirely.
                      */}
                      <ArrowUpRight size={13} aria-hidden="true" className="rtl:rotate-180" />
                    </button>
                  </article>
                );
              })}
            </div>
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
      description: asText(service.description_ar) || asText(service.description),
      image: image ? `${image}${image.includes("?") ? "&" : "?"}w=160` : null,
      duration: duration ? duration : undefined,
      price: Number.isFinite(price) ? price : 0,
      featured: Boolean(service.is_featured),
    };
  });
}

/** Exported for the offer cards, which use the same image treatment. */
export { buildSrcSet, buildSizes };
