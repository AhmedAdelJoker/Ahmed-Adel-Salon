/**
 * Hero.tsx — the redesigned above-the-fold.
 *
 * Two columns: the type block, and a booking card the visitor can actually use.
 *
 * Three things this gets right that a background-image hero usually does not:
 *
 * 1. **The photograph is the layout, not wallpaper.** It is a full-bleed layer
 *    behind the grid rather than a `background-image` on the section, so the
 *    composition holds at every width and the image is never scaled to fit a
 *    fixed box.
 *
 * 2. **The type has its own contrast.** The headline and subhead are painted in
 *    explicit light ink rather than the theme's `text` token. On a photograph the
 *    palette's own foreground is correct for a card and wrong for type over an
 *    image, and that is the difference between a readable hero and one that
 *    depends on the photo happening to be dark under the words.
 *
 * 3. **The booking card is a card.** Solid ground, real fields, real availability.
 *    A hero whose right column is two numbers has no call to action in it.
 */

import { useState } from "react";
import { ArrowLeft, MapPin, Phone } from "lucide-react";

import { buildSizes, buildSrcSet } from "../../lib/imageOptimizer";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { formatCountUp, useCountUp } from "../../hooks/useCountUp";
import BookingCard from "./BookingCard";
import type { BrandTheme } from "../../lib/theme";

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export interface HeroProps {
  theme: BrandTheme;
  t: Translate;
  /** Already resolved to an absolute, loadable URL. */
  heroImage: string;
  heroImageAlt: string;
  badge: string;
  headline: string;
  subhead: string;
  ctaLabel: string;
  secondaryCtaLabel: string;
  onBook: () => void;
  onJumpToServices: () => void;
  /** Live counts. Zero values are not rendered. */
  stats: { services: number; barbers: number };
  isOpenNow: boolean;
  openLabel: string;
  location?: string;
  phone?: string;
  /**
   * `landingHeroHighlight*` from the owner settings.
   *
   * These three fields have had labelled inputs in `WebsiteSettingsPanel` the
   * whole time — "عنوان تمييز الهيرو", "وصف تمييز الهيرو", "شارة تمييز الهيرو" —
   * and nothing ever rendered them. `publicSiteContent` passed them into `copy`,
   * which made them *look* wired up: the data arrived and was dropped.
   *
   * All three are optional, so the callout is omitted entirely rather than
   * rendered as an empty shell.
   */
  highlight?: { badge?: string; title?: string; subtitle?: string };
  /**
   * Optional hero clip. When present it sits over the photograph and the poster
   * renders underneath, so a browser that cannot play the file still shows the
   * photograph rather than a black box.
   */
  heroVideo?: { src: string; poster: string; autoplay: boolean; muted: boolean };
  /**
   * Compact catalogue for the inline booking panel.
   *
   * The panel that used to sit here showed two counts and a phone number. It is
   * replaced with an actual three-field picker, because that is the one thing a
   * visitor on the landing page can do without navigating away. Both lists are
   * optional: a salon with an empty catalogue renders the panel in its previous
   * informational form rather than an unusable form with nothing to pick.
   */
  booking?: {
    services: { id: string; name: string; price: number; duration?: string }[];
    barbers: { id: string; name: string }[];
    slots: string[];
    currency: string;
  };
  /**
   * Called when the inline picker is used. Receives the visitor's selections so
   * the page can hand them to the real booking flow (or a WhatsApp deep link)
   * instead of dropping the choice. Falls back to the plain `onBook` when
   * absent, which loses the selection but still takes the visitor to booking.
   */
  onInlineConfirm?: (choice: {
    serviceId: string;
    serviceName: string;
    barberId?: string;
    barberName?: string;
    slot: string;
    price: number;
  }) => void;
  /** Owner's `landingStats` — the 1.2K clients / 4.9★ trust row. */
  trustStats?: { value: string; label: string }[];
  /**
   * The owner's `landingMotionEnabled`. Forwarded to the counter so the hero
   * does not need its own copy of the rule.
   */
  motionEnabled?: boolean;
}

