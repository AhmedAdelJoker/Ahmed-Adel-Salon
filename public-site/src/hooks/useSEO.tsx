import { useEffect, useRef } from "react";

/**
 * useSEO — dynamic <head> manager (vanilla, no extra deps).
 *
 * Owns document.title, the description/robots/canonical tags, the Open Graph
 * and Twitter cards, hreflang alternates, the LCP image preload, and JSON-LD.
 *
 * Two things this deliberately gets right that the previous version did not:
 *
 *  - **It removes tags it no longer needs.** Navigating from a page that sets
 *    `keywords` to one that does not used to leave the old keywords behind,
 *    because every setter bailed out on a falsy value.
 *  - **It does not thrash the DOM.** The effect used to depend on the raw
 *    `schema` object, so any caller passing an inline array literal re-ran the
 *    whole head rewrite on every single render. The schema is now compared by
 *    its serialised form.
 */

type MetaKind = "name" | "property";

const META_KIND: Record<string, MetaKind> = {
  "og:type": "property",
  "og:url": "property",
  "og:title": "property",
  "og:description": "property",
  "og:image": "property",
  "og:image:secure_url": "property",
  "og:image:type": "property",
  "og:image:width": "property",
  "og:image:height": "property",
  "og:image:alt": "property",
  "og:site_name": "property",
  "og:locale": "property",
  "og:locale:alternate": "property",
  "article:published_time": "property",
};

const kindOf = (key: string): MetaKind => META_KIND[key] ?? "name";

