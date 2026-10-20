/**
 * prerender.mjs — post-build static generation.
 *
 * What this used to do: copy dist/index.html to dist/book/index.html,
 * dist/offline/index.html and a couple of /salon/* paths, then print
 * "Pre-rendered 6 routes successfully". Every one of those documents was
 * byte-identical and contained an empty <div id="root"></div>, so crawlers
 * received no title variation, no canonical, no JSON-LD and no text at all.
 * The output looked like SSG and was not.
 *
 * What it does now, for each route:
 *   1. resolves the __SITE_*__ placeholders from site.config.json
 *   2. rewrites <title>, description, canonical, og:url and robots per route
 *   3. injects route-specific JSON-LD into the served document
 *   4. injects a real, readable document body, so the HTML is useful to
 *      crawlers and to visitors with JavaScript disabled
 *   5. emits sitemap.xml, robots.txt and 404.html
 *
 * React mounts with createRoot(), not hydrateRoot(), so it discards whatever
 * sits inside #root on boot. The injected markup is a progressive enhancement,
 * never a hydration mismatch.
 *
 * Run after `vite build`. Output: dist/<route>/index.html
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const site = JSON.parse(await fs.readFile(path.join(ROOT, "site.config.json"), "utf8"));
const ORIGIN = (process.env.VITE_SITE_URL || site.siteUrl).replace(/\/+$/, "");
const BRAND = site.brand;
const LOCALE = site.locale;
const ASSETS = site.assets;

const OG_IMAGE = `${ORIGIN}${ASSETS.ogImage}`;
const OG_IMAGE_ALT = `${BRAND.name} — ${BRAND.tagline}`;

/* ── catalogue discovery ─────────────────────────────────────────────────── */

/**
 * Build-time discovery of the tenant and its services, barbers and offers.
 *
 * Why this exists: `/salon/:slug/service/:id`, `/barber/:id` and `/offer/:id`
 * were added so a search engine could show a price next to a result and so each
 * entity had a shareable URL. But this prerenderer had a hardcoded route list,
 * so those pages shipped as an empty `<div id="root">` — the schema and the
 * prices were only ever produced by JavaScript, which is exactly what a crawler
 * does not run.
 *
 * `booking-catalog` is single-tenant (`BusinessSettings.first()`), so one request
 * returns the slug and every entity. It 404s until the site is published, which
 * is the normal state for a fresh install.
 *
 * Failure is never fatal: a build with no reachable API produces the static
 * routes only, and says so. Making the build depend on a running backend would
 * mean a developer's `npm run build` breaks when their API is down.
 */
