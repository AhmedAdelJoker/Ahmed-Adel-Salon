import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarCheck2, Menu, Scissors, X } from "lucide-react";

import api from "../services/api";
import { useI18n } from "../context/I18nContext";
import { resolveTheme, applyThemeMode } from "../lib/theme";
import { useAppearance } from "../lib/useAppearance";
import {
  buildPublicBookingPath,
  buildPublicSalonPath,
  buildWhatsappUrl,
  resolvePublicSlug,
} from "../lib/publicSite";
import { buildLandingSiteContent } from "../lib/publicSiteContent";
import { readPublicSitePreviewDraft } from "../lib/publicSitePreview";
import {
  buildBreadcrumbSchema,
  buildFAQSchema,
  buildHairSalonSchema,
  buildServiceSchema,
  useSEO,
} from "../hooks/useSEO";
import { resolveAssetUrl } from "../lib/imageOptimizer";
import { toCurrencyCode } from "../lib/utils";
import { BRAND } from "../lib/site";
import {
  WORKING_HOURS_DAYS,
  formatHoursRange,
  isOpenNow as isSalonOpenNow,
} from "../lib/workingHours";

import { Button } from "../components/ui/button";
import LanguageSwitcher from "../components/landing/LanguageSwitcher";
import CurrencySwitcher from "../components/landing/CurrencySwitcher";
import MemberPortal from "../components/landing/MemberPortal";
import SiteFooter from "../components/landing/SiteFooter";
import ThemeToggle from "../components/landing/ThemeToggle";
import Hero from "../components/landing/Hero";
import ServicesList from "../components/landing/ServicesList";
import TeamSection from "../components/landing/TeamSection";
import OffersSection from "../components/landing/OffersSection";
import AboutSection from "../components/landing/AboutSection";
import FaqSection from "../components/landing/FaqSection";
import OwnerSections from "../components/landing/OwnerSections";
import ScrollProgress from "../components/landing/ScrollProgress";
import ScrollReveal from "../components/landing/ScrollReveal";
import ContactSection from "../components/landing/ContactSection";
import GallerySection from "../components/landing/GallerySection";
import { useMotionEnabled } from "../hooks/useMotionEnabled";
import { ServiceRowSkeleton } from "../components/landing/Skeleton";

/**
 * The salon landing page.
 *
 * ## Why this file was rewritten rather than restyled
 *
 * It carried its own `themes` object — a copy of `lib/theme.ts` with `isDark`
 * dropped — and painted every surface through inline `style={{}}`, so switching
 * a salon's palette meant editing JSX. It also hardcoded `#D4AF37` in ten
 * places and rendered two `blur-[120px]` decorative circles that cost a
 * repaint per frame and produced a grey haze between the header and the hero.
 *
 * The page now resolves one palette through `resolveTheme()` and hands it to
 * `applyThemeMode()`, which writes it onto <html> as CSS custom properties.
 * Everything below styles itself with palette utilities (`text-ink`,
 * `border-line`, `text-accent`), so no colour literal survives in this file.
 *
 * ## The layout
 *
 * An asymmetric 12-column grid rather than the previous stack of centred
 * three-card rows. The type block sits off-axis on seven columns with the
 * booking aside dropped below it on five, which is what stops the page reading
 * as a template. Sections are separated by hairlines and whitespace instead of
 * by a box, and a box is now reserved for things that can be acted on.
 */

const FALLBACK_HERO =
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1800&auto=format&fit=crop";

/**
 * The FAQ questions, as translation keys.
 *
 * One list, read twice: once to build the `FAQPage` schema and once to render
 * the section. Keeping them as a shared constant is what stops the two from
 * drifting -- a question present in the structured data but absent from the page
 * describes content a visitor cannot reach, and one that is on the page but not
 * in the schema forfeits the rich result.
 */
const FAQ_KEYS = [
  { q: "faq.online", a: "faq.onlineAnswer" },
  { q: "faq.prices", a: "faq.pricesAnswer" },
  { q: "faq.contact", a: "faq.contactAnswer" },
] as const;

type Catalog = {
  business?: Record<string, any>;
  services?: any[];
  categories?: any[];
  barbers?: any[];
  offers?: any[];
};

