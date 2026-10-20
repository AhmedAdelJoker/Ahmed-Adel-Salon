/**
 * AboutSection — the salon in its own words, with the photograph beside it.
 *
 * ## What this section is not allowed to say
 *
 * No invented claims. There is no "trusted by 1200 clients" and no "8 years of
 * experience" unless the owner typed it into `landingStats`; there is no invented
 * star rating. The previous draft of this design hard-coded exactly those, and
 * `publicSiteContent` exists specifically to refuse that pattern — numbers that
 * are not measured must not be printed.
 *
 * The one piece of default copy describes only what the visitor is already
 * looking at: a salon publishing its services, prices and hours. That is a fact
 * about the page, not a claim about quality.
 *
 * ## The floating badge
 *
 * Sits on the photo's inline-start edge, so in RTL it hangs off the right. It is
 * decorative by construction: it renders the owner's `yearsExperience` and
 * nothing else, and it is omitted when there is no number. An empty badge box
 * hanging off a photograph is worse than no badge.
 */

import { Scissors, Clock3, Star } from "lucide-react";

import { useParallax } from "../../hooks/useParallax";

export interface AboutSectionProps {
  t: (key: string, vars?: Record<string, unknown>) => string;
  title?: string;
  content?: string;
  eyebrow?: string;
  /** Owner-uploaded about photograph. */
  image?: string | null;
  imageAlt?: string;
  /** `landingFeatures` from the owner settings. */
  features?: { title: string; description: string }[];
  /** Owner's `landingStats` entry for years of experience, if any. */
  yearsExperience?: string;
  /** Owner's `landingMotionEnabled`; gates the photo parallax. */
  ownerMotionEnabled?: boolean;
}

/**
 * Owner-written "about" block.
 *
 * `landingAboutTitle` and `landingAboutContent` have editable inputs in
 * `WebsiteSettingsPanel` and were never rendered anywhere on the public site.
 *
 * The fallback paragraph is deliberate, and it is the only invented copy on the
 * landing page: it describes what the visitor is already looking at (a salon
 * showing its services, prices and hours) rather than making a claim about
 * quality the salon has not made. The stats and ratings that used to sit here
 * were removed earlier precisely because nothing backs them.
 */
const DEFAULT_BODY =
  "نعرض خدماتنا وأسعارنا وأوقات عملنا بوضوح قبل أن تحجز، حتى تختار بثقة وتعرف المدة والتكلفة مسبقًا.";

export default function AboutSection({
  t,
  title,
  content,
  eyebrow,
  image,
  imageAlt,
  features,
  yearsExperience,
  ownerMotionEnabled,
}: AboutSectionProps) {
  const body = content?.trim() || DEFAULT_BODY;
  const heading = title?.trim();
  const hasImage = Boolean(image);
  const hasBadge = Boolean(yearsExperience?.trim());

  // Parallax on the photograph only, and only when there is one. Without a
  // photograph the hook would still mount and observe an empty box.
  const { layerRef } = useParallax<HTMLDivElement>({
    strength: 0.08,
    ownerMotionEnabled: hasImage ? ownerMotionEnabled : false,
  });

  // A salon that has neither a heading nor a photograph has nothing to show;
  // the body alone would be a paragraph floating in the middle of the page.
  if (!heading && !hasImage) return null;

  return (
    <section id="about" className="mk-about">
      <div className="mk-shell mk-about-grid">
        {/*
          Photo column. The heading moves below the image on narrow screens
          rather than staying beside it, because a two-column grid at 380px puts
          the heading in a 190px measure and it wraps to four lines.
        */}
        {hasImage ? (
          <div className="mk-about-photo reveal">
            <div ref={layerRef} className="parallax__layer h-full w-full scale-[1.1]">
              <img
                src={image as string}
                alt={imageAlt || ""}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>

            {hasBadge ? (
              <div className="mk-badge-float">
                <strong>{yearsExperience}</strong>
                <span>{t("landing.yearsExperience")}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={hasImage ? "" : "lg:col-span-2"}>
          {eyebrow ? <p className="mk-eyebrow mb-3">{eyebrow}</p> : null}
          {heading ? (
            <h2
              className="text-[length:var(--step-4)] font-black leading-[1.15] text-[color:var(--c-text)]"
              style={{ letterSpacing: "-0.02em" }}
            >
              {heading}
            </h2>
          ) : null}

          {/* `whitespace-pre-line` so a salon that typed three paragraphs gets
              three paragraphs. The field is a textarea in the admin panel, so
              newlines are expected input — collapsing them silently discarded
              the owner's formatting. */}
          <p
            className="mk-lead mt-6 whitespace-pre-line"
            style={{ letterSpacing: "var(--tracking-body)" }}
          >
            {body}
          </p>

          {/*
            The owner's own feature list. Icons cycle through three glyphs by
            index rather than being stored per feature: the settings panel has a
            title and a description and no icon field, and inventing one here
            would mean a feature's icon depends on its position in the array.
          */}
          {features && features.length > 0 ? (
            <ul className="mt-8 grid gap-4">
              {features.slice(0, 4).map((feature, index) => (
                <li key={`${feature.title}-${index}`} className="mk-feat">
                  <span className="mk-feat__icon" aria-hidden="true">
                    {[<Scissors key="s" />, <Clock3 key="c" />, <Star key="r" />][index % 3]}
                  </span>
                  <div>
                    <h3 className="text-[length:var(--step-0)] font-bold text-[color:var(--c-text)]">
                      {feature.title}
                    </h3>
                    <p
                      className="mt-1 text-[length:var(--step--1)] leading-[1.7] text-[color:var(--c-muted)]"
                      style={{ letterSpacing: "var(--tracking-body)" }}
                    >
                      {feature.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}