async function discoverCatalogueRoutes() {
  const base = process.env.PRERENDER_API_URL || process.env.VITE_API_URL;
  if (!base) {
    console.log(
      "  · entity routes skipped (set PRERENDER_API_URL to prerender service/barber/offer pages)",
    );
    return [];
  }

  const url = `${base.replace(/\/+$/, "")}/api/v1/public/booking-catalog`;
  const controller = new AbortController();
  // A build must not hang on an unreachable host.
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      // 404 here is the documented "site not published yet" response, not a
      // misconfiguration, so it is reported plainly rather than as a warning.
      console.log(`  · entity routes skipped (catalogue returned ${response.status})`);
      return [];
    }

    const catalogue = await response.json();
    const business = catalogue.business || {};
    const slug = String(
      business.public_slug || business.publicSlug || business.salon_name || business.salonName || "",
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\p{Letter}\p{Number}\s-]/gu, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      console.log("  · entity routes skipped (the catalogue has no usable public_slug)");
      return [];
    }

    const salonName = String(business.salon_name || business.salonName || BRAND.name);
    const basePath = `/salon/${slug}`;
    const bookUrl = `${ORIGIN}${basePath}/book`;
    const salonUrl = `${ORIGIN}${basePath}`;
    const routes = [];

    for (const service of catalogue.services || []) {
      if (!service.id) continue;
      const name = String(service.name_ar || service.name || "").trim();
      if (!name) continue;
      const price = Number(service.price);
      const duration = Number(service.duration_minutes || service.duration);
      routes.push({
        path: `${basePath}/service/${service.id}`,
        file: `${basePath}/service/${service.id}/index.html`,
        title: `${name} | ${salonName}`,
        description: String(service.description_ar || service.description || `${name} في ${salonName}`),
        heading: name,
        intro: String(service.description_ar || service.description || ""),
        sections: [
          ...(Number.isFinite(price) && price > 0
            ? [{ title: "السعر", body: `${price} ${business.currency || "ج.م"}` }]
            : []),
          ...(Number.isFinite(duration) && duration > 0
            ? [{ title: "المدة", body: `${duration} دقيقة` }]
            : []),
          { title: "الحجز", body: `احجز ${name} مباشرة من صفحة الحجز.` },
        ],
        schema: [
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name,
            description: String(service.description_ar || service.description || name),
            url: `${ORIGIN}${basePath}/service/${service.id}`,
            provider: { "@type": "HairSalon", name: salonName, url: salonUrl },
            ...(Number.isFinite(price) && price > 0
              ? {
                  offers: {
                    "@type": "Offer",
                    price: String(price),
                    priceCurrency: "EGP",
                    availability: "https://schema.org/InStock",
                    url: bookUrl,
                  },
                }
              : {}),
          },
        ],
      });
    }

    for (const barber of catalogue.barbers || []) {
      if (!barber.id) continue;
      const name = String(barber.display_name || barber.full_name || "").trim();
      if (!name) continue;
      routes.push({
        path: `${basePath}/barber/${barber.id}`,
        file: `${basePath}/barber/${barber.id}/index.html`,
        title: `${name} | ${salonName}`,
        description: `${name} — ${String(barber.job_title || "حلاق في " + salonName)}`,
        heading: name,
        intro: String(barber.bio_ar || barber.bio || ""),
        sections: [
          ...(barber.job_title ? [{ title: "المسمى", body: String(barber.job_title) }] : []),
          { title: "الحجز", body: `احجز موعدك مع ${name} مباشرة.` },
        ],
        schema: [
          {
            "@context": "https://schema.org",
            "@type": "Person",
            name,
            jobTitle: barber.job_title ? String(barber.job_title) : undefined,
            description: String(barber.bio_ar || barber.bio || name),
            url: `${ORIGIN}${basePath}/barber/${barber.id}`,
            worksFor: { "@type": "HairSalon", name: salonName, url: salonUrl },
          },
        ],
      });
    }

    for (const offer of catalogue.offers || []) {
      if (!offer.id) continue;
      const name = String(offer.name_ar || offer.name || "").trim();
      if (!name) continue;
      const offerPrice = Number(offer.offer_price);
      const originalPrice = Number(offer.original_price);
      routes.push({
        path: `${basePath}/offer/${offer.id}`,
        file: `${basePath}/offer/${offer.id}/index.html`,
        title: `${name} | ${salonName}`,
        description: String(offer.description_ar || offer.description || name),
        heading: name,
        intro: String(offer.description_ar || offer.description || ""),
        sections: [
          ...(Number.isFinite(offerPrice) && offerPrice > 0
            ? [{ title: "سعر العرض", body: `${offerPrice} ${business.currency || "ج.م"}` }]
            : []),
          ...(Number.isFinite(originalPrice) && originalPrice > 0
            ? [{ title: "قبل الخصم", body: `${originalPrice} ${business.currency || "ج.م"}` }]
            : []),
        ],
        schema: [
          {
            "@context": "https://schema.org",
            "@type": "Offer",
            name,
            description: String(offer.description_ar || offer.description || name),
            url: `${ORIGIN}${basePath}/offer/${offer.id}`,
            seller: { "@type": "HairSalon", name: salonName, url: salonUrl },
            ...(Number.isFinite(offerPrice) && offerPrice > 0
              ? {
                  price: String(offerPrice),
                  priceCurrency: "EGP",
                  ...(Number.isFinite(originalPrice) && originalPrice > 0
                    ? {
                        priceSpecification: {
                          "@type": "PriceSpecification",
                          price: String(originalPrice),
                          priceCurrency: "EGP",
                        },
                      }
                    : {}),
                }
              : {}),
          },
        ],
      });
    }

    if (routes.length) {
      console.log(`  · discovered ${routes.length} entity route(s) for /salon/${slug}`);
    }
    return routes;
  } catch (error) {
    const reason = error?.name === "AbortError" ? "timed out after 8s" : error?.message;
    console.log(`  · entity routes skipped (could not reach ${url}: ${reason})`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/* ── escaping ───────────────────────────────────────────────────────────── */

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** JSON made safe to embed inside a <script> block. */
const escapeJsonLd = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

/* ── the page catalogue ─────────────────────────────────────────────────── */

/**
 * Every pre-rendered route. `noindex` marks pages that must never reach a
 * search index, and each route carries its own title and description so no
 * two documents are duplicates of one another.
 */
const ROUTES = [
  {
    path: "/",
    file: "index.html",
    title: BRAND.defaultTitle,
    description: BRAND.description,
    heading: `${BRAND.name} — ${BRAND.tagline}`,
    intro: BRAND.description,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: BRAND.name,
        url: `${ORIGIN}/`,
        inLanguage: LOCALE.htmlLang,
        description: BRAND.description,
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: BRAND.name,
        url: `${ORIGIN}/`,
        logo: `${ORIGIN}${ASSETS.favicon.replace("/favicon.ico", "/icon-512.png")}`,
      },
    ],
    sections: [
      {
        title: "احجز موعدك في ثوانٍ",
        body: "اختر الخدمة، ثم الحلاق، ثم اليوم والوقت المناسب. الأسعار واضحة قبل الحجز دون أي مفاجآت.",
      },
      {
        title: "خدمات وفريق يظهران بوضوح",
        body: "كل خدمة تعرض الاسم والمدة والسعر، وكل حلاق يظهر باسمه وصورته وخبرته قبل أن تختار.",
      },
      {
        title: "ساعات عمل دقيقة",
        body: "تعرف هل الصالون مفتوح الآن، وتتابع أيام العمل وتوقيتها قبل أن تحجز.",
      },
    ],
  },
  {
    path: "/book",
    file: "book/index.html",
    noindex: true,
    title: `احجز موعدك الآن | ${BRAND.name}`,
    description: `احجز موعدك في ${BRAND.name} عبر أربع خطوات: الخدمة، الحلاق، الموعد، ثم بياناتك.`,
    heading: "احجز موعدك الآن",
    intro: `أربع خطوات فقط تفصلك عن موعد مؤكد في ${BRAND.name}.`,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `احجز موعدك الآن | ${BRAND.name}`,
        url: `${ORIGIN}/book`,
        inLanguage: LOCALE.htmlLang,
        isPartOf: { "@type": "WebSite", name: BRAND.name, url: `${ORIGIN}/` },
      },
    ],
    sections: [
      { title: "١. الخدمات", body: "اختر الخدمة أو الباقة التي تناسبك، وتظهر المدة والسعر فورًا." },
      { title: "٢. الحلاق", body: "حدد الحلاق المفضل، أو اترك الاختيار مفتوحًا لأي حلاق متاح." },
      { title: "٣. الموعد", body: "اختر اليوم والوقت المتاح، وتأكد أن الموعد مؤكد قبل المتابعة." },
      { title: "٤. بياناتك", body: "أدخل الاسم ورقم الهاتف لتأكيد الحجز واستلام رسالة التفاصيل." },
    ],
  },
  {
    path: "/offline",
    file: "offline/index.html",
    noindex: true,
    title: `لا يوجد اتصال | ${BRAND.name}`,
    description: "صفحة احتياطية تُعرض عند فقدان الاتصال بالإنترنت.",
    heading: "لا يوجد اتصال بالإنترنت",
    intro: "تحقق من اتصالك ثم أعد المحاولة. ستستعيد الصفحة تلقائيًا عند عودة الاتصال.",
  },
  {
    path: "/salon/salon-pro",
    file: "salon/salon-pro/index.html",
    title: `Salon Pro | خدمات وحجوزات أونلاين`,
    description: `تعرّف على خدمات ${BRAND.name}، الفريق، العروض المتاحة، وساعات العمل، ثم احجز موعدك مباشرة.`,
    heading: BRAND.name,
    intro: "خدمات واضحة، أسعار ظاهرة، وفريق محترف يساعدك تختار الموعد المناسب بدون تشتت.",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "HairSalon",
        name: BRAND.name,
        url: `${ORIGIN}/salon/salon-pro`,
        image: OG_IMAGE,
        description: BRAND.shortDescription,
        inLanguage: LOCALE.htmlLang,
        priceRange: "$$",
        potentialAction: {
          "@type": "ReserveAction",
          target: { "@type": "EntryPoint", urlTemplate: `${ORIGIN}/salon/salon-pro/book` },
        },
      },
    ],
    sections: [
      { title: "الخدمات", body: "قائمة خدمات محدّثة مع المدة والسعر لكل خدمة." },
      { title: "الفريق", body: "صور الحلاقين وأسماءهم وخبراتهم قبل اختيار الموعد." },
      { title: "ساعات العمل", body: "توقيت العمل لكل يوم وهل الصالون مفتوح الآن." },
    ],
  },
  {
    path: "/salon/demo",
    file: "salon/demo/index.html",
    noindex: true,
    title: `صفحة صالون تجريبية | ${BRAND.name}`,
    description: "نموذج لصفحة صالون مهيّأة لتجربة نظام الحجز والتصميم العام.",
    heading: "صفحة صالون تجريبية",
    intro: "هذه صفحة نموذج توضح كيف تظهر بيانات الصالون للزوار قبل ربطها ببيانات حقيقية.",
  },
];

