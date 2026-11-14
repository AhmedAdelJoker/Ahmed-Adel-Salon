import { useMemo, useState } from "react";
import { ShieldCheck, MapPin, Phone, MessageCircle, Clock3 } from "lucide-react";

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
  workingHours: { dayLabel: string; range: string; isOpen: boolean; isToday?: boolean }[];
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

function Eyebrow({ children }: { children: string; theme?: BrandTheme }) {
  return <p className="mk-eyebrow">{children}</p>;
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
    <section id={id} className="mk-shell mk-section">
      {/*
        Same header pattern as the services menu and the contact band: eyebrow
        with a rule, serif title, one lead paragraph, aligned to the reading
        edge. Centred headings were the old template's tell.
      */}
      <header className="mk-svc-head">
        <div>
          {eyebrow ? <Eyebrow theme={theme}>{eyebrow}</Eyebrow> : null}
          <h2
            className="mk-h2"
            style={{ marginTop: eyebrow ? "0.75rem" : undefined }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mk-lead" style={{ marginTop: "1.15rem" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
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
  const { copy, portfolio, features, trustBadges, testimonials } = content;
  const [lightbox, setLightbox] = useState<{ index: number; src: string; alt: string } | null>(null);
  /**
   * Portfolio rows keep their `/uploads/...` path after the file is deleted,
   * so a truthy string is not a loadable image. Drop the failures instead of
   * leaving a blank tile (and an out-of-range lightbox index) in the grid.
   */
  const [brokenPortfolio, setBrokenPortfolio] = useState<Set<string>>(new Set());

  /**
   * Portfolio entries arrive as raw strings that may or may not resolve to a URL.
   * Filtering here — once — keeps the grid from rendering broken images and gives
   * the lightbox a dense array whose indices match the visible thumbnails.
   */
  const galleryImages = useMemo(
    () =>
      portfolio
        .map((entry) => resolveAssetUrl(entry))
        .filter(
          (src): src is string =>
            typeof src === "string" && !brokenPortfolio.has(src),
        )
        .map((src, index) => ({
          src,
          alt: `${copy.landingPortfolioTitle || t("landing.galleryTitle")} — ${index + 1}`,
        })),
    [portfolio, copy.landingPortfolioTitle, t, brokenPortfolio],
  );

  return (
    <>
      {trustBadges.length > 0 ? (
        <section
          aria-label={t("landing.trustBadges")}
          className="mk-shell pt-10"
        >
          <ul className="flex flex-wrap items-center gap-2.5 border-t border-line pt-6">
            {trustBadges.map((badge) => (
              <li
                key={badge.label}
                className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border px-3.5 py-2 text-xs font-bold"
                style={{
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  color: theme.muted,
                }}
              >
                <ShieldCheck size={14} aria-hidden="true" style={{ color: theme.accent }} />
                {badge.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {features.length > 0 ? (
        <Section
          eyebrow={copy.landingFeaturesEyebrow || t("landing.featuresEyebrow")}
          title={t("landing.featuresTitle")}
          theme={theme}
        >
          <ol className="mk-features">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                feature={feature}
                index={index + 1}
              />
            ))}
          </ol>
        </Section>
      ) : null}

      {galleryImages.length > 0 ? (
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
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {galleryImages.map((image, index) => (
              <li key={`${image.src}-${index}`}>
                <button
                  type="button"
                  onClick={() => setLightbox({ index, src: image.src, alt: image.alt })}
                  className="group block w-full overflow-hidden rounded-[var(--r-sm)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  aria-label={t("landing.portfolioOpen", { index: index + 1 })}
                >
                  <span className="block aspect-[4/5] overflow-hidden bg-inset">
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                      onError={() =>
                        setBrokenPortfolio((current) => new Set(current).add(image.src))
                      }
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
              className="mk-btn mk-btn-primary mk-btn-lg"
              style={{ backgroundColor: theme.accent, color: theme.onAccent }}
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
                borderColor: isOpenNow ? theme.okLine : theme.stopLine,
                color: isOpenNow ? theme.ok : theme.stop,
              }}
            >
              {/* The live pulse dot: because "open" is a state, not a badge. */}
              <span className="mk-pulse" aria-hidden="true" />
              <Clock3 size={14} aria-hidden="true" />
              {isOpenNow
                ? copy.landingLocationOpenLabel || t("common.open")
                : copy.landingLocationClosedLabel || t("common.closed")}
            </span>

            <dl className="mk-c-card w-full p-0">
              <ul className="mk-hours" style={{ marginTop: 0 }}>
                {workingHours.map((row) => (
                  <li key={row.dayLabel} className={row.isToday ? "mk-hours-today" : undefined}>
                    <span style={{ color: theme.text }}>
                      {row.dayLabel}
                      {row.isToday ? (
                        <span className="mk-hours-today-tag">{t("common.today")}</span>
                      ) : null}
                    </span>
                    {/*
                      `.numeric` isolates the range so RTL does not reverse it,
                      and the rule already sets `white-space: nowrap` on the row
                      so "10:00 – 22:00" cannot break across lines.
                    */}
                    <span
                      className="numeric whitespace-nowrap"
                      style={{
                        color: row.isOpen
                          ? row.isToday
                            ? theme.accent
                            : theme.text
                          : theme.faint,
                      }}
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
          {/*
            Three ways to reach the salon, as a ruled row rather than three
            cards. A card per action made each one look like a separate
            product; the salon is one business with three doors.
          */}
          <ul className="mk-quick">
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
        <section className="mk-shell pb-[length:var(--section-y)]">
          {/*
            The closing band. It used to be a centred card with a 3rem radius
            and a `Sparkles` icon — the old template's shape, and the one piece
            of the page that still looked like a different design.

            It is now a band of the same paper as everything else: a rule, a
            serif title, the owner's sentence, and the one action. The icon is
            gone because a decorative sparkle in a section whose only job is to
            be useful is noise.
          */}
          <div className="mk-final">
            <div>
              <h2 className="mk-h2">{copy.landingFinalTitle}</h2>
              {copy.landingFinalSubtitle ? (
                <p className="mk-lead" style={{ marginTop: "1.15rem" }}>
                  {copy.landingFinalSubtitle}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onBook}
              className="mk-btn mk-btn-primary mk-btn-lg"
              style={{ backgroundColor: theme.accent, color: theme.onAccent }}
            >
              {copy.landingFinalButtonLabel || t("landing.bookAppointment")}
            </button>
          </div>
        </section>
      ) : null}

    </>
  );
}

function FeatureCard({
  feature,
  index,
}: {
  feature: LandingFeature;
  index: number;
}) {
  return (
    <li className="mk-feature">
      <span className="mk-feature__n" aria-hidden="true">
        {String(index).padStart(2, "0")}
      </span>
      <h3>{feature.title}</h3>
      <p>{feature.description}</p>
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
        <div className="mk-rev__date">{formattedDate}</div>
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
        className="mk-quick__link"
        style={{ color: theme.text }}
      >
        <Icon size={18} aria-hidden="true" style={{ color: theme.accent }} />
        {label}
      </a>
    </li>
  );
}