export default function Hero({
  theme,
  t,
  heroImage,
  heroImageAlt,
  badge,
  headline,
  subhead,
  ctaLabel,
  secondaryCtaLabel,
  onBook,
  onJumpToServices,
  stats,
  isOpenNow,
  openLabel,
  location,
  phone,
  highlight,
  heroVideo,
  booking,
  onInlineConfirm,
  trustStats,
  motionEnabled,
}: HeroProps) {
  const reduced = usePrefersReducedMotion();
  const hasStats = stats.services > 0 || stats.barbers > 0;

  /** Only the fields the owner actually filled in; an empty callout is a bug. */
  const highlightBadge = highlight?.badge?.trim();
  const highlightTitle = highlight?.title?.trim();
  const highlightSubtitle = highlight?.subtitle?.trim();
  const hasHighlight = Boolean(highlightTitle || highlightSubtitle || highlightBadge);

  return (
    <section className="mk-hero" id="home">
      {/*
        The photograph. A full-bleed layer with the poster as the real LCP
        element; the clip is painted over it only once it can play, so a slow
        video cannot make the hero measure worse than it does with no video.
      */}
      <div className="mk-hero-bg" aria-hidden="true">
        <img
          src={heroVideo?.poster ?? heroImage}
          srcSet={buildSrcSet(heroVideo?.poster ?? heroImage, [720, 1080, 1440, 1800]) ?? undefined}
          sizes={buildSizes("100vw")}
          alt={heroImageAlt}
          className="h-full w-full object-cover object-center"
          loading="eager"
          decoding="async"
          /*
            LCP hint.

            React 19 added a `fetchPriority` prop; this project is on React 18,
            where the camelCase name is unrecognised — React warns and drops it,
            so the hint never reached the DOM. React 18 forwards unknown
            *lowercase* attributes verbatim, which is the attribute's real name,
            but @types/react 18 has no such key, hence the cast.
          */
          {...{ fetchpriority: "high" }}
        />
        {heroVideo && heroVideo.autoplay ? (
          <video
            className="absolute inset-0 h-full w-full object-cover object-center"
            poster={heroVideo.poster}
            autoPlay
            muted={heroVideo.muted}
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src={heroVideo.src} />
          </video>
        ) : null}
      </div>

      <div className="mk-shell mk-hero-inner">
        <div>
          {/*
            The open/closed pill. `data-open` rather than a class because the
            same rule styles both states and the dot's pulse is gated on it;
            the attribute also keeps the state readable from CSS without a
            second class on the element.
          */}
          <div className="mk-openbar" data-open={isOpenNow ? "true" : "false"}>
            <i className="mk-openbar__dot" aria-hidden="true" />
            {isOpenNow ? t("landing.openNow") : t("landing.closedNow")}
          </div>

          {badge ? (
            <p className="mk-eyebrow mt-5" style={{ letterSpacing: "0.16em" }}>
              {badge}
            </p>
          ) : null}

          <h1
            className="mt-5 text-[length:var(--step-5)] font-black leading-[1.08] text-white"
            style={{ textShadow: "0 2px 30px rgba(0,0,0,0.5)" }}
          >
            {headline}
          </h1>

          <p
            className="mt-4 max-w-[46ch] text-[length:var(--step-1)] leading-[1.8] text-[#C4CEDA]"
          >
            {subhead}
          </p>

          <div className="mt-9 flex flex-wrap gap-3.5">
            <button
              type="button"
              onClick={onBook}
              className="group mk-btn mk-btn-primary mk-btn-lg"
              style={{ backgroundColor: theme.accent, color: theme.onAccent }}
            >
              {ctaLabel}
              <ArrowLeft
                size={17}
                aria-hidden="true"
                className={`transition-transform duration-300 ${reduced ? "" : "group-hover:-translate-x-1 rtl:rotate-180"}`}
              />
            </button>

            <button
              type="button"
              onClick={onJumpToServices}
              className="mk-btn mk-btn-ghost mk-btn-lg"
              style={{ borderColor: theme.borderStrong, color: "#EDF1F7" }}
            >
              {secondaryCtaLabel}
            </button>
          </div>

          {/*
            The trust row. Owner-supplied only (`landingStats`) — the previous
            draft of this design hard-coded "1.2K clients" and "4.9", which is
            exactly the kind of invented number `publicSiteContent` refuses to
            ship anywhere else on the site. Numbers that are not measured must
            not be printed, so the row renders only when the owner supplies it,
            and a salon with no stats simply has no row.
          */}
          {trustStats && trustStats.length > 0 ? (
            <dl className="mk-trust">
              {trustStats.map((item) => (
                <CountUpStat
                  key={`${item.value}-${item.label}`}
                  value={item.value}
                  label={item.label}
                  ownerMotionEnabled={motionEnabled}
                />
              ))}
            </dl>
          ) : null}
        </div>

        {/* Booking panel. `w-full` matters — see the note in index.css about
            auto margins collapsing grid items.

            When the catalogue has real services *and* real slots, the
            information card is replaced by `BookingCard`. Otherwise it stays
            as it was: a picker with nothing to pick is worse than an
            information card, and a salon with no published services should not
            be handed a dead form. */}
        <div className="lg:ps-8">
          {booking && booking.services.length > 0 && booking.slots.length > 0 ? (
            <InlineBookingBridge
              theme={theme}
              t={t}
              booking={booking}
              onConfirm={onInlineConfirm ?? onBook}
              onFullBooking={onBook}
            />
          ) : (
            <div
              className="mk-bookcard"
              style={{ backgroundColor: theme.card, borderColor: theme.borderStrong }}
            >
              <p
                className="text-[length:var(--step--1)] font-semibold uppercase text-[color:var(--c-faint)]"
                style={{ letterSpacing: "0.16em" }}
              >
                {openLabel}
              </p>

              <p className="mt-2 flex items-center gap-2.5 text-[length:var(--step-1)] font-bold">
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: isOpenNow ? theme.ok : theme.stop }}
                />
                <span style={{ color: isOpenNow ? theme.ok : theme.stop }}>
                  {isOpenNow ? t("common.open") : t("common.closed")}
                </span>
              </p>

              {hasHighlight ? (
                <div
                  className="mt-7 rounded-[var(--r-md)] border p-5"
                  style={{ backgroundColor: theme.accentWash, borderColor: theme.border }}
                >
                  {highlightBadge ? (
                    <p
                      className="mb-2.5 text-[length:var(--step--1)] font-semibold uppercase text-[color:var(--c-accent-2)]"
                      style={{ letterSpacing: "0.16em" }}
                    >
                      {highlightBadge}
                    </p>
                  ) : null}
                  {highlightTitle ? (
                    <h2 className="text-[length:var(--step-0)] font-bold leading-snug text-[color:var(--c-text)]">
                      {highlightTitle}
                    </h2>
                  ) : null}
                  {highlightSubtitle ? (
                    <p
                      className="mt-2 text-[length:var(--step--1)] leading-relaxed text-[color:var(--c-muted)]"
                    >
                      {highlightSubtitle}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Live figures only. An empty catalogue renders no rows rather than
                  three cards reading "+0". */}
              {hasStats ? (
                <dl
                  className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-md)]"
                  style={{ backgroundColor: theme.border }}
                >
                  {stats.services > 0 ? (
                    <div className="p-4" style={{ backgroundColor: theme.bg }}>
                      <dt className="text-[length:var(--step--1)] text-[color:var(--c-faint)]">
                        {t("landing.statServices")}
                      </dt>
                      <dd
                        className="numeric mt-1 text-[length:var(--step-2)] font-bold"
                        style={{ color: theme.accent2 }}
                      >
                        {stats.services}
                      </dd>
                    </div>
                  ) : null}
                  {stats.barbers > 0 ? (
                    <div className="p-4" style={{ backgroundColor: theme.bg }}>
                      <dt className="text-[length:var(--step--1)] text-[color:var(--c-faint)]">
                        {t("landing.statBarbers")}
                      </dt>
                      <dd
                        className="numeric mt-1 text-[length:var(--step-2)] font-bold"
                        style={{ color: theme.accent2 }}
                      >
                        {stats.barbers}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p
                  className="mt-7 border-t pt-6 text-[length:var(--step--1)] text-[color:var(--c-faint)]"
                  style={{ borderColor: theme.border }}
                >
                  {t("landing.noServices")}
                </p>
              )}

              {location || phone ? (
                <ul
                  className="mt-7 space-y-2.5 border-t pt-6 text-[length:var(--step--1)] text-[color:var(--c-muted)]"
                  style={{ borderColor: theme.border }}
                >
                  {location ? (
                    <li className="flex items-start gap-2.5">
                      <MapPin size={15} aria-hidden="true" className="mt-1 shrink-0 text-[color:var(--c-accent)]" />
                      <span>{location}</span>
                    </li>
                  ) : null}
                  {phone ? (
                    <li className="flex items-start gap-2.5">
                      <Phone size={15} aria-hidden="true" className="mt-1 shrink-0 text-[color:var(--c-accent)]" />
                      {/* The number is an LTR run inside an RTL line. */}
                      <span className="numeric">{phone}</span>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Holds the selection state for the booking card.
 *
 * A component rather than three `useState` calls in `Hero` because the card
 * reports which field changed, and the step indicator needs that as one value:
 * deriving "step" from the selections themselves would make it jump to 3 the
 * moment a slot was pre-filled for someone arriving from a stylist's page.
 */
function InlineBookingBridge({
  theme,
  t,
  booking,
  onConfirm,
  onFullBooking,
}: {
  theme: BrandTheme;
  t: Translate;
  booking: NonNullable<HeroProps["booking"]>;
  onConfirm: NonNullable<HeroProps["onInlineConfirm"]>;
  onFullBooking: () => void;
}) {
  const [serviceId, setServiceId] = useState(booking.services[0]?.id ?? "");
  const [barberId, setBarberId] = useState(booking.barbers[0]?.id ?? "");
  const [slot, setSlot] = useState(booking.slots[0] ?? "");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const service = booking.services.find((s) => s.id === serviceId) ?? booking.services[0];
  const barber = booking.barbers.find((b) => b.id === barberId);

  return (
    <BookingCard
      theme={theme}
      t={t}
      services={booking.services}
      barbers={booking.barbers}
      slots={booking.slots}
      currency={booking.currency}
      step={step}
      serviceId={serviceId}
      barberId={barberId}
      slot={slot}
      onServiceChange={(id) => {
        setServiceId(id);
        setStep(1);
      }}
      onBarberChange={(id) => {
        setBarberId(id);
        setStep(2);
      }}
      onSlotChange={(s) => {
        setSlot(s);
        setStep(3);
      }}
      onConfirm={() =>
        service &&
        onConfirm({
          serviceId: service.id,
          serviceName: service.name,
          barberId: barber?.id,
          barberName: barber?.name,
          slot,
          price: service.price,
        })
      }
      onFullBooking={onFullBooking}
    />
  );
}

/**
 * One trust figure, counting up to its owner-supplied value.
 *
 * The figure is free text — "1.2K", "1,200+", "8" — so only the numeric run is
 * animated and the surrounding characters ("K", "+") stay put. A value with no
 * digits at all ("since 2018" is fine, "lots" is not) is rendered verbatim,
 * which is why `formatCountUp` returns the template untouched in that case
 * rather than producing `NaN`.
 *
 * The markup is a `<div>` wrapping a `<dt>`/`<dd>` pair rather than the reverse:
 * `<dl>` permits a `<div>` as its child, and putting the terms in the right
 * order is what keeps the term/description relationship that assistive
 * technology reads out.
 */
function CountUpStat({
  value,
  label,
  ownerMotionEnabled,
}: {
  value: string;
  label: string;
  ownerMotionEnabled?: boolean;
}) {
  // Only the first numeric run is counted, so "1,200+ reviews" animates the
  // quantity and leaves the suffix alone.
  const match = value.match(/-?[\d.,]+/);
  const target = match ? Number(match[0].replace(/,/g, "")) : Number.NaN;
  const animatable = Number.isFinite(target) && target > 0;

  const counted = useCountUp(animatable ? target : 0, {
    ownerMotionEnabled: animatable ? ownerMotionEnabled : false,
  });

  return (
    <div>
      <dd className="numeric text-[length:var(--step-3)] font-bold leading-none">
        {animatable ? formatCountUp(counted, value) : value}
      </dd>
      <dt
        className="mt-2 text-[length:var(--step--2)] font-semibold uppercase text-[color:var(--c-muted)]"
        style={{ letterSpacing: "0.16em" }}
      >
        {label}
      </dt>
    </div>
  );
}