/**
 * Verified public reviews.
 *
 * `GET /reviews/public` has been public, unauthenticated and rate-limited all
 * along and was never called. Owner-typed testimonials are marketing copy;
 * these carry `is_verified_visit`, which is the difference between "what the
 * salon says about itself" and "what a customer who actually came said".
 *
 * Fetched separately from the catalogue because a salon with no reviews is a
 * normal state, not an error — it must not delay or blank the page.
 */
export interface PublicReview {
  id: number;
  rating: number;
  comment: string;
  customer_name_snapshot: string;
  is_public: boolean;
  is_verified_visit: boolean;
  created_at: string;
}

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [appearance] = useAppearance();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /** `?livePreview=1` renders an unsaved draft from the admin settings panel. */
  const livePreview = useMemo(
    () => new URLSearchParams(location.search).get("livePreview") === "1",
    [location.search],
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await api.get("/public/booking-catalog");
        if (active) setCatalog((response.data ?? response) as Catalog);
      } catch {
        // A failed catalogue leaves the page rendering its empty states rather
        // than blanking: the visitor still gets the name, hours and contact
        // details, which are the two things a salon must never hide.
        if (active) setCatalog({});
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [livePreview]);

  /**
   * Reviews load in parallel with the catalogue and are never awaited by it.
   * An empty review list is the normal case for a new salon, so a failure here
   * is silent by design — the testimonials section simply renders the owner's
   * own copy, or nothing.
   */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await api.get("/reviews/public");
        const data = response.data ?? response;
        if (active && Array.isArray(data)) {
          setReviews(
            data.filter(
              (review: PublicReview) =>
                review.is_public && review.rating > 0 && review.comment,
            ),
          );
        }
      } catch {
        /* a salon with no reviews is not a broken page */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /**
   * Memoised because five `useMemo`s below depend on it. A fresh object literal
   * on every render would invalidate all of them on every render, which is the
   * same as not memoising at all.
   */
  const settings: Record<string, any> = useMemo(() => {
    const business = catalog?.business ?? {};
    const preview = livePreview ? readPublicSitePreviewDraft() : null;
    return { ...business, ...(preview ?? {}) };
  }, [catalog, livePreview]);

  const theme = useMemo(
    () => resolveTheme(settings, appearance),
    [settings, appearance],
  );

  /**
   * Paint the palette. This has to happen before the sections render, not in a
   * child effect: `applyThemeMode` writes `--c-*` onto <html>, and the
   * utilities in this file resolve against those. A `dark` page would otherwise
   * flash a bone-coloured hero for one frame.
   */
  useEffect(() => {
    applyThemeMode(theme);
  }, [theme]);

  const salonName =
    settings.salonName || settings.salon_name || BRAND.name;
  const salonSlug = resolvePublicSlug(settings);
  const currency = settings.currency || "ج.م";
  const content = useMemo(() => buildLandingSiteContent(settings), [settings]);
  // Owner's motion switch AND-ed with the visitor's OS preference — see
  // `useMotionEnabled`. Gates the scroll-reveal observer, not individual
  // components, so there is a single place that decides.
  const motionEnabled = useMotionEnabled(content.motionEnabled);

  const heroImage =
    resolveAssetUrl(
      settings.landingCoverImageUrl || settings.landing_cover_image_url,
    ) || FALLBACK_HERO;
  const heroImageAlt =
    settings.landingHeroImageAlt ||
    settings.landing_hero_image_alt ||
    t("landing.heroImageAlt", { salon: salonName });

  const bookingPath = buildPublicBookingPath(settings);
  const salonPath = buildPublicSalonPath(settings);

  const phone = settings.shopPhone || settings.shop_phone || "";
  const whatsappUrl = buildWhatsappUrl(
    settings.shopWhatsApp || settings.shop_whatsapp || phone,
  );
  const mapsUrl =
    settings.googleMapsUrl ||
    settings.google_maps_url ||
    (settings.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
      : null);

  const address = settings.address || "";
  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${salonPath}`
      : "";

  /* ── Hours ─────────────────────────────────────────────────────────── */

  const workingHours = useMemo(() => {
    const source =
      settings.workingHours || settings.working_hours || ({} as Record<string, any>);

    return WORKING_HOURS_DAYS.map((key) => {
      const entry = source[key];
      const isOpen = Boolean(entry?.is_open);
      return {
        dayLabel: t(`day.${key}`),
        // `formatHoursRange` marks a window that closes on the following day, so
        // "22:00 – 02:00" reads as one overnight shift rather than a typo.
        range: formatHoursRange(entry, t("common.closed")),
        isOpen,
        // Carried through for the inline booking picker's suggested slots: the
        // list needs the actual window, not just the formatted label.
        openTime: entry?.open_time ?? undefined,
        closeTime: entry?.close_time ?? undefined,
      };
    });
  }, [settings, t]);

  const isOpenNow = useMemo(() => {
    const source =
      settings.workingHours || settings.working_hours || ({} as Record<string, any>);
    return isSalonOpenNow(source);
  }, [settings]);

  /**
   * One line for the announcement strip: today's window, or nothing.
   *
   * Derived rather than authored, because a strip that hard-codes "10:00–22:00"
   * goes stale the moment the owner edits their hours and there is no second
   * place to update. Today's row is picked by day name from the same source the
   * hours table reads, so the strip and the table cannot disagree.
   *
   * Null when the salon has published no hours at all — a salon that has not
   * filled the field in should not advertise "every day, all day".
   */
  const hoursSummary = useMemo(() => {
    const source =
      settings.workingHours || settings.working_hours || ({} as Record<string, any>);
    const anyConfigured = Object.values(source).some(
      (entry: any) => entry?.is_open && entry?.open_time && entry?.close_time,
    );
    if (!anyConfigured) return null;

    const todayKey = WORKING_HOURS_DAYS[new Date().getDay()];
    const today = source?.[todayKey];
    if (!today?.is_open || !today.open_time || !today.close_time) {
      return isOpenNow ? t("landing.openNowBooking") : t("landing.closedNow");
    }
    const todayLabel = t(`day.${todayKey}`);
    const window = formatHoursRange(today, t("common.closed"));
    return `${isOpenNow ? t("landing.openNowBooking") : t("landing.closedNow")} · ${todayLabel} ${window}`;
  }, [settings, isOpenNow, t]);

  /* ── Collections, shaped for the components that render them ────────── */

  const serviceItems = useMemo(
    () =>
      (catalog?.services ?? []).slice(0, 12).map((service: any) => ({
        id: service.id,
        name: service.name_ar || service.name || t("landing.serviceFallbackName"),
        description:
          service.description_ar ||
          service.description ||
          t("landing.serviceFallbackDescription"),
        image: resolveAssetUrl(service.image_url),
        duration:
          service.duration_minutes || service.duration
            ? `${service.duration_minutes || service.duration} ${t("common.minutes")}`
            : undefined,
        price: Number(service.price || 0),
        featured: Boolean(service.is_featured),
        /*
          Carried through so `ServicesList` can filter without a second lookup.
          The category's own name is resolved lazily in that component from the
          list it was given, so a category the owner renamed still labels
          correctly instead of showing a stale id.
        */
        categoryId: service.category_id ?? service.categoryId ?? null,
        categoryName:
          service.category_name_ar ||
          service.category_name ||
          service.category?.name_ar ||
          service.category?.name ||
          null,
      })),
    [catalog, t],
  );

  /**
   * Filter categories, built from `catalog.categories` rather than from the
   * services.
   *
   * A service row carries `category_id` but not the category's name, so
   * deriving the chips from the services alone can only produce ids — and a chip
   * labelled "1" is worse than no chip. The catalogue endpoint returns the real
   * list, so that is the source.
   */
  const serviceCategories = useMemo(() => {
    const fromCatalog = Array.isArray(catalog?.categories)
      ? catalog.categories
          .map((entry: any) => ({
            id: String(entry?.id ?? ""),
            name: entry?.name_ar || entry?.name || "",
          }))
          .filter((entry: { id: string; name: string }) => entry.id && entry.name)
      : [];

    if (fromCatalog.length > 0) return fromCatalog;

    // Fallback for a catalogue that omits the category list: label from the
    // denormalised name on the service, if the API sent one.
    const seen = new Map<string, string>();
    for (const service of serviceItems) {
      const id = service.categoryId ? String(service.categoryId) : "";
      if (id && service.categoryName && !seen.has(id)) seen.set(id, service.categoryName);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [catalog, serviceItems]);

  const offerItems = useMemo(
    () =>
      (catalog?.offers ?? []).slice(0, 6).map((offer: any) => ({
        id: offer.id,
        name: offer.name_ar || offer.name || t("landing.specialOffer"),
        description: offer.description_ar || offer.description || t("landing.limitedOffer"),
        price: Number(offer.offer_price || offer.price || 0),
        originalPrice: Number(offer.original_price || 0) || undefined,
        discountPercent: Number(offer.discount_percentage || 0) || undefined,
        currency,
      })),
    [catalog, currency, t],
  );

  const showStaff = settings.landingShowStaff !== false;
  const teamMembers = useMemo(
    () =>
      (catalog?.barbers ?? []).slice(0, 6).map((barber: any) => ({
        id: barber.id,
        name: barber.display_name || t("landing.teamFallbackTitle"),
        role: barber.job_title || undefined,
        bio: barber.bio_ar || barber.bio_en || barber.bio || undefined,
        image: barber.profile_image_url ?? null,
      })),
    [catalog, t],
  );

  useSEO({
    title: settings.metaTitle || `${salonName} | ${t("landing.bookAppointment")}`,
    description:
      settings.metaDescription ||
      t("landing.metaDescription") ||
      `${salonName} — ${t("landing.servicesTitle")}`,
    image: heroImage,
    url: pageUrl,
    type: "website",
    siteName: salonName,
    locale: "ar_EG",
    keywords: settings.metaKeywords || `${salonName}, صالون, حلاقة, حجز أونلاين`,
    preloadImage: heroImage,
    schema: [
      buildHairSalonSchema({
        settings,
        salonName,
        heroImage,
        url: pageUrl,
        address,
      }),
      buildBreadcrumbSchema({
        items: [
          {
            name: t("nav.home"),
            url: typeof window !== "undefined" ? window.location.origin : "",
          },
          { name: salonName, url: pageUrl },
        ],
      }),
      buildFAQSchema({
        // All three, not one. Every key exists in both catalogues, and
        // publishing a single question while the page shows none is the worst
        // of both: no rich result, and a schema describing something a visitor
        // cannot find.
        faqs: FAQ_KEYS.map(({ q, a }) => ({ q: t(q), a: t(a) })),
      }),
      // Per-service pricing. This is the schema that can put a number in a
      // search result, so it is only worth emitting when the salon actually
      // publishes a catalogue -- `buildServiceSchema` returns null for an empty
      // list rather than an empty node.
      ...(buildServiceSchema({
        services: serviceItems
          .filter((service) => service.price > 0)
          .map((service) => ({
            name: service.name,
            description: service.description,
            price: service.price,
            image: service.image,
            url:
              salonSlug && service.id != null
                ? `${pageUrl.replace(/\/$/, "")}/service/${service.id}`
                : undefined,
          })),
        currency: toCurrencyCode(currency),
        salonUrl: pageUrl,
        salonName,
      }) ?? []),
    ],
  });

  /**
   * Anchors are derived from the same conditions that gate the sections below.
   * The previous header advertised `#offers` and `#team` unconditionally while
   * the page rendered neither, so both links scrolled nowhere.
   */
  const navLinks = [
    { label: t("nav.home"), href: "#home" },
    { label: t("nav.services"), href: "#services" },
    offerItems.length ? { label: t("nav.offers"), href: "#offers" } : null,
    showStaff && teamMembers.length
      ? { label: t("nav.team"), href: "#team" }
      : null,
    /*
      The FAQ always renders -- it is built from static translation keys, so
      there is no data condition that could leave the section missing -- so the
      link is unconditional for the same reason `#services` is.
    */
    { label: t("nav.faq"), href: "#faq" },
    { label: t("nav.contact"), href: "#contact" },
  ].filter((link): link is { label: string; href: string } => link !== null);

  /**
   * Nav links as the footer wants them: an id and a label, without the `#`.
   * Re-deriving them here rather than passing `navLinks` through avoids the
   * footer having to strip a prefix it does not own.
   */
  const footerNavLinks = navLinks.map((link) => ({
    id: link.href.replace("#", ""),
    label: link.label,
  }));

  /** Salon photos for the footer strip. */
  const portfolioPhotos = useMemo(
    () =>
      (Array.isArray(settings.landing_portfolio)
        ? settings.landing_portfolio
        : [])
        .map((entry: any) =>
          resolveAssetUrl(typeof entry === "string" ? entry : entry?.url),
        )
        .filter((url: string | null): url is string => Boolean(url))
        .slice(0, 6),
    [settings],
  );

  /** Social rows for the footer, with only the links the salon actually set. */
  const socialLinks = [
    { key: "socialFacebook", icon: "facebook", label: "Facebook" },
    { key: "socialInstagram", icon: "instagram", label: "Instagram" },
    { key: "socialTiktok", icon: "tiktok", label: "TikTok" },
    { key: "socialYoutube", icon: "youtube", label: "YouTube" },
  ]
    .filter((item) => Boolean(settings[item.key]))
    .map((item) => ({ ...item, href: String(settings[item.key]) }));

  if (loading) return <ServiceRowSkeleton rows={6} />;

  const logoImage = resolveAssetUrl(settings.logoUrl || settings.logo_url);

  return (
    <div className="grain relative min-h-screen overflow-x-hidden pb-20">
      <ScrollProgress />
      {/* Mounted only when motion is on; the component returns null otherwise,
          and unmounting removes the `js-reveal-ready` class that gates the
          hidden state, so the page is static rather than stuck invisible. */}
      {motionEnabled ? <ScrollReveal /> : null}

      {/* ── Header ───────────────────────────────────────────────────── */}
      {/*
        The announcement strip above the header.

        It answers the question every first-time visitor has — are you open, and
        can I get a slot today — before they scroll, and it is derived from the
        salon's own `workingHours` rather than typed in. Nothing is rendered
        when there are no hours on file: a strip that says nothing is a strip
        that costs a line of vertical space for nothing.
      */}
      {hoursSummary ? (
        <div
          className="mk-topbar"
          role="status"
          // Announced once on load rather than on every change: the same text
          // appears in the hero pill, and a screen reader meeting both is
          // hearing it twice.
          aria-live="off"
        >
          {hoursSummary}
        </div>
      ) : null}

      <header className="sticky top-0 z-50" data-scrolled={scrolled}>
        <div className="mk-shell flex items-center gap-8 py-4">
          <a
            href="#home"
            onClick={() => setMenuOpen(false)}
            className="flex min-w-0 items-center gap-3"
          >
            <span
              className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[length:var(--r-md)] font-black"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                color: theme.onAccent,
              }}
            >
              {logoImage ? (
                <img src={logoImage} alt={salonName} className="h-full w-full object-cover" />
              ) : (
                <Scissors size={18} aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[length:var(--step-0)] font-black">
                {salonName}
              </span>
              <span
                className="block text-[length:var(--step--2)] font-semibold text-ink-faint"
                style={{ letterSpacing: "var(--tracking-eyebrow)" }}
              >
                {t("landing.professionalSalon")}
              </span>
            </span>
          </a>

          {/*
            `landingPublicHeaderBadge`. It had a labelled input in
            `WebsiteSettingsPanel` and was read into the content builder, but
            nothing rendered it: the value reached the page and was dropped.
            Rendered only when the owner actually filled it in.
          */}
          {content.copy.landingPublicHeaderBadge ? (
            <span className="chip chip--accent hidden lg:inline-flex">
              {content.copy.landingPublicHeaderBadge}
            </span>
          ) : null}

          <nav className="ms-auto hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-[length:var(--r-sm)] px-3 py-2 text-[length:var(--step--1)] font-semibold text-ink-soft transition-colors duration-200 hover:bg-accent-wash hover:text-accent"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden items-center gap-1 md:flex">
              <ThemeToggle />
              <LanguageSwitcher />
              <CurrencySwitcher />
              <MemberPortal salonName={salonName} coverImageUrl={settings.landingCoverImageUrl || settings.landing_cover_image_url} />
            </div>
            <button
              type="button"
              onClick={() => navigate(bookingPath)}
              className="mk-btn mk-btn-primary mk-btn-sm hidden sm:inline-flex"
              style={{ backgroundColor: theme.accent, color: theme.onAccent }}
            >
              {t("nav.bookNow")}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              className="grid size-10 place-items-center rounded-[length:var(--r-sm)] border border-line text-ink lg:hidden"
            >
              {menuOpen ? (
                <X size={20} aria-hidden="true" />
              ) : (
                <Menu size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="relative z-10 border-t border-line lg:hidden">
            <div className="shell flex flex-col gap-1 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-[length:var(--r-sm)] px-3 py-3 text-[length:var(--step-0)] font-medium"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex items-center gap-1 border-t border-line pt-4 md:hidden">
                <ThemeToggle />
                <LanguageSwitcher />
                <CurrencySwitcher />
                <MemberPortal salonName={salonName} coverImageUrl={settings.landingCoverImageUrl || settings.landing_cover_image_url} />
              </div>
              <Button onClick={() => navigate(bookingPath)} className="mt-3">
                {t("landing.bookYourAppointment")}
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <main id="main-content" className="relative z-10" tabIndex={-1}>
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div id="home">
          <Hero
            theme={theme}
            t={t}
            heroImage={heroImage}
            heroImageAlt={heroImageAlt}
            heroVideo={content.heroVideo}
            badge={
              content.copy.landingHeroBadge || t("landing.professionalSalon")
            }
            headline={
              content.copy.landingHeroTitle ||
              t("landing.heroFallbackTitle", { salon: salonName })
            }
            subhead={
              content.copy.landingHeroSubtitle ||
              t("landing.heroFallbackSubtitle")
            }
            ctaLabel={t("landing.bookAppointment")}
            secondaryCtaLabel={t("landing.browseServices")}
            onBook={() => navigate(bookingPath)}
            onJumpToServices={() =>
              document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })
            }
            stats={{
              services: (catalog?.services ?? []).length,
              barbers: (catalog?.barbers ?? []).length,
            }}
            isOpenNow={isOpenNow}
            openLabel={t("landing.statusLabel")}
            location={address}
            phone={phone}
            highlight={
              content.copy.landingHeroHighlightTitle
                ? {
                    badge: content.copy.landingHeroHighlightBadge,
                    title: content.copy.landingHeroHighlightTitle,
                    subtitle: content.copy.landingHeroHighlightSubtitle,
                  }
                : undefined
            }
            trustStats={content.stats}
            motionEnabled={content.motionEnabled}
            booking={
              serviceItems.length > 0
                ? {
                    services: serviceItems.slice(0, 12).map((service) => ({
                      id: String(service.id ?? service.name),
                      name: service.name,
                      price: service.price,
                      duration: service.duration,
                    })),
                    barbers: showStaff
                      ? teamMembers.map((member) => ({
                          id: String(member.id ?? member.name),
                          name: member.name,
                        }))
                      : [],
                    /*
                      Slots are generated from the salon's own working hours, not
                      fetched: `GET /public/availability` is a per-barber, per-day
                      query and firing it from the hero would put a blocking call
                      in front of the LCP. These are *suggestions* — the real
                      check happens in the booking flow, which is why the confirm
                      button hands the visitor there instead of claiming a slot.
                    */
                    slots: buildSuggestedSlots(workingHours, isOpenNow),
                    currency,
                  }
                : undefined
            }
            onInlineConfirm={(choice) => {
              const params = new URLSearchParams({
                service: choice.serviceId,
                slot: choice.slot,
              });
              if (choice.barberId) params.set("barber", choice.barberId);
              navigate(`${buildPublicBookingPath(settings)}?${params.toString()}`);
            }}
          />
        </div>

        {/* ── Count rail ─────────────────────────────────────────────── */}
        <section className="rule border-b">
          <dl className="reveal shell grid grid-cols-2 divide-x divide-line sm:grid-cols-4">
            <StatCell label={t("landing.statServices")} value={serviceItems.length} />
            <StatCell
              label={t("landing.statBarbers")}
              value={showStaff ? teamMembers.length : 0}
            />
            <StatCell
              label={t("landing.statOpen")}
              value={isOpenNow ? t("common.open") : t("common.closed")}
            />
            <StatCell
              label={t("landing.statHours")}
              value={workingHours.filter((day) => day.isOpen).length}
            />
          </dl>
        </section>

        {/* ── Services ───────────────────────────────────────────────── */}
        <ServicesList
          theme={theme}
          t={t}
          eyebrow={content.copy.landingServicesEyebrow}
          title={content.copy.landingServicesTitle || t("landing.servicesTitle")}
          subtitle={
            content.copy.landingServicesSubtitle || t("landing.servicesSubtitle")
          }
          services={serviceItems}
          currency={currency}
          onBook={() => navigate(bookingPath)}
          salonSlug={salonSlug}
          categories={serviceCategories}
        />

        <AboutSection
          t={t}
          eyebrow={content.copy.landingAboutEyebrow}
          title={settings.landingAboutTitle || settings.landing_about_title}
          content={settings.landingAboutContent || settings.landing_about_content}
          image={resolveAssetUrl(
            content.copy.landingAboutImageUrl ||
              settings.landing_about_image_url ||
              settings.landingAboutImageUrl,
          )}
          imageAlt={
            content.copy.landingAboutImageAlt ||
            settings.landing_about_image_alt ||
            ""
          }
          features={content.features}
          yearsExperience={
            content.copy.landingAboutYearsExperience ||
            settings.landing_about_years_experience ||
            ""
          }
          ownerMotionEnabled={content.motionEnabled}
        />

        {/* ── Offers ─────────────────────────────────────────────────── */}
        {offerItems.length ? (
          <OffersSection
            theme={theme}
            offers={offerItems}
            title={content.copy.landingOffersTitle || t("landing.offersTitle")}
            subtitle={
              content.copy.landingOffersSubtitle || t("landing.offersSubtitle")
            }
            onBook={() => navigate(bookingPath)}
            salonSlug={salonSlug}
            t={t}
          />
        ) : null}

        {/* ── Team ───────────────────────────────────────────────────── */}
        {showStaff && teamMembers.length ? (
          <TeamSection
            theme={theme}
            members={teamMembers}
            title={content.copy.landingTeamTitle || t("landing.teamTitle")}
            subtitle={
              content.copy.landingTeamSubtitle || t("landing.teamSubtitle")
            }
            showBios={settings.landingShowStaffBio !== false}
salonSlug={salonSlug}
            t={t}
            onBook={(member) => {
              // Pre-select the stylist on the booking page. The id is only a
              // hint: the booking flow re-reads the catalogue, so a stale id
              // leaves the visitor on step 1 rather than booking the wrong
              // person.
              const params = new URLSearchParams();
              if (member.id) params.set("barber", String(member.id));
              const qs = params.toString();
              navigate(qs ? `${bookingPath}?${qs}` : bookingPath);
            }}
            ownerMotionEnabled={content.motionEnabled}
          />
        ) : null}

        {/* ── Owner-configured sections ──────────────────────────────── */}
        <OwnerSections
          content={content}
          theme={theme}
          contactLinks={{ phone, whatsapp: whatsappUrl ?? undefined, maps: mapsUrl ?? undefined }}
          address={address}
          workingHours={workingHours}
          isOpenNow={isOpenNow}
          onBook={() => navigate(bookingPath)}
          t={t}
          locale={locale}
          reviews={reviews}
        />

        {/* ── Gallery ────────────────────────────────────────────────── */}
        {/*
          Owner-uploaded images from `landingPortfolio`. Renders nothing when
          no images are configured.
        */}
        <GallerySection
          eyebrow={content.copy.landingPortfolioEyebrow}
          title={content.copy.landingPortfolioTitle || t("landing.galleryTitle")}
          images={content.portfolio.map((img, i) => ({
            id: img,
            src: img,
            alt: `صورة رقم ${i + 1}`,
          }))}
        />

        {/*
          The FAQ. Placed after the owner's sections and before the contact
          block so it answers the objections that come up while reading the
          team and the reviews, and so it sits directly above the two things a
          visitor decides between: call the salon or book.
        */}
        <FaqSection
          theme={theme}
          t={t}
          items={FAQ_KEYS.map(({ q, a }) => ({ q: t(q), a: t(a) }))}
          title={t("landing.faqTitle")}
          subtitle={t("landing.faqSubtitle")}
          eyebrow={t("landing.faqEyebrow")}
        />

        {/* ── Contact ──────────────────────────────── */}
        {/*
          The closing band: contact rows on the left, the map link on the
          right. Hours are not repeated here — `OwnerSections` already draws
          them together with the open/closed label.
        */}
        <ContactSection
          t={t}
          eyebrow={content.copy.landingContactEyebrow || t("nav.contact")}
          title={content.copy.landingContactTitle || salonName}
          subtitle={content.copy.landingContactSubtitle || undefined}
          address={address ?? undefined}
          phone={phone ?? undefined}
          whatsappUrl={whatsappUrl ?? undefined}
          mapsUrl={mapsUrl ?? undefined}
        />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <SiteFooter
        salonName={salonName}
        salonSlug={salonSlug}
        logoImage={logoImage}
        tagline={content.copy.landingFinalSubtitle}
        phone={phone}
        whatsappUrl={whatsappUrl ?? undefined}
        mapsUrl={mapsUrl ?? undefined}
        address={address}
        socialLinks={socialLinks}
        navLinks={footerNavLinks}
        bookingPath={bookingPath}
        photos={portfolioPhotos}
        hasPortfolio={portfolioPhotos.length > 0}
        t={t}
      />

      {/* ── Mobile CTA ───────────────────────────────────────────────── */}
      {/*
        The design's `mcta` is a full-width bar pinned to the bottom edge, not a
        floating pill inset from it. A pill leaves the page's own background
        visible on both sides and beside the safe-area inset, which reads as a
        widget dropped on top of the page rather than part of it; and an inset
        pill sits *above* the home indicator's inset on iOS, so the tap target
        is partly under the gesture area.

        `padding-bottom: env(safe-area-inset-bottom)` is in the stylesheet for
        that reason, and `footer { padding-bottom }` is raised to clear the bar.
      */}
      <div className="mk-mcta lg:hidden print-hide">
        <button
          type="button"
          onClick={() => navigate(bookingPath)}
          className="mk-btn mk-btn-primary mk-btn-lg w-full"
          style={{ backgroundColor: theme.accent, color: theme.onAccent }}
        >
          <CalendarCheck2 size={17} aria-hidden="true" />
          {t("landing.bookYourAppointment")}
        </button>
      </div>
    </div>
  );
}

