import { useMemo, useState } from "react";
import { ShieldCheck, Sparkles, MapPin, Phone, MessageCircle, Clock3 } from "lucide-react";

import type { BrandTheme } from "../../lib/theme";
import type { LocaleCode } from "../../context/I18nContext";
import { formatDate } from "../../lib/i18n";
import type {
  LandingContent,
  LandingFeature,
  LandingTestimonial,
} from "../../lib/publicSiteContent";
import { resolveAssetUrl } from "../../lib/imageOptimizer";
import Lightbox from "./Lightbox";

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export interface OwnerSectionsProps {
  content: LandingContent;
  theme: BrandTheme;
  /** Owner's WhatsApp/phone, for the quick-actions row. */
  contactLinks: { phone?: string; whatsapp?: string; maps?: string };
  address?: string;
  workingHours: { dayLabel: string; range: string; isOpen: boolean }[];
  isOpenNow: boolean;
  onBook: () => void;
  t: Translate;
  /**
   * The visitor's active locale, for formatting dates.
   *
   * Passed rather than read from context because every section here already
   * receives `t` as a prop; mixing the two would leave the locale reachable
   * from some sections and not others.
   */
  locale: LocaleCode;
  /** Public reviews fetched from the API (verified visits). */
  reviews?: LandingReview[];
}

export interface LandingReview {
  id: number;
  rating: number;
  comment: string;
  customer_name_snapshot: string;
  is_public: boolean;
  is_verified_visit: boolean;
  created_at: string;
}

/* ── shared bits ─────────────────────────────────────────────────────────── */

function Eyebrow({ children, theme }: { children: string; theme: BrandTheme }) {
  return (
    <p
      className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]"
      style={{ color: theme.accent }}
    >
      {children}
    </p>
  );
}

