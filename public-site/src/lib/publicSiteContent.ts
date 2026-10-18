/**
 * publicSiteContent.ts — normalises the owner's website settings for the
 * landing page.
 *
 * Design rule: **nothing here invents content.**
 *
 * This file used to ship three fake customer testimonials with invented names
 * ("أحمد كمال", "محمد السيد"), a "15k+ happy customers" stat, a "4.9/5 rating"
 * stat and a set of marketing claims, used as fallbacks for any salon that had
 * not filled the fields in. Those strings reached the page, and the aggregate
 * rating also reached the JSON-LD, so a salon with no reviews was publishing a
 * fabricated review score.
 *
 * Every list is therefore empty until the owner supplies it, and a section with
 * no content is not rendered at all. An empty salon page is honest; an empty
 * salon page wearing made-up numbers is not.
 */

import { resolveAssetUrl } from "./imageOptimizer";
import { listSetting } from "./listSetting";

export interface LandingStat {
  value: string;
  label: string;
}


export interface LandingFeature {
  title: string;
  description: string;
}

export interface LandingTrustBadge {
  label: string;
}

export interface LandingTestimonial {
  name: string;
  role: string;
  quote: string;
}

export interface LandingContent {
  /** Owner-uploaded gallery images, resolved to absolute URLs. */
  portfolio: string[];
  stats: LandingStat[];
  features: LandingFeature[];
  trustBadges: LandingTrustBadge[];
  testimonials: LandingTestimonial[];
  copy: Record<string, string>;
  /**
   * Hero video. Optional at every level: a salon that never uploaded a clip
   * must render the exact page it rendered before, with the image only.
   *
   * `poster` is resolved separately from `src` because it is not decoration —
   * it is the permanent fallback whenever the clip cannot play (unsupported
   * codec, autoplay blocked, reduced motion, or a visitor on a metered
   * connection). A hero that waits on a video to show its background shows a
   * blank box to exactly the people with the slowest connections.
   */
  heroVideo?: {
    src: string;
    poster: string;
    autoplay: boolean;
    muted: boolean;
  };
  /**
   * Owner-controlled master switch for scroll-reveal and hover motion.
   *
   * Distinct from `prefers-reduced-motion`: that is the visitor's OS-level
   * request and is always honoured regardless of this flag, while this is the
   * owner's editorial choice. The two are ANDed — motion is off if either says
   * so.
   */
  motionEnabled: boolean;
}

const DEFAULT_COPY: Record<string, string> = {
  landingHeroBadge: "",
  landingHeroTitle: "",
  landingHeroSubtitle: "",

  landingServicesEyebrow: "",
  landingServicesTitle: "",
  landingServicesSubtitle: "",

  landingPortfolioEyebrow: "",
  landingPortfolioTitle: "",

  landingBookingEyebrow: "",
  landingBookingTitle: "",
  landingBookingSubtitle: "",

  landingLocationEyebrow: "",
  landingLocationTitle: "",
  landingLocationDescription: "",
  landingLocationOpenLabel: "",
  landingLocationClosedLabel: "",
  landingLocationStatusText: "",

  landingContactEyebrow: "",
  landingContactTitle: "",
  landingContactSubtitle: "",

  landingQuickActionsEyebrow: "",
  landingQuickActionsTitle: "",
  landingQuickActionsSubtitle: "",

  landingFinalTitle: "",
  landingFinalSubtitle: "",
  landingFinalButtonLabel: "",

  landingHeroHighlightTitle: "",
  landingHeroHighlightSubtitle: "",
  landingHeroHighlightBadge: "",

  landingPublicHeaderBadge: "",

  landingAboutTitle: "",
  landingAboutContent: "",
  landingAboutEyebrow: "",
  /**
   * Owner's about photograph, and the alt text for it.
   *
   * `landingAboutImageAlt` is separate rather than derived from the title: the
   * title says what the section is called, the alt says what is in the picture.
   * A decorative photograph takes `alt=""` and a meaningful one needs a sentence
   * the owner writes, and neither is the section heading.
   */
  landingAboutImageUrl: "",
  landingAboutImageAlt: "",
  /**
   * Years in business, shown on the floating badge over the photograph.
   *
   * A free-text field rather than a number: the owner may write "since 1998" or
   * "أكثر من 12 سنة". The component renders it verbatim and omits the badge
   * entirely when it is empty, so an unset badge is not a visible "0".
   */
  landingAboutYearsExperience: "",

  landingTestimonialsEyebrow: "",
  landingTestimonialsTitle: "",
  landingTestimonialsSubtitle: "",
};

/** Keys that are booleans or otherwise non-string in the settings payload. */
const NON_COPY_KEYS = new Set(["landingShowStaff", "landingShowStaffBio", "landingThemeId"]);

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/**
 * Map the owner's lists onto the shape the page renders, dropping empty rows.
 *
 * Rows with no text are dropped rather than rendered blank, because a grid of
 * empty cards looks like a bug rather than an absence.
 */
