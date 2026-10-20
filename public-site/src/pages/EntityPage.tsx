import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck2,
  Clock3,
  Scissors,
  Timer,
} from "lucide-react";

import api from "../services/api";
import { useI18n } from "../context/I18nContext";
import { resolveTheme, applyThemeMode } from "../lib/theme";
import { resolveAssetUrl } from "../lib/imageOptimizer";
import { buildPublicSalonPath, buildPublicBookingPath } from "../lib/publicSite";
import { DEMO, isDemoRequested } from "../lib/mockCatalog";
import { useSEO } from "../hooks/useSEO";
import { PanelSkeleton } from "../components/landing/Skeleton";
import { Button } from "../components/ui/button";
import { absoluteUrl, canonicalForPath, BRAND } from "../lib/site";

/**
 * Entity detail pages — `/salon/:slug/service/:id`, `/barber/:id`, `/offer/:id`.
 *
 * ## Why these exist
 *
 * The catalogue already contains everything a search engine needs to render a
 * price and a book button: name, description, price, duration, category, barber
 * bios, offer and original price. None of it was reachable at its own URL, and
 * none of it was in the structured data. The result was a page that could only
 * be found by typing the salon's name, with no per-service `Offer` for Google to
 * pick up — which is the entire local-SEO surface of a service business.
 *
 * ## Why one component for all three
 *
 * The three entity types share a shape: resolve one record from the catalogue,
 * present it, offer one action, and emit one schema type. Three near-identical
 * pages would drift, and the drift would be in the schema — the part nobody
 * checks by hand.
 *
 * ## Note on prerendering
 *
 * These routes cannot be prerendered. The tenant list does not exist at build
 * time (`scripts/prerender.mjs` has a hardcoded route list), so the documents are
 * client-rendered. They still resolve: every route here lives under `/salon/*`,
 * which is the path the Netlify SPA fallback covers (`netlify.toml`), and the
 * canonical/hreflang tags are written at runtime by `useSEO`.
 */

type Kind = "service" | "barber" | "offer";

interface Catalogue {
  business?: Record<string, unknown>;
  services?: Record<string, unknown>[];
  barbers?: Record<string, unknown>[];
  offers?: Record<string, unknown>[];
}