function Section({
  id,
  eyebrow,
  title,
  subtitle,
  theme,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  theme: BrandTheme;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto mb-8 w-full max-w-3xl text-center sm:mb-12">
        {eyebrow ? <Eyebrow theme={theme}>{eyebrow}</Eyebrow> : null}
        <h2
          className="text-2xl font-bold leading-tight tracking-normal text-balance sm:text-4xl"
          style={{ color: theme.text }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mx-auto mt-4 w-full max-w-2xl text-sm font-bold leading-8 sm:text-base" style={{ color: theme.muted }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Card({
  theme,
  className = "",
  children,
}: {
  theme: BrandTheme;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-3xl border p-6 shadow-sm ${className}`}
      style={{ backgroundColor: theme.card, borderColor: theme.border }}
    >
      {children}
    </div>
  );
}

/* ── the sections ────────────────────────────────────────────────────────── */

/**
 * The landing sections that exist purely because the owner configured them.
 *
 * Every one of these renders only when the corresponding settings are present.
 * `WebsiteSettingsPanel` exposes ~36 `landing*` fields; before this component
 * existed, seven of them reached the page and the rest were saved to the API
 * and silently discarded. Sections with no content are not rendered rather than
 * rendered empty, so a new salon shows a clean page instead of hollow shells.
 */
export default function OwnerSections({
  content,
  theme,
  contactLinks,
  address,
  workingHours,
  isOpenNow,
  onBook,
  t,
  locale,
  reviews,
}: OwnerSectionsProps) {
  const { copy, portfolio, stats, features, trustBadges, testimonials } = content;
  const [lightbox, setLightbox] = useState<{ index: number; src: string; alt: string } | null>(null);

  /**
   * Portfolio entries arrive as raw strings that may or may not resolve to a URL.
   * Filtering here — once — keeps the grid from rendering broken images and gives
   * the lightbox a dense array whose indices match the visible thumbnails.
   */
  const galleryImages = useMemo(
    () =>
      portfolio
        .map((entry) => resolveAssetUrl(entry))
        .filter((src): src is string => Boolean(src))
        .map((src, index) => ({
          src,
          alt: `${copy.landingPortfolioTitle || "gallery"} ${index + 1}`,
        })),
    [portfolio, copy.landingPortfolioTitle],
  );

  return (
    <>
      {trustBadges.length > 0 ? (
        <section aria-label={t("landing.trustBadges")} className="mx-auto w-full max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <ul className="flex flex-wrap items-center justify-center gap-3">
            {trustBadges.map((badge) => (
              <li
                key={badge.label}
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-bold"
                style={{ backgroundColor: theme.card, borderColor: theme.border, color: theme.muted }}
              >
                <ShieldCheck size={14} aria-hidden="true" style={{ color: theme.accent }} />
                {badge.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stats.length > 0 ? (
        <section aria-label={t("landing.stats")} className="mx-auto w-full max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={`${stat.value}-${stat.label}`} theme={theme} className="text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span
                    className="block text-3xl font-bold leading-none"
                    style={{ color: theme.accent }}
                  >
                    {stat.value}
                  </span>
                  <span className="mt-2 block text-xs font-bold" style={{ color: theme.muted }}>
                    {stat.label}
                  </span>
                </dd>
              </Card>
            ))}
          </dl>
        </section>
      ) : null}

      {features.length > 0 ? (
        <Section
          eyebrow={copy.landingServicesEyebrow}
          title={copy.landingServicesTitle || t("landing.featuresTitle")}
          subtitle={copy.landingServicesSubtitle}
          theme={theme}
        >
          <ul className="grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} theme={theme} />
            ))}
          </ul>
        </Section>
      ) : null}

      {portfolio.length > 0 ? (
        <Section
          id="portfolio"
          eyebrow={copy.landingPortfolioEyebrow}
          title={copy.landingPortfolioTitle || t("landing.portfolioTitle")}
          theme={theme}
        >
          {/*
            The owner can upload up to twenty images in WebsiteSettingsPanel and
            none of them were shown. This is that gallery.

            The thumbnails are now buttons: for a salon the work is the proof, so
            a grid that cannot be opened is decoration. The grid's aspect ratio is
            kept via `aspect-[4/5]` on the button so activating it does not shift
            the layout.
          */}
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {galleryImages.map((image, index) => (
              <li key={`${image.src}-${index}`}>
                <button
                  type="button"
                  onClick={() => setLightbox({ index, src: image.src, alt: image.alt })}
                  className="group block w-full overflow-hidden rounded-3xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  style={{ borderColor: theme.border }}
                  aria-label={t("landing.portfolioOpen", { index: index + 1 })}
                >
                  <span className="block aspect-[4/5] overflow-hidden">
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {lightbox ? (
            <Lightbox
              index={lightbox.index}
              images={galleryImages}
              labels={{
                close: t("common.close"),
                previous: t("common.previous"),
                next: t("common.next"),
                counter: t("landing.portfolioCounter"),
              }}
              onClose={() => setLightbox(null)}
              onNavigate={(next) => setLightbox((current) => (current ? { ...current, index: next } : null))}
            />
          ) : null}
        </Section>
      ) : null}

      {copy.landingBookingTitle ? (
        <Section
          eyebrow={copy.landingBookingEyebrow}
          title={copy.landingBookingTitle}
          subtitle={copy.landingBookingSubtitle}
          theme={theme}
        >
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onBook}
              className="min-h-14 rounded-2xl px-8 text-base font-bold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              style={{ backgroundColor: theme.accent, color: "var(--c-bg)" }}
            >
              {copy.landingFinalButtonLabel || t("landing.bookAppointment")}
            </button>
          </div>
        </Section>
      ) : null}

      {/*
        Working hours render whenever there are hours. They used to live in a
        hardcoded block in LandingPage that always showed; now that this
        component owns the section, gating it on an owner-supplied title would
        hide the hours from every salon that had not set one.
      */}
      {workingHours.length > 0 ? (
        <Section
          eyebrow={copy.landingLocationEyebrow}
          title={copy.landingLocationTitle || t("landing.workingHours")}
          subtitle={copy.landingLocationDescription || address || undefined}
          theme={theme}
        >
          {/*
            `items-stretch`, not `items-center`: a centred flex column shrinks
            its children to their content width, so every hours row collapsed to
            the width of its own label and the times wrapped under the day.
          */}
          <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-4">
            <span
              className="inline-flex self-center items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold"
              style={{
                borderColor: isOpenNow ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.35)",
                color: isOpenNow ? "#10B981" : "#F43F5E",
              }}
            >
              <Clock3 size={14} aria-hidden="true" />
              {isOpenNow
                ? copy.landingLocationOpenLabel || t("common.open")
                : copy.landingLocationClosedLabel || t("common.closed")}
            </span>

            <dl className="mk-c-card w-full p-0">
              <ul className="mk-hours" style={{ marginTop: 0 }}>
                {workingHours.map((row) => (
                  <li key={row.dayLabel}>
                    <span style={{ color: theme.text }}>{row.dayLabel}</span>
                    {/*
                      `.numeric` isolates the range so RTL does not reverse it,
                      and the rule already sets `white-space: nowrap` on the row
                      so "10:00 – 22:00" cannot break across lines.
                    */}
                    <span
                      className="numeric whitespace-nowrap"
                      style={{ color: row.isOpen ? theme.accent : "#F43F5E" }}
                    >
                      {row.range}
                    </span>
                  </li>
                ))}
              </ul>
            </dl>

            {copy.landingLocationStatusText ? (
              <p className="text-center text-sm font-bold" style={{ color: theme.muted }}>
                {copy.landingLocationStatusText}
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {copy.landingQuickActionsTitle ? (
        <Section
          eyebrow={copy.landingQuickActionsEyebrow}
          title={copy.landingQuickActionsTitle}
          subtitle={copy.landingQuickActionsSubtitle}
          theme={theme}
        >
          <ul className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            <QuickAction
              href={contactLinks.phone ? `tel:${contactLinks.phone}` : undefined}
              icon={Phone}
              label={t("landing.callUs")}
              theme={theme}
            />
            <QuickAction
              href={contactLinks.whatsapp}
              icon={MessageCircle}
              label={t("landing.whatsapp")}
              theme={theme}
              external
            />
            <QuickAction
              href={contactLinks.maps}
              icon={MapPin}
              label={t("landing.viewMap")}
              theme={theme}
              external
            />
          </ul>
        </Section>
      ) : null}

      {testimonials.length > 0 || (reviews && reviews.length > 0) ? (
        <Section
          eyebrow={copy.landingTestimonialsEyebrow}
          title={copy.landingTestimonialsTitle || t("landing.testimonialsTitle")}
          subtitle={copy.landingTestimonialsSubtitle}
          theme={theme}
        >
          <ul className="mk-rev-grid">
            {/* Owner-entered testimonials (marketing copy) */}
            {testimonials.slice(0, 3).map((item, index) => (
              <TestimonialCard key={`${item.name}-${index}`} item={item} />
            ))}
            {/* Verified public reviews from API */}
            {reviews && reviews.length > 0 ? (
              reviews.slice(0, 3).map((review) => (
                <VerifiedReviewCard
                  key={review.id}
                  review={review}
                  t={t}
                  locale={locale}
                />
              ))
            ) : null}
          </ul>
        </Section>
      ) : null}

      {copy.landingFinalTitle ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div
            className="mx-auto w-full max-w-4xl rounded-[3rem] border p-10 text-center sm:p-14"
            style={{ backgroundColor: theme.card, borderColor: theme.border }}
          >
            <Sparkles size={28} className="mx-auto mb-4" aria-hidden="true" style={{ color: theme.accent }} />
            <h2 className="text-2xl font-bold leading-tight text-balance sm:text-4xl" style={{ color: theme.text }}>
              {copy.landingFinalTitle}
            </h2>
            {copy.landingFinalSubtitle ? (
              <p className="mx-auto mt-4 w-full max-w-2xl text-sm font-bold leading-8 sm:text-base" style={{ color: theme.muted }}>
                {copy.landingFinalSubtitle}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onBook}
              className="mt-8 min-h-14 rounded-2xl px-8 text-base font-bold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              style={{ backgroundColor: theme.accent, color: "var(--c-bg)" }}
            >
              {copy.landingFinalButtonLabel || t("landing.bookAppointment")}
            </button>
          </div>
        </section>
      ) : null}

    </>
  );
}

function FeatureCard({ feature, theme }: { feature: LandingFeature; theme: BrandTheme }) {
  return (
    <li>
      <Card theme={theme} className="h-full">
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${theme.accent}22`, color: theme.accent }}
          aria-hidden="true"
        >
          <Sparkles size={20} />
        </div>
        <h3 className="text-lg font-bold leading-7" style={{ color: theme.text }}>
          {feature.title}
        </h3>
        <p className="mt-2 text-sm font-bold leading-7" style={{ color: theme.muted }}>
          {feature.description}
        </p>
      </Card>
    </li>
  );
}

