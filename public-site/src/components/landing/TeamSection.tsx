import { useEffect, useState } from "react";
import { CalendarCheck2, Clock3 } from "lucide-react";

import type { BrandTheme } from "../../lib/theme";
import { resolveAssetUrl } from "../../lib/imageOptimizer";
import { useParallax } from "../../hooks/useParallax";
import type { Translate } from "./OwnerSections";

export interface TeamMember {
  id?: string | number;
  name: string;
  role?: string;
  bio?: string;
  image?: string | null;
  /**
   * Next bookable slot, if the API supplied one.
   *
   * Rendered only when present. A stylist card that reads "next available:
   * soon" or shows a slot the booking service has already given away is worse
   * than a card without the line, so an absent value renders no row at all.
   */
  nextSlot?: string;
}

export interface TeamSectionProps {
  theme: BrandTheme;
  members: TeamMember[];
  title: string;
  subtitle?: string;
  /** Owner's `landingShowStaffBio` — when false, cards drop to name and role. */
  showBios: boolean;
  /** Salon public slug; when set, each card links to `/salon/:slug/barber/:id`. */
  salonSlug?: string;
  t: Translate;
  /** Books this stylist. Omit on a directory-only page. */
  onBook?: (member: TeamMember) => void;
  /** Owner's `landingMotionEnabled`; gates the photo parallax. */
  ownerMotionEnabled?: boolean;
}

/**
 * Team section.
 *
 * The header linked to `#team` on every salon, but the redesigned landing page
 * rendered no team section at all, so that link scrolled nowhere. It is back,
 * and it is gated on the owner's `landingShowStaff` flag so a salon that hides
 * its team in settings does not get one here either.
 *
 * Cards link to the barber's own detail page when a slug is available. A barber
 * page is not decoration: `display_name`, `job_title`, `bio_ar` and the photo are
 * enough for a `Person` schema, and a stylist's name is exactly the sort of
 * thing people search for by name.
 */
