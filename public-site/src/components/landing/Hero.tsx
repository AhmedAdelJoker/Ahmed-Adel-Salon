/**
 * Hero.tsx — the editorial above-the-fold.
 *
 * ## The direction
 *
 * A salon's website is a shopfront, not a dashboard. The previous hero was a
 * dark photograph with a booking form floating on it: legible only because the
 * scrim was almost opaque, and structured like a checkout. This one is a
 * magazine spread — the type sits on paper, the photograph is a framed
 * portrait, and the booking controls are a thin strip underneath.
 *
 * ## What carries over
 *
 * - The photograph is still the real LCP element, still `fetchpriority=high`,
 *   still `srcset`-driven, and still falls back to its poster when a hero clip
 *   cannot play.
 * - The open/closed pill is still derived from the salon's own hours, not
 *   typed in.
 * - The trust row is still owner-supplied only. An owner who has not entered
 *   numbers gets no row rather than a made-up one.
 */

import { useState } from "react";
import { ArrowRight, MapPin, Phone } from "lucide-react";

import { buildSizes, buildSrcSet } from "../../lib/imageOptimizer";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { formatCountUp, useCountUp } from "../../hooks/useCountUp";
import ReserveBar from "./ReserveBar";
import type { BrandTheme } from "../../lib/theme";

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export interface HeroProps {
  theme: BrandTheme;
  t: Translate;
  /**
   * Already resolved to an absolute, loadable URL — or `null` when the owner
   * has not uploaded a cover. The panel then becomes a typographic plate
   * instead of borrowing a stock photograph.
   */
  heroImage: string | null;
  heroImageAlt: string;
  salonName?: string;
  badge: string;
  headline: string;
  subhead: string;
  ctaLabel: string;
  secondaryCtaLabel: string;
  onBook: () => void;
  onJumpToServices: () => void;
  isOpenNow: boolean;
  location?: string;
  phone?: string;
  /**
   * `landingHeroHighlight*` from the owner settings.
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
  /** Compact catalogue for the reservation bar. */
  booking?: {
    services: { id: string; name: string; price: number; duration?: string }[];
    barbers: { id: string; name: string }[];
    slots: string[];
    currency: string;
  };
  onInlineConfirm?: (choice: {
    serviceId: string;
    serviceName: string;
    barberId?: string;
    barberName?: string;
    slot: string;
    price: number;
  }) => void;
  /** Owner's `landingStats` — the clients / rating trust row. */
  trustStats?: { value: string; label: string }[];
  /** The owner's `landingMotionEnabled`. */
  motionEnabled?: boolean;
}