/**
 * Suggested start times for the inline hero picker.
 *
 * These are *suggestions*, not availability — the booking service is the only
 * source of truth for a free slot, and asking it from the hero would put a
 * request in front of the LCP. The confirm button hands the visitor to the
 * booking flow, which re-checks for real.
 *
 * The range comes from the salon's own hours, so a shop open 09:00–22:00 never
 * offers 07:00. Past times are skipped only while the salon is open; when it is
 * closed the whole day is offered, because a salon that opens at 09:00 has not
 * run out of availability just because you looked at the page at 20:00.
 */
function buildSuggestedSlots(
  workingHours: { isOpen: boolean; openTime?: string; closeTime?: string }[],
  isOpenNow: boolean,
): string[] {
  const day = workingHours.find((entry) => entry.isOpen);
  const open = day?.openTime || "10:00";
  const close = day?.closeTime || "20:00";

  const toMinutes = (value: string): number => {
    const [h, m] = value.split(":").map(Number);
    return (Number.isFinite(h) ? h : 10) * 60 + (Number.isFinite(m) ? m : 0);
  };

  const start = toMinutes(open);
  // A close at or before open means the shift crosses midnight (a salon open
  // until 03:00); extend rather than loop backwards and hang.
  let end = toMinutes(close);
  if (end <= start) end = start + 12 * 60;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: string[] = [];
  // 45-minute steps: roughly the shortest service, so consecutive suggestions
  // cannot overlap into a time the salon could not actually honour.
  for (let m = start; m <= end && slots.length < 6; m += 45) {
    if (isOpenNow && m <= nowMinutes) continue;
    const hh = String(Math.floor(m / 60) % 24).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

/** One cell of the count rail. A zero count renders an em dash, not a "0". */
function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-4 py-6 text-center">
      <dd className="numeric text-[length:var(--step-2)] font-bold text-accent">
        {value === 0 || value === "" ? "—" : value}
      </dd>
      <dt className="mt-1.5 text-[length:var(--step--2)] text-ink-faint">
        {label}
      </dt>
    </div>
  );
}
