/**
 * ServicesList.tsx — services as an editorial price list.
 *
 * The card grid this replaces was the single most templated thing on the page:
 * three identical rounded rectangles, name on one line, price on another, no
 * hierarchy, repeated for every row.
 *
 * What premium salons, restaurants and barbers actually publish is a menu:
 * a numbered list with hairline rules, the name and description on the start
 * side, the duration and price aligned to the end side. It handles variable
 * name lengths far better than cards do, it scans in one pass, and it reads as
 * confident rather than assembled.
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
  theme,
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
   * The numbering is computed against the *filtered* list so the visible rows
   * read 01, 02, 03 — a filter that leaves the first visible row numbered "04"
   * because three were hidden reads as broken, not filtered.
   */
  const visible = useMemo(() => {
    const list = !activeCategory
      ? services
      : services.filter(
          (service) => service.categoryId != null && String(service.categoryId) === activeCategory,
        );
    return list.map((service) => ({
      ...service,
      tier:
        service.price > 0 && service.price >= premiumCutoff
          ? ("premium" as const)
          : ("basic" as const),
    }));
  }, [services, activeCategory, premiumCutoff]);

  if (services.length === 0) {
    return (
      <section id="services" className="shell py-[length:var(--section-y)]">
        <div
          className="rounded-[var(--r-lg)] border border-dashed px-8 py-16 text-center"
          style={{ borderColor: theme.border }}
        >
          <p className="text-[length:var(--step-0)] font-semibold" style={{ color: theme.muted }}>
            {t("landing.noServices")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="shell py-[length:var(--section-y)]">
      <header className="reveal mb-14 w-full max-w-3xl">
        {eyebrow ? (
          <p
            className="mb-4 text-[length:var(--step--1)] font-semibold uppercase text-[color:var(--c-accent)]"
            style={{ letterSpacing: "var(--tracking-eyebrow)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className="text-[length:var(--step-4)] font-bold text-[color:var(--c-text)]"
          style={{ letterSpacing: "var(--tracking-display)" }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            className="measure mx-auto mt-5 w-full text-[length:var(--step-0)] font-medium leading-[1.8] text-[color:var(--c-muted)]"
            style={{ letterSpacing: "var(--tracking-body)" }}
          >
            {subtitle}
          </p>
        ) : null}
      </header>

      {/* Filter row. Hidden when the catalogue has fewer than two categories —
          "All" alone is a control with nothing to do. */}
      {categories && categories.length > 1 ? (
        <div
          role="group"
          aria-label={t("landing.filtersTitle")}
          className="reveal mb-10 flex flex-wrap gap-2"
        >
          <FilterChip
            label={t("landing.filtersAll")}
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
            theme={theme}
          />
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              theme={theme}
            />
          ))}
        </div>
      ) : null}

      {/*
        A definition list, not a set of divs: the service name is a term and its
        price and duration are the description, which is what they are.
      */}
      {visible.length === 0 ? (
        <p
          className="rounded-[var(--r-lg)] border border-dashed px-8 py-14 text-center"
          style={{ borderColor: theme.border, color: theme.muted }}
        >
          {t("landing.noMatches")}
        </p>
      ) : (
      <dl className="reveal border-t" style={{ borderColor: theme.border }}>
        {visible.map((service, index) => (
          <div
            key={service.id ?? `${service.name}-${index}`}
            className="group grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-3 border-b py-7 transition-colors duration-300 sm:grid-cols-[3rem_4rem_1fr_auto] sm:gap-x-6"
            style={{ borderColor: theme.border }}
          >
            <span
              aria-hidden="true"
              className="numeric pt-1 text-[length:var(--step--1)] font-bold tabular-nums"
              style={{ color: theme.accent }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>

            {/*
              The service photo. `Service.image_url` has always been in the
              catalog payload and the detail page has always rendered it, but
              this list ignored it — so a salon that uploaded a photo for every
              service still saw a text-only price list here.

              A square thumb keeps the list a list; the large version lives on
              the service's own page. Hidden below `sm` because the row is
              already two bands deep at that width. `alt=""` because the name is
              the adjacent term — announcing both would double-read it.
            */}
            {service.image ? (
              <span className="hidden pt-0.5 sm:block sm:col-start-2">
                <img
                  src={service.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full rounded-[var(--r-sm)] border object-cover"
                  style={{ borderColor: theme.border }}
                />
              </span>
            ) : null}

            <div className="min-w-0 sm:col-start-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {/*
                  The service name links to its own page. A `Service` with an
                  `Offer` at a stable URL is what lets a search result show a
                  price instead of making the visitor click through, and it is the
                  page a stylist's regular client bookmarks.
                */}
                <dt className="text-[length:var(--step-1)] font-bold text-[color:var(--c-text)]">
                  {salonSlug ? (
                    <a
                      href={`/salon/${salonSlug}/service/${service.id}`}
                      className="transition hover:text-[color:var(--c-accent-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
                    >
                      {service.name}
                    </a>
                  ) : (
                    service.name
                  )}
                </dt>
                {service.featured ? (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[length:var(--step--2)] font-bold uppercase"
                    style={{ backgroundColor: theme.accent, color: "#0b0b0d" }}
                  >
                    {t("landing.featured")}
                  </span>
                ) : null}
                {service.tier === "premium" ? (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[length:var(--step--2)] font-bold uppercase"
                    style={{
                      borderWidth: 1,
                      borderColor: theme.accent,
                      color: theme.accent2,
                    }}
                  >
                    {t("landing.tierPremium")}
                  </span>
                ) : null}
              </div>

              {service.description ? (
                <dd
                  className="measure-tight mt-2 w-full text-[length:var(--step-0)] font-medium leading-[1.75] text-[color:var(--c-muted)]"
                  style={{ letterSpacing: "var(--tracking-body)" }}
                >
                  {service.description}
                </dd>
              ) : null}

              {/* On narrow screens the price drops below the name rather than
                  squeezing the description into a sliver. */}
              <p className="flex items-baseline gap-3 sm:hidden">
                <span className="numeric text-[length:var(--step-1)] font-bold text-[color:var(--c-accent-2)]">
                  {service.price}
                </span>
                <span className="text-[length:var(--step--1)] text-[color:var(--c-faint)]">
                  {currency}
                </span>
                {service.duration ? (
                  <span className="text-[length:var(--step--1)] text-[color:var(--c-faint)]">
                    · {service.duration} {t("common.minutes")}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="col-start-2 flex items-baseline gap-4 sm:col-start-auto sm:flex-col sm:items-end sm:gap-1">
              <p className="flex items-baseline gap-2">
                <span className="numeric text-[length:var(--step-2)] font-bold text-[color:var(--c-text)]">
                  {service.price}
                </span>
                <span className="text-[length:var(--step--1)] font-semibold text-[color:var(--c-faint)]">
                  {currency}
                </span>
              </p>

              {service.duration ? (
                <p className="numeric text-[length:var(--step--1)] text-[color:var(--c-faint)]">
                  {service.duration} {t("common.minutes")}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => onBook(service)}
                className="mt-1 inline-flex items-center gap-1.5 text-[length:var(--step--1)] font-bold text-[color:var(--c-accent-2)] underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
              >
                {t("landing.bookService")}
                <ArrowUpLeft
                  size={14}
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 rtl:rotate-180"
                />
              </button>
            </div>
          </div>
        ))}
      </dl>
      )}
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  theme,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  theme: BrandTheme;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-full border px-5 py-2.5 text-[length:var(--step--1)] font-bold transition"
      style={
        active
          ? { backgroundColor: theme.accent, borderColor: theme.accent, color: "#0b0b0d" }
          : { borderColor: theme.borderStrong, color: theme.muted }
      }
    >
      {label}
    </button>
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