function mapList<T>(
  value: unknown,
  fields: readonly (keyof T)[],
  mapper: (row: Record<string, unknown>, index: number) => T,
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row, index) => mapper((row ?? {}) as Record<string, unknown>, index))
    .filter((item) => fields.every((field) => asText(item[field])));
}

/**
 * Read a list-valued setting under either spelling.
 *
 * The admin panel writes these in camelCase (`landingStats`) and
 * `booking-catalog` forwards them snake_cased (`landing_stats`), matching every
 * other key it sends. Reading only the camelCase form is why an owner who filled
 * in their stats, features, trust badges, testimonials and gallery saw none of
 * them: the value arrived and was dropped on the floor, one `??` away from
 * working.
 *
 * `asText` on an array would return `""`, so the check has to be `Array.isArray`
 * rather than truthiness — a populated list is truthy, an empty one is too.
 */
export function buildLandingSiteContent(settings: Record<string, unknown> = {}): LandingContent {
  const stats = mapList<LandingStat>(
    listSetting(settings, "landingStats"),
    ["value", "label"] as const,
    (row) => ({ value: asText(row.value), label: asText(row.label) }),
  );

  const features = mapList<LandingFeature>(
    listSetting(settings, "landingFeatures"),
    ["title", "description"] as const,
    (row) => ({
      title: asText(row.title),
      description: asText(row.description) || asText(row.desc),
    }),
  );

  const trustBadges = mapList<LandingTrustBadge>(
    listSetting(settings, "landingTrustBadges"),
    ["label"] as const,
    (row) => ({ label: asText(row.label) || asText(row.text) || asText(row.title) }),
  );

  /**
   * The admin's testimonial rows use `author`, the API has historically used
   * `name`, and `publicSitePreview` drafts use `name_ar`/`quote_ar`. All three
   * are accepted so an owner is not locked out by a field rename.
   */
  const testimonials = mapList<LandingTestimonial>(
    listSetting(settings, "landingTestimonials"),
    ["name", "quote"] as const,
    (row) => ({
      name: asText(row.name) || asText(row.name_ar) || asText(row.author),
      role: asText(row.role) || asText(row.role_ar),
      quote: asText(row.quote) || asText(row.quote_ar) || asText(row.text),
    }),
  );

  const copy: Record<string, string> = {};
  for (const key of Object.keys(DEFAULT_COPY)) {
    copy[key] = asText(settings[key]) || DEFAULT_COPY[key];
  }
  // Any copy key the owner adds later still passes through, so the page does not
  // need a code change to pick up a new field.
  for (const [key, value] of Object.entries(settings)) {
    if (key.startsWith("landing") && !NON_COPY_KEYS.has(key) && !copy[key]) {
      const text = asText(value);
      if (text) copy[key] = text;
    }
  }

  /**
   * Portfolio images. `landingPortfolio` is a list of paths or URLs; entries
   * that are neither a string nor resolvable are dropped rather than rendered
   * as a broken image.
   */
  const portfolio = Array.isArray(listSetting(settings, "landingPortfolio"))
    ? (listSetting(settings, "landingPortfolio") as unknown[])
        .map((entry) => asText(entry))
        .filter(Boolean)
        .map((entry) => resolveAssetUrl(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  /**
   * The hero clip is only offered when there is something to play *and* a
   * poster to fall back to. A video with no poster would leave the hero blank
   * on every browser that refuses to autoplay, which is the common case, not
   * the edge case — so a posterless clip is treated as "no video configured"
   * rather than shipping a hero that can render blank.
   *
   * Both casings are accepted, matching how `LandingPage` reads the cover
   * image: the public catalog endpoint emits snake_case while preview drafts
   * and the admin API use camelCase, so reading only one silently drops the
   * clip depending on which source the page was populated from.
   */
  const pick = (camel: string, snake: string): string =>
    asText(settings[camel]) || asText(settings[snake]);

  const videoSrc = resolveAssetUrl(
    pick("landingHeroVideoUrl", "landing_hero_video_url"),
  );
  const videoPoster = resolveAssetUrl(
    pick("landingVideoPosterUrl", "landing_video_poster_url"),
  );
  const flag = (camel: string, snake: string): boolean =>
    settings[camel] === false || settings[snake] === false ? false : true;

  const heroVideo =
    videoSrc && videoPoster
      ? {
          src: videoSrc,
          poster: videoPoster,
          // Default to on when the column is absent entirely, which is the case
          // for every snapshot published before this feature existed. An
          // explicit `false` from the owner is respected.
          autoplay: flag("landingVideoAutoplay", "landing_video_autoplay"),
          muted: flag("landingVideoMuted", "landing_video_muted"),
        }
      : undefined;

  // Same reasoning for motion: absent means "on" (preserves today's behaviour
  // for existing snapshots), explicit false means the owner turned it off.
  const motionEnabled = flag("landingMotionEnabled", "landing_motion_enabled");

  return { portfolio, stats, features, trustBadges, testimonials, copy, heroVideo, motionEnabled };
}