/* ── document rewriting ─────────────────────────────────────────────────── */

/** Resolve the __SITE_*__ placeholders that index.html ships with. */
function applyTokens(html) {
  const tokens = {
    __SITE_TITLE__: BRAND.defaultTitle,
    __SITE_DESCRIPTION__: BRAND.description,
    __SITE_BRAND__: BRAND.name,
    __SITE_URL__: ORIGIN,
    __THEME_LIGHT__: site.theme.light,
    __THEME_DARK__: site.theme.dark,
    __OG_IMAGE__: OG_IMAGE,
    __OG_IMAGE_ALT__: OG_IMAGE_ALT,
    __OG_LOCALE__: LOCALE.openGraph,
    __OG_LOCALE_ALT__: LOCALE.alternate,
  };

  return Object.entries(tokens).reduce(
    (acc, [token, value]) => acc.split(token).join(escapeHtml(value)),
    html,
  );
}

/**
 * Replace the content of an existing meta tag, or append one.
 *
 * og:* and article:* use the `property` attribute; everything else uses `name`.
 */
function upsertMeta(html, key, value) {
  const attr = key.startsWith("og:") || key.startsWith("article:") ? "property" : "name";
  const escaped = escapeHtml(value);
  const pattern = new RegExp(
    `(<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*?\\scontent=")[^"]*(")`,
  );
  if (pattern.test(html)) {
    return html.replace(pattern, `$1${escaped}$2`);
  }
  return html.replace("</head>", `  <meta ${attr}="${key}" content="${escaped}" />\n</head>`);
}