export default function TeamSection({
  theme,
  members,
  title,
  subtitle,
  showBios,
  salonSlug,
  t,
  onBook,
  ownerMotionEnabled,
}: TeamSectionProps) {
  if (!members.length) return null;

  return (
    <section id="team" className="mk-shell mk-section">
      <header className="mk-svc-head">
        <div>
          <p className="mk-eyebrow">{t("nav.team")}</p>
          <h2 className="mk-h2" style={{ marginTop: "0.75rem" }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mk-lead" style={{ marginTop: "1.15rem" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>

      <ul className="mk-team-grid">
        {members.map((member, index) => (
          <TeamCard
            key={member.id ?? member.name}
            /* Staggered by index so a row of cards settles left-to-right rather
               than all at once; capped so the last card never waits. */
            className={index < 4 ? "reveal" : undefined}
            style={index < 4 ? { transitionDelay: `${index * 90}ms` } : undefined}
            member={member}
            theme={theme}
            showBios={showBios}
            salonSlug={salonSlug}
            t={t}
            onBook={onBook}
            ownerMotionEnabled={ownerMotionEnabled}
          />
        ))}
      </ul>
    </section>
  );
}

function TeamCard({
  member,
  theme,
  showBios,
  salonSlug,
  t,
  onBook,
  className,
  style,
  ownerMotionEnabled,
}: {
  member: TeamMember;
  theme: BrandTheme;
  showBios: boolean;
  salonSlug?: string;
  t: Translate;
  onBook?: (member: TeamMember) => void;
  className?: string;
  style?: React.CSSProperties;
  /** Forwarded to the parallax layer; see `useParallax`. */
  ownerMotionEnabled?: boolean;
}) {
  const image = resolveAssetUrl(member.image);
  const href = salonSlug ? `/salon/${salonSlug}/barber/${member.id}` : undefined;

  /**
   * Job titles are stored as stable ids (`barber`, `colorist`, …), not as copy.
   * Printing the id put the word "barber" in English on an otherwise Arabic
   * card. Translation keys exist for every bookable title; an unknown title
   * falls back to the raw value rather than to a `team.role.*` key.
   */
  const roleId = member.role?.trim() || "";
  const roleKey = roleId ? `team.role.${roleId}` : "";
  const translatedRole = roleKey ? t(roleKey) : "";
  const roleLabel =
    translatedRole && translatedRole !== roleKey ? translatedRole : roleId;

  const initial = member.name.trim().charAt(0).toUpperCase();

  /**
   * A stored photo path that no longer resolves is not the same as having no
   * photo: the row keeps `/uploads/profiles/<uuid>.jpg` after the file is gone,
   * so `image` is a truthy URL that answers 404 and the browser shows a broken
   * image. Fall back to the initials glyph instead, the way a barber with no
   * photo is handled.
   */
  const [photoBroken, setPhotoBroken] = useState(false);
  useEffect(() => setPhotoBroken(false), [image]);
  const showPhoto = Boolean(image) && !photoBroken;

  const { layerRef } = useParallax<HTMLDivElement>({
    strength: 0.06,
    ownerMotionEnabled,
  });

  return (
    <li className={className} style={style}>
      <article
        className="group mk-member transition duration-500"
        style={{ backgroundColor: theme.card, borderColor: theme.border }}
      >
        {/*
          The parallax layer is its own wrapper rather than the <img>. The image
          already carries `group-hover:scale`, which is a transform on that same
          node, and the two effects would overwrite each other -- a hover would
          cancel the drift and the drift would cancel the hover.

          `scale-[1.12]` over-covers the box by 12%: the layer travels, and an
          image that exactly fills its container would expose an unpainted edge
          at the top of its travel.
        */}
        <div className="parallax relative aspect-[4/5] overflow-hidden">
          <div ref={layerRef} className="parallax__layer h-full w-full scale-[1.12]">
            {showPhoto ? (
              <img
                src={image as string}
                alt={member.name}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                style={{ objectPosition: "center 25%" }}
                loading="lazy"
                decoding="async"
                onError={() => setPhotoBroken(true)}
              />
            ) : (
              /*
                No photo is a normal state for a new salon, and an empty black
                box reads as a broken upload. The initial in the display face is
                a deliberate placeholder rather than a missing one.
              */
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ backgroundColor: `${theme.accent}14`, color: theme.accent }}
                aria-hidden="true"
              >
                <span
                  style={{
                    fontFamily: "var(--font-editorial)",
                    fontSize: "4.5rem",
                    lineHeight: 1,
                  }}
                >
                  {initial}
                </span>
              </div>
            )}
          </div>

          {/*
            Fade the photo into the card at its bottom edge. Portraits shot in
            the salon's dark style used to end on a hard line, which read as a
            broken image rather than a photograph; the wash makes the crop
            deliberate and the info band below feels continuous with it.

            The wash is confined to the bottom fifth for that reason. It used to
            start at 55%, which faded out the lower half of a 4:5 portrait —
            chin, shoulders and all — and on a two-person team the section then
            read as two fogged photographs rather than two people.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to bottom, transparent 80%, ${theme.card} 100%)`,
            }}
          />
        </div>

        <div className="mk-member-info">
          {href ? (
            <h3 className="mk-member-name">
              <a
                href={href}
                className="transition hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ color: theme.text }}
              >
                {member.name}
              </a>
            </h3>
          ) : (
            <h3 className="mk-member-name" style={{ color: theme.text }}>
              {member.name}
            </h3>
          )}
          {roleLabel ? (
            <p className="mk-member-role" style={{ color: theme.accent }}>
              <span
                aria-hidden="true"
                className="inline-block h-px w-4"
                style={{ backgroundColor: "currentColor" }}
              />
              {roleLabel}
            </p>
          ) : null}
          {showBios && member.bio ? (
            <p className="mk-member-bio" style={{ color: theme.muted }}>
              {member.bio}
            </p>
          ) : null}

          {/*
            The card's call to action.

            A stylist card that only links to a profile page leaves the visitor
            one click from a decision and no closer. This books *that stylist* —
            which is the thing a visitor standing in front of this grid actually
            wants, and the reason to choose one card over another.

            `onBook` is optional: a page that renders the team as a directory
            (no booking context) still gets a card, just without the button,
            rather than a button that navigates nowhere.
          */}
          {onBook ? (
            <button
              type="button"
              onClick={() => onBook(member)}
              className="mk-btn mk-btn-ghost mk-btn-sm mt-5 w-full"
              style={{ borderColor: theme.borderStrong, color: theme.text }}
            >
              <CalendarCheck2 size={15} aria-hidden="true" />
              {t("landing.bookWith", { name: member.name })}
            </button>
          ) : null}

          {member.nextSlot ? (
            <p className="mk-availability" style={{ color: theme.ok }}>
              <Clock3 size={13} aria-hidden="true" />
              {t("landing.nextSlot", { slot: member.nextSlot })}
            </p>
          ) : null}
        </div>
      </article>
    </li>
  );
}