function TestimonialCard({ item }: { item: LandingTestimonial }) {
  return (
    <li>
      <article className="mk-rev h-full">
        <div className="mk-rev__q" aria-hidden="true">
          &ldquo;
        </div>
        <blockquote style={{ marginTop: "0.75rem" }}>{item.quote}</blockquote>
        <footer>
          <span className="mk-rev__av" aria-hidden="true">
            {item.name.charAt(0)}
          </span>
          <div>
            <strong>{item.name}</strong>
            {item.role ? <span className="mk-rev__role">{item.role}</span> : null}
          </div>
        </footer>
      </article>
    </li>
  );
}

/**
 * Verified review from a real customer (is_verified_visit = true).
 *
 * These come from the public `/reviews/public` endpoint and carry
 * `is_verified_visit = true`, meaning they're from a completed appointment.
 * This is the trust signal that owner-entered testimonials cannot provide.
 */
function VerifiedReviewCard({
  review,
  t,
  locale,
}: {
  review: LandingReview;
  t: Translate;
  locale: LocaleCode;
}) {
  /**
   * Formatted through the shared helper rather than `toLocaleDateString("ar-EG")`.
   *
   * The literal meant an English visitor saw every review date in Arabic, and
   * it bypassed `intlLocale`, which is what keeps Latin digits consistent with
   * the rest of the page.
   */
  const formattedDate = formatDate(review.created_at, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <li>
      <article className="mk-rev h-full">
        <div className="mk-rev__q">{formattedDate}</div>
        <blockquote style={{ marginTop: "0.75rem" }}>{review.comment}</blockquote>
        <div className="mk-stars" aria-label={`${review.rating} / 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} aria-hidden="true" style={{ opacity: i < review.rating ? 1 : 0.25 }}>
              ★
            </span>
          ))}
        </div>
        <footer>
          <span className="mk-rev__av" aria-hidden="true">
            {review.customer_name_snapshot.charAt(0)}
          </span>
          <div>
            <strong>{review.customer_name_snapshot}</strong>
            {review.is_verified_visit ? (
              <span className="mk-verified">
                <span aria-hidden="true">✓</span>
                {t("landing.review.verifiedVisit")}
              </span>
            ) : null}
          </div>
        </footer>
      </article>
    </li>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  theme,
  external,
}: {
  href?: string;
  icon: typeof Phone;
  label: string;
  theme: BrandTheme;
  external?: boolean;
}) {
  if (!href) return null;
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition hover:bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ backgroundColor: theme.card, borderColor: theme.border, color: theme.text }}
      >
        <Icon size={18} aria-hidden="true" style={{ color: theme.accent }} />
        {label}
      </a>
    </li>
  );
}