function asText(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export default function EntityPage({ kind }: { kind: Kind }) {
  const { entityId } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { t, number, price, locale } = useI18n();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(true);

  const demo = useMemo(() => isDemoRequested(routerLocation.search), [routerLocation.search]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (demo) {
          if (active) setCatalogue(DEMO! as Catalogue);
          return;
        }
        const response = await api.get("/public/booking-catalog");
        if (active) setCatalogue((response.data ?? response) as Catalogue);
      } catch {
        if (active) setCatalogue({});
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [demo]);

  const business = catalogue?.business ?? {};
  const theme = resolveTheme(business);
  const salonName = asText(business.salonName ?? business.salon_name) || BRAND.name;
  const currency = asText(business.currency) || "ج.م";
  const salonPath = buildPublicSalonPath(business);
  const bookingPath = buildPublicBookingPath(business);

  const entity = useMemo(() => {
    const id = String(entityId ?? "");
    if (!catalogue) return null;
    if (kind === "service") {
      return (catalogue.services ?? []).find((item) => asText(item.id) === id) ?? null;
    }
    if (kind === "barber") {
      return (catalogue.barbers ?? []).find((item) => asText(item.id) === id) ?? null;
    }
    return (catalogue.offers ?? []).find((item) => asText(item.id) === id) ?? null;
  }, [catalogue, kind, entityId]);

  useEffect(() => {
    applyThemeMode(theme);
  }, [theme]);

  const name =
    entity && (asText(entity.name_ar) || asText(entity.name) || asText(entity.display_name));
  const title = name || t(`landing.${kind}s.notFound`);

  /**
   * Schema per entity type. `Service` carries its `Offer`, which is the piece
   * that lets a search engine show "250 ج.م" next to the result instead of
   * making the visitor click through.
   */
  const schema = useMemo(() => {
    if (!entity) return [];
    const pageUrl = canonicalForPath(
      routerLocation.pathname,
    );
    const common = {
      "@context": "https://schema.org",
      name: title,
      description: asText(entity.description_ar || entity.description) || undefined,
      url: absoluteUrl(pageUrl),
    };

    if (kind === "service") {
      const amount = asNumber(entity.price ?? entity.base_price);
      return [
        {
          ...common,
          "@type": "Service",
          provider: { "@type": "HairSalon", name: salonName, url: absoluteUrl(salonPath) },
          ...(amount
            ? {
                offers: {
                  "@type": "Offer",
                  price: String(amount),
                  priceCurrency: "EGP",
                  availability: "https://schema.org/InStock",
                  url: absoluteUrl(bookingPath),
                },
              }
            : {}),
        },
      ];
    }

    if (kind === "barber") {
      return [
        {
          ...common,
          "@type": "Person",
          jobTitle: asText(entity.job_title) || undefined,
          image: resolveAssetUrl(entity.profile_image_url) || undefined,
          worksFor: { "@type": "HairSalon", name: salonName },
        },
      ];
    }

    const offerPrice = asNumber(entity.offer_price ?? entity.price);
    const originalPrice = asNumber(entity.original_price);
    return [
      {
        ...common,
        "@type": "Offer",
        ...(offerPrice
          ? {
              price: String(offerPrice),
              priceCurrency: "EGP",
              ...(originalPrice ? { priceSpecification: { "@type": "PriceSpecification", price: String(originalPrice), priceCurrency: "EGP" } } : {}),
            }
          : {}),
        seller: { "@type": "HairSalon", name: salonName },
        url: absoluteUrl(bookingPath),
      },
    ];
  }, [entity, kind, title, salonName, salonPath, bookingPath, routerLocation.pathname]);

  useSEO({
    title: `${title} | ${salonName}`,
    description: asText(entity?.description_ar || entity?.description) || `${title} — ${salonName}`,
    url: canonicalForPath(routerLocation.pathname),
    type: "website",
    siteName: BRAND.name,
    locale: locale === "ar" ? "ar_EG" : "en_US",
    hreflang: [{ lang: "ar", href: absoluteUrl(salonPath) }],
    schema,
  });

  if (loading) return <PanelSkeleton label={t("common.loading")} />;

  if (!entity) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="shell flex min-h-screen flex-col items-center justify-center gap-6 text-center"
        style={{ backgroundColor: theme.bg, color: theme.text }}
      >
        <Scissors size={40} aria-hidden="true" className="text-accent" />
        <h1 className="text-[length:var(--step-2)] font-bold">
          {t(`landing.${kind}s.notFound`)}
        </h1>
        <Link
          to={salonPath}
          className="btn-base btn-base--solid min-h-11 px-6 text-[length:var(--step--1)]"
        >
          <ArrowLeft size={16} aria-hidden="true" className="rtl-flip" />
          {t("nav.home")}
        </Link>
      </main>
    );
  }

  const amount = asNumber(entity.price ?? entity.offer_price);
  const duration = asNumber(entity.duration_minutes ?? entity.duration);
  const image = resolveAssetUrl(entity.profile_image_url ?? entity.image_url);
  const description = asText(entity.description_ar || entity.description);

  /** Deep-links into the booking flow with the entity preselected. */
  const bookHref =
    kind === "service"
      ? `${bookingPath}?service=${encodeURIComponent(asText(entity.id))}`
      : kind === "barber"
        ? `${bookingPath}?barber=${encodeURIComponent(asText(entity.id))}`
        : `${bookingPath}?offer=${encodeURIComponent(asText(entity.id))}`;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="shell pb-24 pt-32"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <Link
        to={salonPath}
        className="mb-10 inline-flex items-center gap-2 text-sm font-bold transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ color: theme.muted }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {salonName}
      </Link>

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        {image ? (
          <div className="lg:col-span-5">
            <img
              src={image}
              alt={title}
              className="aspect-[4/5] w-full rounded-[var(--r-xl)] object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
        ) : null}

        <div className={image ? "lg:col-span-7" : "lg:col-span-12 lg:max-w-3xl"}>
          <p
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: theme.accent }}
          >
            {t(`landing.${kind}s.eyebrow`)}
          </p>

          <h1
            className="text-[length:var(--step-4)] font-bold leading-[1.15] tracking-normal text-balance"
            style={{ color: theme.text }}
          >
            {title}
          </h1>

          {description ? (
            <p
              className="measure mt-6 whitespace-pre-line text-[length:var(--step-1)] font-medium leading-[1.75]"
              style={{ color: theme.muted }}
            >
              {description}
            </p>
          ) : null}

          <dl className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-6">
            {amount ? (
              <div>
                <dt className="text-xs font-bold" style={{ color: theme.muted }}>
                  {t("landing.priceLabel")}
                </dt>
                <dd className="numeric mt-1.5 text-[length:var(--step-2)] font-bold" style={{ color: theme.accent }}>
                  {price(amount)} {currency}
                </dd>
              </div>
            ) : null}
            {duration ? (
              <div>
                <dt className="text-xs font-bold" style={{ color: theme.muted }}>
                  {t("landing.durationLabel")}
                </dt>
                <dd className="numeric mt-1.5 text-[length:var(--step-2)] font-bold" style={{ color: theme.text }}>
                  {number(duration)} {t("common.minutes")}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            {/*
              The two shared button classes rather than a hand-rolled pair.
              These were the last two elements on the site still carrying
              `rounded-full`, a white focus ring and an inline accent
              background — i.e. the old design language, in the one page nobody
              had restyled because it is only reachable from a search result.
            */}
            <Link
              to={bookHref}
              className="btn-base btn-base--solid min-h-13 px-7 text-[length:var(--step-0)]"
            >
              <CalendarCheck2 size={18} aria-hidden="true" />
              {t("landing.bookAppointment")}
            </Link>
            <Button variant="outline" size="lg" onClick={() => navigate(salonPath)}>
              {t("landing.browseServices")}
            </Button>
          </div>

          {/*
            Why this salon. Three points, all drawn from data already on the
            page rather than invented copy — the trust surface a visitor reads
            before handing over a phone number.
          */}
          <ul className="mt-14 space-y-4 border-t border-line pt-8 text-[length:var(--step--1)] font-semibold text-ink-soft">
            <li className="flex items-center gap-3">
              <BadgeCheck size={17} aria-hidden="true" style={{ color: theme.accent }} />
              {t("landing.detailTrust.confirmed")}
            </li>
            <li className="flex items-center gap-3">
              <Timer size={17} aria-hidden="true" style={{ color: theme.accent }} />
              {t("landing.detailTrust.durationKnown")}
            </li>
            <li className="flex items-center gap-3">
              <Clock3 size={17} aria-hidden="true" style={{ color: theme.accent }} />
              {t("landing.detailTrust.hoursKnown")}
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}