function upsertCanonical(html, url) {
  const escaped = escapeHtml(url);
  if (/<link[^>]+rel="canonical"[^>]*>/.test(html)) {
    return html.replace(/(<link[^>]+rel="canonical"[^>]*?href=")[^"]*(")/, `$1${escaped}$2`);
  }
  return html.replace("</head>", `  <link rel="canonical" href="${escaped}" />\n</head>`);
}

/**
 * The hreflang alternates for a route.
 *
 * Locale is stored in localStorage and never encoded in the path, so one route
 * has exactly one address. Pointing a separate `en` alternate at that same
 * address — as `Object.values(LOCALE.hreflang)` produced twice, once for the
 * sitemap and once for the prerendered head — is the classic hreflang
 * misconfiguration: identical targets make Google discard the whole alternates
 * set and fall back to guessing a language.
 *
 * `ar` plus `x-default` on the one real URL is the legal form of "this is the
 * only address, for everyone". Both callers share this so they cannot drift.
 */
function alternateHrefs(loc) {
  return ["ar", "x-default"].map((hreflang) => ({ hreflang, href: loc }));
}

/** Point the hreflang alternates at this route. */
function upsertHreflang(html, routePath) {
  const loc = escapeHtml(`${ORIGIN}${routePath}`);
  const tags = alternateHrefs(loc)
    .map(
      ({ hreflang, href }) =>
        `<link rel="alternate" hreflang="${escapeHtml(hreflang)}" href="${href}" />`,
    )
    .join("\n  ");

  const cleaned = html.replace(/\s*<link[^>]+rel="alternate"[^>]*\/>/g, "");
  return cleaned.replace(/(<link[^>]+rel="canonical"[^>]*\/>)/, (tag) => `${tag}\n  ${tags}`);
}

function injectJsonLd(html, schema) {
  if (!schema || schema.length === 0) return html;
  const payload =
    schema.length === 1 ? schema[0] : { "@context": "https://schema.org", "@graph": schema };
  return html.replace("</head>", `  <script type="application/ld+json">${escapeJsonLd(payload)}</script>\n</head>`);
}

/** The static, readable document. Replaced by React on mount. */
function renderStaticBody(route) {
  const sections = (route.sections || [])
    .map(
      ({ title, body }) => `      <section>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(body)}</p>
      </section>`,
    )
    .join("\n");

  return `    <div id="root">
      <main>
        <h1>${escapeHtml(route.heading)}</h1>
        <p>${escapeHtml(route.intro)}</p>
${sections}
        <p><a href="/book">ابدأ الحجز</a></p>
      </main>
    </div>`;
}

function buildRouteHtml(template, route) {
  let html = applyTokens(template);

  const canonical = `${ORIGIN}${route.path === "/" ? "/" : route.path}`;
  const title = route.title || BRAND.defaultTitle;
  const description = route.description || BRAND.description;
  const robots = route.noindex
    ? "noindex, follow"
    : "index, follow, max-image-preview:large";

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = upsertMeta(html, "description", description);
  html = upsertMeta(html, "og:title", title);
  html = upsertMeta(html, "og:description", description);
  html = upsertMeta(html, "og:url", canonical);
  html = upsertMeta(html, "og:image", OG_IMAGE);
  html = upsertMeta(html, "og:image:alt", OG_IMAGE_ALT);
  html = upsertMeta(html, "twitter:title", title);
  html = upsertMeta(html, "twitter:description", description);
  html = upsertMeta(html, "twitter:image", OG_IMAGE);
  html = upsertMeta(html, "robots", robots);
  html = upsertCanonical(html, canonical);
  html = upsertHreflang(html, route.path);
  html = injectJsonLd(html, route.schema);

  // Replace the empty mount point with the readable fallback document.
  return html.replace(/<div id="root"><\/div>/, renderStaticBody(route));
}

/* ── sitemap / robots / 404 ─────────────────────────────────────────────── */

/**
 * Build the sitemap from whichever routes are actually being prerendered.
 *
 * This took the static `ROUTES` list, so every discovered entity route was
 * absent from the sitemap — a page that is indexable but not listed is a page
 * search engines only find by crawling.
 */
function buildSitemap(routes) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = routes
    .filter((route) => !route.noindex)
    .map((route) => {
      const loc = escapeHtml(`${ORIGIN}${route.path === "/" ? "/" : route.path}`);
      const alternates = alternateHrefs(loc)
        .map(
          ({ hreflang, href }) =>
            `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}" />`,
        )
        .join("\n");
      // Entity pages are the long tail; the salon root outranks them, and an
      // offer outranks a single service.
      let priority = "0.9";
      if (route.path === "/") priority = "1.0";
      else if (route.path.includes("/offer/")) priority = "0.7";
      else if (/\/(service|barber)\//.test(route.path)) priority = "0.6";
      const changefreq = route.path === "/" ? "weekly" : "monthly";
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
${alternates}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`;
}

function buildRobots() {
  return `# ${BRAND.name}
User-agent: *
Allow: /
Disallow: /api/

# The offline fallback has no value in an index.
Disallow: /offline

Sitemap: ${ORIGIN}/sitemap.xml
`;
}

function buildNotFound(template) {
  let page = applyTokens(template);
  page = page.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>الصفحة غير موجودة | ${escapeHtml(BRAND.name)}</title>`,
  );
  page = upsertMeta(page, "robots", "noindex, follow");
  page = upsertMeta(page, "description", "الصفحة المطلوبة غير موجودة.");
  return page.replace(
    /<div id="root"><\/div>/,
    renderStaticBody({
      path: "/404",
      heading: "الصفحة غير موجودة",
      intro: "الرابط الذي فتحته غير صحيح أو تم نقل الصفحة. يمكنك العودة إلى الصفحة الرئيسية أو الانتقال مباشرة إلى صفحة الحجز.",
      sections: [],
    }),
  );
}

/* ── main ───────────────────────────────────────────────────────────────── */

async function writeFile(relativePath, contents) {
  const target = path.join(DIST, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

async function main() {
  const template = await fs.readFile(path.join(DIST, "index.html"), "utf8");

  if (!template.includes("__SITE_TITLE__")) {
    throw new Error(
      "dist/index.html contains no __SITE_*__ placeholders — the token pass did not run.",
    );
  }

  // Static routes plus whatever the live catalogue contains. Discovery never
  // throws: without a reachable API the entity routes are simply absent, and the
  // SPA fallback still serves them.
  const entityRoutes = await discoverCatalogueRoutes();
  const routes = [...ROUTES, ...entityRoutes];

  let count = 0;
  for (const route of routes) {
    await writeFile(route.file, buildRouteHtml(template, route));
    console.log(`  ${route.path}`);
    count += 1;
  }

  await writeFile("404.html", buildNotFound(template));
  console.log("  /404.html");

  await writeFile("sitemap.xml", buildSitemap(routes));
  console.log("  /sitemap.xml");

  await writeFile("robots.txt", buildRobots());
  console.log("  /robots.txt");

  console.log(`\nGenerated ${count} pre-rendered documents (origin: ${ORIGIN}).`);
  if (!entityRoutes.length) {
    console.log(
      "Note: no service/barber/offer pages were prerendered — set PRERENDER_API_URL and rebuild.",
    );
  }
}

main().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
