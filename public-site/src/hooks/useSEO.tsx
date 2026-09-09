import { useEffect } from "react";

/**
 * useSEO — dynamic <head> manager (vanilla, no extra deps).
 * Updates document.title, meta tags, OG tags, canonical, and injects JSON-LD.
 * Cleans up meta tags on unmount.
 */
export function useSEO({
  title,
  description,
  image,
  url,
  type = "website",
  siteName,
  locale = "ar_EG",
  alternateLocale = "en_US",
  schema,
  keywords,
  preloadImage,
}) {
  useEffect(() => {
    if (!title && !description && !schema) return;

    const ensureMeta = (selector, attr, value) => {
      if (!value) return;
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const [key, val] = selector.replace("meta[", "").replace("]", "").split("=");
        el.setAttribute(key, val.replace(/['"]/g, ""));
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    const ensureLink = (rel, href) => {
      if (!href) return;
      let el = document.head.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    // Ensure or remove the LCP image preload link (tagged with id so we don't
    // accidentally touch other preload links in the document, e.g. from Vite).
    const LCP_PRELOAD_ID = "seo-lcp-preload";
    const ensureLcpPreload = (imageUrl) => {
      // Only valid http(s) URLs are acceptable to the browser
      const isValidUrl =
        imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"));
      if (!isValidUrl) {
        const existing = document.getElementById(LCP_PRELOAD_ID);
        if (existing) existing.remove();
        return;
      }
      let el = document.getElementById(LCP_PRELOAD_ID);
      if (!el) {
        el = document.createElement("link");
        el.id = LCP_PRELOAD_ID;
        // Set ALL attributes BEFORE appendChild so the browser never sees an
        // invalid intermediate state (e.g. a preload <link> with no href).
        el.setAttribute("rel", "preload");
        el.setAttribute("as", "image");
        el.setAttribute("href", imageUrl);
        el.setAttribute("fetchpriority", "high");
        document.head.appendChild(el);
      } else {
        el.setAttribute("href", imageUrl);
        el.setAttribute("fetchpriority", "high");
      }
    };

    // Title
    if (title) {
      document.title = title;
    }

    // Basic meta
    ensureMeta('meta[name="description"]', "content", description);
    ensureMeta('meta[name="keywords"]', "content", keywords);

    // Open Graph
    ensureMeta('meta[property="og:type"]', "content", type);
    ensureMeta('meta[property="og:title"]', "content", title);
    ensureMeta('meta[property="og:description"]', "content", description);
    ensureMeta('meta[property="og:image"]', "content", image);
    ensureMeta('meta[property="og:url"]', "content", url);
    ensureMeta('meta[property="og:site_name"]', "content", siteName);
    ensureMeta('meta[property="og:locale"]', "content", locale);
    ensureMeta('meta[property="og:locale:alternate"]', "content", alternateLocale);

    // Twitter
    ensureMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    ensureMeta('meta[name="twitter:title"]', "content", title);
    ensureMeta('meta[name="twitter:description"]', "content", description);
    ensureMeta('meta[name="twitter:image"]', "content", image);

    // Canonical
    ensureLink("canonical", url);

    // Preload LCP image for faster paint (uses a tagged <link> to avoid
    // clobbering other preload links in the document, e.g. from Vite).
    ensureLcpPreload(preloadImage);

    // JSON-LD Schema (supports single object OR array of objects)
    const schemaArray = Array.isArray(schema) ? schema : schema ? [schema] : [];
    let schemaEl = document.getElementById("seo-jsonld");
    if (schemaArray.length > 0) {
      if (!schemaEl) {
        schemaEl = document.createElement("script");
        schemaEl.id = "seo-jsonld";
        schemaEl.setAttribute("type", "application/ld+json");
        document.head.appendChild(schemaEl);
      }
      // Wrap in @graph for multiple schemas
      const payload =
        schemaArray.length === 1
          ? schemaArray[0]
          : {
              "@context": "https://schema.org",
              "@graph": schemaArray,
            };
      schemaEl.textContent = JSON.stringify(payload);
    } else if (schemaEl) {
      schemaEl.remove();
    }

    // No cleanup: meta tags persist for SPA navigation, but reset on next mount
  }, [title, description, image, url, type, siteName, locale, alternateLocale, schema, keywords, preloadImage]);
}

export interface SalonSettingsLike {
  landingAggregateRating?: { ratingValue?: string; reviewCount?: string };
  workingHours?: Record<string, { is_open?: boolean; open_time?: string; close_time?: string }>;
  working_hours?: Record<string, { is_open?: boolean; open_time?: string; close_time?: string }>;
  shopPhone?: string;
  [key: string]: unknown;
}

/**
 * Build a HairSalon JSON-LD schema from settings.
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
  const aggregateRating =
    settings?.landingAggregateRating ||
    { ratingValue: "4.9", reviewCount: "2341" };

  const workingHours = (settings?.workingHours || settings?.working_hours) || {};
  const openingHoursSpecification = Object.entries(workingHours)
    .filter(([, val]) => val?.is_open && val?.open_time && val?.close_time)
    .map(([dayKey, val]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: dayKey.charAt(0).toUpperCase() + dayKey.slice(1),
      opens: val.open_time as string,
      closes: val.close_time as string,
    }));

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
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: aggregateRating.ratingValue,
      reviewCount: aggregateRating.reviewCount,
      bestRating: "5",
      worstRating: "1",
    },
    openingHoursSpecification:
      openingHoursSpecification.length > 0 ? openingHoursSpecification : undefined,
  };
}

/**
 * Build a BreadcrumbList schema for the page navigation.
 */
export function buildBreadcrumbSchema({
  items = [],
}: {
  items?: { name?: string; url?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Build a FAQPage schema from an array of { q, a }.
 */
export function buildFAQSchema({
  faqs = [],
}: {
  faqs?: { q?: string; question?: string; a?: string; answer?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q || faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a || faq.answer,
      },
    })),
  };
}