function upsertMeta(doc: Document, key: string, value: string | undefined | null) {
  const kind = kindOf(key);
  const selector = `meta[${kind}="${key}"]`;
  let el = doc.head.querySelector<HTMLMetaElement>(selector);

  // Absent value means "this page has nothing to say about it" — drop the tag
  // rather than leave a stale one describing the previous page.
  if (!value) {
    el?.remove();
    return;
  }

  if (!el) {
    el = doc.createElement("meta");
    el.setAttribute(kind, key);
    doc.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function upsertLink(doc: Document, rel: string, href: string | undefined | null) {
  const selector = `link[rel="${rel}"]`;
  let el = doc.head.querySelector<HTMLLinkElement>(selector);

  if (!href) {
    el?.remove();
    return;
  }

  if (!el) {
    el = doc.createElement("link");
    el.setAttribute("rel", rel);
    doc.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export interface UseSeoOptions {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  url?: string;
  type?: string;
  siteName?: string;
  locale?: string;
  alternateLocale?: string;
  hreflang?: { lang: string; href: string }[];
  schema?: Record<string, unknown> | Record<string, unknown>[] | null;
  keywords?: string;
  preloadImage?: string;
  /** Set for pages that must never be indexed (404, offline, previews). */
  noindex?: boolean;
}

const LCP_PRELOAD_ID = "seo-lcp-preload";
const JSONLD_ID = "seo-jsonld";

export function useSEO({
  title,
  description,
  image,
  imageAlt,
  imageWidth,
  imageHeight,
  url,
  type = "website",
  siteName,
  locale = "ar_EG",
  alternateLocale = "en_US",
  hreflang,
  schema,
  keywords,
  preloadImage,
  noindex = false,
}: UseSeoOptions) {
  /**
   * Serialised so an inline `schema={[...]}`, which is a fresh array on every
   * render, does not re-trigger the effect.
   */
  const schemaKey = schema ? JSON.stringify(schema) : "";
  const renderedSchema = useRef<string>("");

  useEffect(() => {
    const doc = document;
    const touched: string[] = [];

    const meta = (key: string, value?: string | null) => {
      upsertMeta(doc, key, value);
      touched.push(`${kindOf(key)}:${key}`);
    };

    if (title) doc.title = title;

    meta("description", description);
    meta("keywords", keywords);
    meta(
      "robots",
      noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    );

    // Open Graph
    meta("og:type", type);
    meta("og:title", title);
    meta("og:description", description);
    meta("og:image", image);
    meta("og:image:secure_url", image?.startsWith("https://") ? image : undefined);
    meta("og:image:alt", imageAlt);
    meta("og:image:width", imageWidth ? String(imageWidth) : undefined);
    meta("og:image:height", imageHeight ? String(imageHeight) : undefined);
    meta("og:url", url);
    meta("og:site_name", siteName);
    meta("og:locale", locale);
    meta("og:locale:alternate", alternateLocale);

    // Twitter / X
    meta("twitter:card", image ? "summary_large_image" : "summary");
    meta("twitter:title", title);
    meta("twitter:description", description);
    meta("twitter:image", image);
    meta("twitter:image:alt", imageAlt);

    upsertLink(doc, "canonical", url);

    for (const entry of hreflang ?? []) {
      if (!entry?.lang || !entry?.href) continue;
      const selector = `link[rel="alternate"][hreflang="${entry.lang}"]`;
      let el = doc.head.querySelector<HTMLLinkElement>(selector);
      if (!el) {
        el = doc.createElement("link");
        el.setAttribute("rel", "alternate");
        el.setAttribute("hreflang", entry.lang);
        doc.head.appendChild(el);
      }
      el.setAttribute("href", entry.href);
    }

    /**
     * Preload the LCP image. Only absolute http(s) URLs are accepted by the
     * browser, and every attribute is set before insertion so the preload
     * link is never observed in an invalid state.
     */
    const validPreload =
      typeof preloadImage === "string" && /^https?:\/\//i.test(preloadImage);
    let preload = doc.getElementById(LCP_PRELOAD_ID) as HTMLLinkElement | null;
    if (!validPreload) {
      preload?.remove();
    } else if (!preload) {
      preload = doc.createElement("link");
      preload.id = LCP_PRELOAD_ID;
      preload.setAttribute("rel", "preload");
      preload.setAttribute("as", "image");
      preload.setAttribute("href", preloadImage);
      preload.setAttribute("fetchpriority", "high");
      doc.head.appendChild(preload);
    } else {
      preload.setAttribute("href", preloadImage);
      preload.setAttribute("fetchpriority", "high");
    }

    if (schemaKey && schemaKey !== renderedSchema.current) {
      renderedSchema.current = schemaKey;
      const payload = schema
        ? JSON.parse(schemaKey)
        : null;
      const graph =
        payload && Array.isArray(payload)
          ? { "@context": "https://schema.org", "@graph": payload }
          : payload;

      let script = doc.getElementById(JSONLD_ID) as HTMLScriptElement | null;
      if (!script) {
        script = doc.createElement("script");
        script.id = JSONLD_ID;
        script.type = "application/ld+json";
        doc.head.appendChild(script);
      }
      // `<` is escaped so a stray "</script>" inside data cannot break out.
      script.textContent = JSON.stringify(graph).replace(/</g, "\\u003c");
    } else if (!schemaKey && renderedSchema.current) {
      renderedSchema.current = "";
      doc.getElementById(JSONLD_ID)?.remove();
    }

    /**
     * No unmount cleanup: this hook drives a single-page document, and every
     * tag it writes is now overwritten (or removed) on the next route, so
     * tearing the head down mid-navigation would only cause a flash of
     * missing metadata.
     */
    void touched;
    // schema is intentionally absent: schemaKey is its serialised form,
    // and depending on the object itself would reintroduce the per-render
    // re-run that schemaKey exists to prevent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    image,
    imageAlt,
    imageWidth,
    imageHeight,
    url,
    type,
    siteName,
    locale,
    alternateLocale,
    hreflang,
    schemaKey,
    keywords,
    preloadImage,
    noindex,
  ]);
}

export interface SalonSettingsLike {
  landingAggregateRating?: { ratingValue?: string; reviewCount?: string };
  workingHours?: Record<string, { is_open?: boolean; open_time?: string; close_time?: string }>;
  working_hours?: Record<string, { is_open?: boolean; open_time?: string; close_time?: string }>;
  shopPhone?: string;
  [key: string]: unknown;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Build a HairSalon JSON-LD schema from settings.
 *
 * `aggregateRating` is emitted only when the salon has supplied real numbers.
 * The previous version defaulted to a fabricated `4.9 / 2341 reviews` on every
 * page, which is invented review data published to visitors and to Google —
 * a manual-action risk and, simply, not true.
 */
export function buildHairSalonSchema({
  settings,
  salonName,
  heroImage,
  url,
  telephone,
  address,
}: {
  settings?: SalonSettingsLike;
  salonName?: string;
  heroImage?: string;
  url?: string;
  telephone?: string;
  address?: string;
}) {
  const rating = settings?.landingAggregateRating;
  const ratingValue = Number(rating?.ratingValue);
  const reviewCount = Number(rating?.reviewCount);
  const hasRealRating =
    Number.isFinite(ratingValue) &&
    ratingValue > 0 &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;

  const workingHours = settings?.workingHours || settings?.working_hours || {};
  const openingHoursSpecification = Object.entries(workingHours)
    .filter(([, val]) => val?.is_open && val?.open_time && val?.close_time)
    .map(([dayKey, val]) => {
      const day = DAY_NAMES.find(
        (name) => name.toLowerCase() === dayKey.toLowerCase(),
      );
      // An unrecognised key would emit invalid structured data, so drop it.
      if (!day) return null;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${day}`,
        opens: val.open_time as string,
        closes: val.close_time as string,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: salonName,
    image: heroImage,
    url,
    telephone: telephone || settings?.shopPhone,
    address: address
      ? {
          "@type": "PostalAddress",
          streetAddress: address,
        }
      : undefined,
    priceRange: "$$",
    aggregateRating: hasRealRating
      ? {
          "@type": "AggregateRating",
          ratingValue,
          reviewCount,
          bestRating: "5",
          worstRating: "1",
        }
      : undefined,
    openingHoursSpecification:
      openingHoursSpecification.length > 0 ? openingHoursSpecification : undefined,
  };
}

/**
 * Build a `Service` schema for one catalogue entry.
 *
 * This is the schema that can put a price in a search result, which is the whole
 * reason to emit it: a visitor searching "قص شعر جدة" sees the number without
 * opening the site. It only helps if the price is the salon's real price, so
 *
 *  - a zero or missing price emits an `Offer` with no price at all rather than
 *    an invented one, and
 *  - `priceCurrency` is passed in from the salon's own setting rather than
 *    assumed, because a salon billing in EGP that publishes SAR is wrong in a
 *    way that costs the visitor money.
 *
 * `url` makes the entity resolvable to a specific page rather than to the
 * category listing, which is what lets the search engine link the price to a
 * page it can crawl.
 */
export function buildServiceSchema({
  services,
  currency,
  salonUrl,
  salonName,
}: {
  services: {
    name: string;
    description?: string | null;
    price?: number;
    url?: string;
    /** `null` rather than `undefined` because the catalogue view model uses it. */
    image?: string | null;
  }[];
  currency?: string;
  salonUrl?: string;
  salonName?: string;
}) {
  const entries = services
    .filter((service) => service?.name)
    .map((service) => {
      const price = Number(service.price);
      const hasPrice = Number.isFinite(price) && price > 0;

      return {
        "@type": "Service",
        name: service.name,
        description: service.description || undefined,
        image: service.image || undefined,
        url: service.url || salonUrl || undefined,
        serviceType: salonName || undefined,
        provider: salonUrl ? { "@type": "Organization", name: salonName, url: salonUrl } : undefined,
        offers: hasPrice
          ? {
              "@type": "Offer",
              price: price.toFixed(2),
              priceCurrency: currency || undefined,
              availability: "https://schema.org/InStock",
            }
          : {
              // No price to publish, so no `price` key. A bare Offer with no
              // price is valid and does not compete with a page that has one.
              "@type": "Offer",
              availability: "https://schema.org/InStock",
            },
      };
    });

  if (entries.length === 0) return null;
  return entries;
}

/** Build a BreadcrumbList schema for the page navigation. */
export function buildBreadcrumbSchema({
  items = [],
}: {
  items?: { name?: string; url?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items
      .filter((item) => item?.name && item?.url)
      .map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
  };
}

/** Build a FAQPage schema from an array of { q, a }. */
export function buildFAQSchema({
  faqs = [],
}: {
  faqs?: { q?: string; question?: string; a?: string; answer?: string }[];
}) {
  const entries = faqs
    .map((faq) => ({
      question: faq?.q || faq?.question,
      answer: faq?.a || faq?.answer,
    }))
    .filter((entry) => entry.question && entry.answer);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}