export default function Hero({
  theme,
  t,
  heroImage,
  heroImageAlt,
  salonName,
  badge,
  headline,
  subhead,
  ctaLabel,
  secondaryCtaLabel,
  onBook,
  onJumpToServices,
  isOpenNow,
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

  /*
    Sound on the hero video.

    Sound is opt-in from the visitor's side. The clip still autoplays when it is
    muted, which is the only case browsers autoplay unprompted; when the owner
    asked for audio the clip waits for a click on the control below, and the
    visitor can silence it again at any time (WCAG 1.4.2).
  */
  const wantsSound = heroVideo?.muted === false;
  const [soundOn, setSoundOn] = useState(false);

  const highlightBadge = highlight?.badge?.trim();
  const highlightTitle = highlight?.title?.trim();
  const highlightSubtitle = highlight?.subtitle?.trim();
  const hasHighlight = Boolean(highlightTitle || highlightSubtitle || highlightBadge);

  const [serviceId, setServiceId] = useState(booking?.services[0]?.id ?? "");
  const [barberId, setBarberId] = useState(booking?.barbers[0]?.id ?? "");
  const [slot, setSlot] = useState(booking?.slots[0] ?? "");

  const service =
    booking?.services.find((entry) => entry.id === serviceId) ?? booking?.services[0];
  const barber = booking?.barbers.find((entry) => entry.id === barberId);

  const confirmReservation = () => {
    if (!service) {
      onBook();
      return;
    }
    if (onInlineConfirm) {
      onInlineConfirm({
        serviceId: service.id,
        serviceName: service.name,
        barberId: barber?.id,
        barberName: barber?.name,
        slot,
        price: service.price,
      });
      return;
    }
    onBook();
  };

  return (
    <section className="mk-hero" id="home">
      <div className="mk-shell">
        <div className="mk-hero-grid">
          <div className="mk-hero-copy">
            <div className="mk-openbar" data-open={isOpenNow ? "true" : "false"}>
              <i className="mk-openbar__dot" aria-hidden="true" />
              {isOpenNow ? t("landing.openNow") : t("landing.closedNow")}
            </div>

            {badge ? <p className="mk-eyebrow mt-6">{badge}</p> : null}

            <h1 className="mk-hero-title mt-5">{headline}</h1>

            <p className="mk-hero-sub">{subhead}</p>

            <div className="mk-hero-actions">
              <button
                type="button"
                onClick={onBook}
                className="group mk-btn mk-btn-primary mk-btn-lg"
                style={{ backgroundColor: theme.accent, color: theme.onAccent }}
              >
                {ctaLabel}
                {/*
                  The arrow points the way the text reads: rightwards in
                  Latin, leftwards in Arabic. `ArrowLeft` with `rtl:rotate-180`
                  pointed *away* from the reading direction in both — in Latin
                  it faced backwards into the label, and in Arabic it faced
                  the wrong way entirely.
                */}
                <ArrowRight
                  size={17}
                  aria-hidden="true"
                  className={`transition-transform duration-300 ${reduced ? "" : "group-hover:translate-x-1"} rtl:rotate-180`}
                />
              </button>

              <button
                type="button"
                onClick={onJumpToServices}
                className="mk-btn mk-btn-ghost mk-btn-lg"
                style={{ borderColor: theme.borderStrong, color: theme.text }}
              >
                {secondaryCtaLabel}
              </button>
            </div>

            {/*
              Owner-supplied only (`landingStats`). Numbers that are not
              measured must not be printed, so the row renders only when the
              owner supplies it, and a salon with no stats has no row.
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

            {location || phone ? (
              <ul
                className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[length:var(--step--1)] font-semibold"
                style={{ color: theme.muted }}
              >
                {location ? (
                  <li className="flex items-start gap-2">
                    <MapPin
                      size={15}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                      style={{ color: theme.accent }}
                    />
                    <span>{location}</span>
                  </li>
                ) : null}
                {phone ? (
                  <li className="flex items-start gap-2">
                    <Phone
                      size={15}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                      style={{ color: theme.accent }}
                    />
                    <span className="numeric">{phone}</span>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          {/*
            The portrait. A full-bleed layer would put the type back on the
            photograph; a framed figure keeps the image as a composed object, and
            the status strip inside it answers "are you open" at the point where
            the visitor is looking at the room.
          */}
          <div className="relative">
            <span className="mk-hero-frame" aria-hidden="true" />
            <figure
              className="mk-hero-media"
              style={{ backgroundColor: theme.inset }}
            >
              {heroImage || heroVideo?.poster ? (
                <img
                  src={heroVideo?.poster ?? (heroImage as string)}
                  srcSet={
                    buildSrcSet(
                      heroVideo?.poster ?? (heroImage as string),
                      [720, 1080, 1440, 1800],
                    ) ?? undefined
                  }
                  sizes={buildSizes("(max-width: 1000px) 100vw, 46vw")}
                  alt={heroImageAlt}
                  className="h-full w-full object-cover object-center"
                  loading="eager"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />
              ) : (
                <div className="mk-hero-placeholder" aria-hidden="true">
                  {(salonName || "").trim().charAt(0) ? (
                    <span>{(salonName as string).trim().charAt(0)}</span>
                  ) : null}
                  <i />
                </div>
              )}

              {heroVideo && heroVideo.autoplay ? (
                /* eslint-disable-next-line jsx-a11y/media-has-caption -- decorative, aria-hidden, and silent until the visitor opts in */
                <video
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  poster={heroVideo.poster}
                  autoPlay={!wantsSound}
                  muted={!soundOn}
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <source src={heroVideo.src} />
                </video>
              ) : null}

              {wantsSound ? (
                <button
                  type="button"
                  onClick={() => setSoundOn((on) => !on)}
                  aria-pressed={soundOn}
                  className="absolute bottom-4 start-4 z-20 rounded-[var(--r-sm)] border border-white/30 bg-black/55 px-3 py-2 text-[0.7rem] font-bold text-white backdrop-blur-md transition-colors hover:bg-black/75"
                >
                  {soundOn ? "كتم الصوت" : "تشغيل صوت الفيديو"}
                </button>
              ) : null}

              <figcaption className="mk-hero-status">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: isOpenNow ? theme.ok : theme.stop }}
                  />
                  {isOpenNow ? t("landing.openNow") : t("landing.closedNow")}
                </span>
                {hasHighlight && highlightTitle ? (
                  <span
                    className="truncate text-[length:var(--step--2)] font-semibold"
                    style={{ color: theme.muted }}
                  >
                    {highlightTitle}
                  </span>
                ) : (
                  <span
                    className="text-[length:var(--step--2)] font-semibold"
                    style={{ color: theme.faint }}
                  >
                    {t("landing.professionalSalon")}
                  </span>
                )}
              </figcaption>
            </figure>
          </div>
        </div>

        {booking && booking.services.length > 0 && booking.slots.length > 0 ? (
          <ReserveBar
            theme={theme}
            t={t}
            services={booking.services}
            barbers={booking.barbers}
            slots={booking.slots}
            serviceId={serviceId}
            barberId={barberId}
            slot={slot}
            onServiceChange={setServiceId}
            onBarberChange={setBarberId}
            onSlotChange={setSlot}
            onConfirm={confirmReservation}
          />
        ) : (
          <div className="mt-10">
            <button
              type="button"
              onClick={onBook}
              className="mk-btn mk-btn-primary mk-btn-lg"
              style={{ backgroundColor: theme.accent, color: theme.onAccent }}
            >
              {t("nav.bookNow")}
            </button>
          </div>
        )}

        {highlight && (highlightSubtitle || highlightBadge) && highlightTitle ? (
          <div
            className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-s-2 ps-4"
            style={{ borderColor: theme.accent }}
          >
            {highlightBadge ? (
              <span
                className="text-[length:var(--step--2)] font-bold uppercase tracking-[0.16em]"
                style={{ color: theme.accent }}
              >
                {highlightBadge}
              </span>
            ) : null}
            {highlightTitle ? (
              <span className="font-bold" style={{ color: theme.text }}>
                {highlightTitle}
              </span>
            ) : null}
            {highlightSubtitle ? (
              <span
                className="text-[length:var(--step--1)]"
                style={{ color: theme.muted }}
              >
                {highlightSubtitle}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One trust figure, counting up to its owner-supplied value.
 *
 * The figure is free text — "1.2K", "1,200+", "8" — so only the numeric run is
 * animated and the surrounding characters stay put. The markup is a `<div>`
 * wrapping a `<dt>`/`<dd>` pair rather than the reverse: `<dl>` permits a
 * `<div>` as its child, and the term/description order is what assistive
 * technology reads.
 */
export function CountUpStat({
  value,
  label,
  ownerMotionEnabled,
}: {
  value: string;
  label: string;
  ownerMotionEnabled?: boolean;
}) {
  const match = value.match(/-?[\d.,]+/);
  const target = match ? Number(match[0].replace(/,/g, "")) : Number.NaN;
  const animatable = Number.isFinite(target) && target > 0;

  const counted = useCountUp(animatable ? target : 0, {
    ownerMotionEnabled: animatable ? ownerMotionEnabled : false,
  });

  return (
    <div>
      {/*
        `dir="ltr"` because the owner's value is written "3500+" and Arabic
        bidi reorders it to "+3500" — which reads as a negative sign. The
        value is Latin figures, so its own direction is the honest one; the
        label below stays in the page direction.
      */}
      <dd className="numeric" dir="ltr">
        {animatable ? formatCountUp(counted, value) : value}
      </dd>
      <dt>{label}</dt>
    </div>
  );
}
