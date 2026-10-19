import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

/**
 * Strip comments before asserting on source text.
 *
 * Several of the fixes below are *documented* in the comments that describe
 * them — "api.ts still hard-codes localhost:8000" is quoted verbatim in the
 * comment explaining why it no longer does. Asserting against raw source would
 * make the test fail on its own explanation.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function read(relativePath) {
  return fs.readFile(path.join(dist, relativePath), "utf8");
}

async function readSource(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

async function readCode(relativePath) {
  return stripComments(await readSource(relativePath));
}

/**
 * netlify.toml writes `Name = "Value"`, _headers writes `Name: Value`, and
 * vercel.json writes `{ "key": "Name", "value": "Value" }`. All three are
 * reduced to `Name: Value` so one list of assertions covers every target.
 */
function normaliseHeaders(source) {
  return source
    .replace(/"key"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]*)"/g, "$1: $2")
    .replace(/"/g, "")
    .replace(/ = /g, ": ");
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function existsInDist(relativePath) {
  try {
    await fs.access(path.join(dist, relativePath));
    return true;
  } catch {
    return false;
  }
}

/** Every .ts/.tsx file under a directory, recursively. */
async function walkSource(dir) {
  const out = [];
  for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkSource(rel)));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/* ── output surface ──────────────────────────────────────────────────────── */

test("emits every entry point, including a real 404 document", async () => {
  const required = [
    "index.html",
    "book/index.html",
    "offline/index.html",
    "salon/salon-pro/index.html",
    "salon/demo/index.html",
    "404.html",
    "sitemap.xml",
    "robots.txt",
  ];

  for (const relativePath of required) {
    await fs.access(path.join(dist, relativePath));
  }

  // A pre-rendered document for a path the router does not serve would hand
  // visitors static content that React immediately replaces with the 404 page.
  assert.ok(
    !(await existsInDist("salon/index.html")),
    "dist/salon/index.html exists but /salon is not a route",
  );
});
/**
 * The original version of this suite asserted only that the files existed.
 * All six pre-rendered documents were byte-identical copies of index.html with
 * an empty <div id="root">, so the suite passed while the site shipped no
 * crawlable content whatsoever. These assertions check the content instead.
 */
test("pre-rendered documents carry distinct, resolved metadata", async () => {
  const routes = ["index.html", "book/index.html", "offline/index.html", "salon/salon-pro/index.html"];
  const titles = new Map();
  const canonicals = new Map();

  for (const route of routes) {
    const html = await read(route);

    // Placeholders must all be substituted.
    assert.ok(!/__[A-Z_]+__/.test(html), `${route}: unresolved __TOKEN__ placeholder`);

    // No document may ship an empty mount point — that was the whole point.
    assert.ok(
      !/<div id="root"><\/div>/.test(html),
      `${route}: root is still empty, so the document has no crawlable content`,
    );

    const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];

    assert.ok(title, `${route}: missing <title>`);
    assert.ok(canonical, `${route}: missing canonical`);
    assert.ok(description && description.length > 30, `${route}: missing/short description`);

    // Absolute, not site-relative: a relative og:url/canonical is ignored.
    assert.ok(canonical.startsWith("https://"), `${route}: canonical is not absolute`);
    assert.ok(!canonical.endsWith("/salon/"), `${route}: canonical collapses to /salon/`);

    titles.set(route, title);
    canonicals.set(route, canonical);
  }

  assert.equal(new Set(titles.values()).size, titles.size, "titles are not unique per route");
  assert.equal(new Set(canonicals.values()).size, canonicals.size, "canonicals are not unique per route");
});

test("every route emits JSON-LD and an absolute Open Graph image", async () => {
  for (const route of ["index.html", "book/index.html", "salon/salon-pro/index.html"]) {
    const html = await read(route);

    assert.ok(
      html.includes('<script type="application/ld+json">'),
      `${route}: no JSON-LD for crawlers`,
    );

    const ogImage = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
    assert.ok(ogImage, `${route}: no og:image`);
    assert.ok(ogImage.startsWith("https://"), `${route}: og:image must be absolute`);
  }
});

/* ── brand assets ────────────────────────────────────────────────────────── */

test("ships the Open Graph image the metadata points at", async () => {
  const html = await read("index.html");
  const ogImage = html.match(/<meta property="og:image" content="https:\/\/[^/]+(\/[^"]*)"/)?.[1];
  assert.ok(ogImage, "could not read og:image path out of index.html");

  // This file was referenced by index.html for the lifetime of the project and
  // never existed, so every social share rendered without a picture.
  assert.ok(await existsInDist(ogImage), `og:image target ${ogImage} is missing from dist`);
});

test("ships the PNG icons PWA installability requires", async () => {
  const manifest = JSON.parse(await read("manifest.json"));

  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes("192x192"), "manifest has no 192x192 icon");
  assert.ok(sizes.includes("512x512"), "manifest has no 512x512 icon");
  assert.ok(
    manifest.icons.some((icon) => icon.purpose === "maskable"),
    "manifest has no maskable icon",
  );

  // An .ico does not satisfy the install criteria; the PNGs must be real files.
  for (const icon of manifest.icons) {
    if (icon.src.endsWith(".png")) {
      assert.ok(await existsInDist(icon.src), `manifest icon ${icon.src} is missing from dist`);
    }
  }

  for (const icon of ["/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"]) {
    assert.ok(await existsInDist(icon), `${icon} is referenced but not emitted`);
  }
});

test("the asset generator is wired into the build", async () => {
  const pkg = JSON.parse(await readSource("package.json"));
  assert.ok(pkg.scripts.assets, "no `assets` script");
  assert.ok(pkg.scripts.prebuild, "no `prebuild` hook, so assets can go stale");
});

/* ── security headers ────────────────────────────────────────────────────── */

test("every deployment target carries an identical CSP", async () => {
  const headers = await read("_headers");
  const netlify = await readSource("netlify.toml");
  const vercel = await readSource("vercel.json");

  const fromHeaders = headers.match(/Content-Security-Policy:\s*(.+)/)?.[1].trim();
  const fromNetlify = netlify.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1].trim();
  const fromVercel = JSON.parse(vercel).headers
    .flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value.trim();

  assert.ok(fromHeaders, "no CSP in public/_headers");
  assert.ok(fromNetlify, "no CSP in netlify.toml");
  assert.ok(fromVercel, "no CSP in vercel.json");

  // netlify.toml shipped no CSP at all while the other two did, so the
  // security posture depended on which host the site was deployed to.
  assert.equal(fromNetlify, fromHeaders, "netlify.toml CSP has drifted from _headers");
  assert.equal(fromVercel, fromHeaders, "vercel.json CSP has drifted from _headers");

  // script-src 'unsafe-inline' defeats the point of a CSP. The theme bootstrap
  // was moved to /theme-init.js specifically so this could be dropped.
  assert.ok(
    /script-src 'self';/.test(fromHeaders),
    "script-src must be 'self' only — inline scripts re-open XSS",
  );
  for (const directive of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(fromHeaders.includes(directive), `CSP is missing ${directive}`);
  }
  // Fonts are self-hosted, so allowing Google Fonts was both wrong and a
  // third-party origin the policy did not need.
  assert.ok(!fromHeaders.includes("fonts.googleapis.com"), "CSP still allows Google Fonts");
  assert.ok(!fromHeaders.includes("fonts.gstatic.com"), "CSP still allows Google Fonts");
});

test("carries the baseline security headers on all three targets", async () => {
  const required = [
    "X-Frame-Options: DENY",
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Strict-Transport-Security:",
    "Permissions-Policy:",
  ];

  const headers = await read("_headers");
  const netlify = normaliseHeaders(await readSource("netlify.toml"));
  const vercel = normaliseHeaders(await readSource("vercel.json"));

  for (const header of required) {
    assert.ok(headers.includes(header), `_headers is missing ${header}`);
    assert.ok(netlify.includes(header), `netlify.toml is missing ${header}`);
    assert.ok(vercel.includes(header), `vercel.json is missing ${header}`);
  }
});

test("never caches the service worker and keeps SPA routing scoped", async () => {
  const headers = await read("_headers");
  const swRules = headers.slice(headers.indexOf("/sw.js"));
  assert.ok(swRules.includes("Cache-Control: public, max-age=0, must-revalidate"));

  // A `/*` -> index.html rewrite serves a 200 for every typo, which is a soft
  // 404: search engines index the landing page under unlimited bogus URLs.
  const netlify = await readSource("netlify.toml");
  assert.ok(
    netlify.includes('from = "/salon/*"'),
    "the SPA fallback must be scoped to /salon/*, not /*",
  );
});

/* ── identity consistency ────────────────────────────────────────────────── */

test("site.config.json is the single source of truth", async () => {
  const site = JSON.parse(await readSource("site.config.json"));
  const origin = site.siteUrl.replace(/\/+$/, "");

  const robots = await read("robots.txt");
  const sitemap = await read("sitemap.xml");
  const home = await read("index.html");

  // These three disagreed for the life of the project: robots.txt and
  // sitemap.xml said salon-pro.com while index.html's Open Graph tags said
  // barberluxe.pro, so crawlers were told two different canonical origins.
  assert.ok(robots.includes(`${origin}/sitemap.xml`), "robots.txt Sitemap disagrees with site.config.json");
  assert.ok(sitemap.includes(`<loc>${origin}/</loc>`), "sitemap.xml disagrees with site.config.json");
  assert.ok(home.includes(`content="${origin}/"`), "index.html canonical disagrees with site.config.json");
  assert.ok(home.includes(`${origin}${site.assets.ogImage}`), "index.html og:image is off-origin");

  assert.ok(site.brand.name.length > 0, "brand.name is empty");
  assert.ok(
    home.includes(`content="${site.brand.name}"`),
    "index.html brand name disagrees with site.config.json",
  );
});

test("no route injects fabricated review data into structured data", async () => {
  const src = await readSource("src/hooks/useSEO.tsx");

  // The old builder defaulted every salon page to a 4.9 / 2341-review
  // aggregateRating, publishing invented review counts to visitors and Google.
  assert.ok(
    !/ratingValue:\s*"4\.9"/.test(src),
    "buildHairSalonSchema still ships a hard-coded rating",
  );
  assert.ok(
    !/reviewCount:\s*"2341"/.test(src),
    "buildHairSalonSchema still ships a hard-coded review count",
  );
  assert.ok(
    src.includes("hasRealRating"),
    "aggregateRating should only be emitted when the salon supplied real numbers",
  );
});

/* ── build configuration ─────────────────────────────────────────────────── */

test("the build is self-contained", async () => {
  const css = await readCode("src/styles/index.css");

  // `@config "../../../frontend/tailwind.config.js"` made the public site
  // unbuildable when deployed on its own, and pointed its utilities at CSS
  // custom properties that only exist inside the admin app.
  assert.ok(
    !/^\s*@config\b/m.test(css),
    "index.css still bridges to the admin app via @config",
  );

  const index = await readCode("index.html");
  assert.ok(index.includes("/src/main.tsx"), "index.html must point at the TypeScript entry");
  assert.ok(!index.includes("src/main.jsx"), "index.html references a non-existent main.jsx");

  // The theme bootstrap was inline, which is what forced script-src to allow
  // 'unsafe-inline'. It now lives in a same-origin file.
  assert.ok(!/<script>\s*\(function/.test(index), "the theme bootstrap is inline again");
  assert.ok(index.includes("/theme-init.js"), "index.html must load /theme-init.js");
  assert.ok(await existsInDist("theme-init.js"), "/theme-init.js was not emitted");
});

test("the API defaults to a same-origin path, not a hard-coded dev port", async () => {
  const api = await readCode("src/services/api.ts");

  // The default was `${protocol}//${hostname}:8000/api/v1`, which in
  // production pointed every request at a port nothing serves.
  assert.ok(api.includes('DEFAULT_API_URL = "/api/v1"'), "API default is not the relative /api/v1");
  assert.ok(!api.includes(":8000"), "api.ts still hard-codes port 8000");

  const vite = await readCode("vite.config.js");
  assert.ok(/"\/api"/.test(vite), "the dev proxy no longer targets /api");
  assert.ok(
    /target:\s*["']http:\/\/localhost:8000["']/.test(vite),
    "the dev proxy lost its backend target",
  );
  // `preview` serves the production bundle; without a proxy the booking form
  // cannot reach the API when you test a real build locally.
  assert.ok(vite.includes("preview:"), "no preview server config");
  // server and preview must share one proxy definition, or they drift.
  assert.ok(vite.includes("API_PROXY"), "the proxy is not shared between server and preview");
});

test("no dead admin-app code ships to the public site", async () => {
  // 23 service files plus four contexts were copied in from the internal app.
  // None were reachable: useSalon/usePreferences/useSocket were never called,
  // and the providers that consumed them sat *outside* the SocketProvider they
  // read from, so their effects could never fire.
  const dead = [
    "src/services/apiAdapter.ts",
    "src/context/AuthContext.tsx",
    "src/context/SalonContext.tsx",
    "src/context/SocketContext.tsx",
    "src/context/PreferencesContext.tsx",
  ];

  for (const file of dead) {
    assert.ok(!(await exists(file)), `${file} is dead code but still present`);
  }

  const services = await fs.readdir(path.join(root, "src/services"));
  assert.deepEqual(
    services.filter((name) => name.endsWith(".ts")),
    ["api.ts"],
    "src/services should contain only the API client",
  );

  // 83 kB of stale JSX sat in public/, which Vite copies verbatim into dist —
  // shipping broken, outdated source to production.
  assert.ok(!(await exists("public/pages")), "public/pages/*.jsx dead source still shipped");
  assert.ok(!(await exists("public/_worker.js")), "the unreferenced Cloudflare worker still ships");
  assert.ok(!(await exists("public/_redirects")), "_redirects duplicates netlify.toml/vercel.json");
});

test("TypeScript strictness that catches dead code is enabled", async () => {
  const tsconfig = JSON.parse(await readSource("tsconfig.json"));

  assert.equal(tsconfig.compilerOptions.noUnusedLocals, true, "noUnusedLocals must be on");
  assert.equal(tsconfig.compilerOptions.noUnusedParameters, true, "noUnusedParameters must be on");
});

/* ── sitemap / robots sanity ─────────────────────────────────────────────── */

test("sitemap lists only indexable routes", async () => {
  const sitemap = await read("sitemap.xml");

  assert.ok(!sitemap.includes("/offline"), "the offline fallback is in the sitemap");
  assert.ok(!sitemap.includes("/demo"), "the demo tenant page is in the sitemap");
  assert.ok(sitemap.includes("<loc>"), "sitemap has no entries");
  assert.ok(sitemap.includes("xhtml:link"), "sitemap has no hreflang alternates");
});

test("robots.txt points at the sitemap and blocks the API", async () => {
  const robots = await read("robots.txt");
  assert.ok(robots.includes("Sitemap:"), "robots.txt declares no sitemap");
  assert.ok(robots.includes("Disallow: /api"), "robots.txt does not block /api");
  assert.ok(robots.includes("Disallow: /offline"), "robots.txt does not block /offline");
});

/* ── internationalisation ────────────────────────────────────────────────── */

test("both locales define exactly the same keys", async () => {
  const i18n = await readSource("src/lib/i18n.ts");

  const arabicKeys = new Set(
    [...i18n.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]),
  );
  assert.ok(arabicKeys.size > 80, `expected a substantial catalogue, found ${arabicKeys.size} keys`);

  // `en` is typed `Record<keyof typeof ar, string>`, so a missing or extra key
  // is already a compile error. This test guards the runtime consequence: a
  // key present in Arabic but absent in English silently renders the Arabic
  // string on an English page.
  const enBlock = i18n.slice(i18n.indexOf("const en:"));
  const enKeys = new Set([...enBlock.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]));

  const missingInEnglish = [...arabicKeys].filter((key) => !enKeys.has(key));
  const extraInEnglish = [...enKeys].filter((key) => !arabicKeys.has(key));

  assert.deepEqual(missingInEnglish, [], "keys defined in Arabic but not English");
  assert.deepEqual(extraInEnglish, [], "keys defined in English but not Arabic");
});

test("the design-review sample catalogue never reaches production", async () => {
  /*
    The demo catalogue is gated with `import.meta.env.DEV`, but the first
    version checked that flag inside a helper and threaded the result through
    `useMemo`/`useState` as a runtime value — which Rollup cannot constant-fold.
    The whole sample catalogue therefore shipped in the production bundle,
    fake salon names and all. This asserts on the built output rather than on
    the source, because the source looks correct either way.
  */
  const sampleMarkers = [
    "أحمد كامل",
    "صالون الحرفة",
    "كريم عبد الله",
    "عرض الافتتاح",
    "باقة groom",
  ];

  const scripts = (await fs.readdir(path.join(dist, "assets"))).filter((name) =>
    name.endsWith(".js"),
  );
  for (const name of scripts) {
    const code = await read(path.join("assets", name));
    for (const marker of sampleMarkers) {
      assert.ok(!code.includes(marker), `${name} still contains the sample data "${marker}"`);
    }
  }

  // And the gate itself must still exist, or the dev review flow is dead.
  const source = await readSource("src/lib/mockCatalog.ts");
  assert.ok(
    /export const DEMO = import\.meta\.env\.DEV/.test(source),
    "the sample catalogue must be gated at module scope so the bundler can drop it",
  );
});

test("every key the code calls actually exists in the catalogue", async () => {
  /*
    The parity test above proves `ar` and `en` agree. It says nothing about
    whether the keys the components *call* exist — and they did not: ten of
    them did not, so the page shipped the literal strings "landing.openNow",
    "landing.visitUs" and "landing.bookYourAppointment" to visitors while
    every test passed. This closes that hole.
  */
  const i18n = await readSource("src/lib/i18n.ts");
  const arabicBlock = i18n.slice(i18n.indexOf("const ar = {"), i18n.indexOf("const en:"));
  const known = new Set(
    [...arabicBlock.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]),
  );

  const missing = [];

  for (const file of await walkSource("src")) {
    if (file.endsWith(path.join("lib", "i18n.ts"))) continue;
    const code = stripComments(await readSource(file));
    for (const match of code.matchAll(/\bt\(\s*["'`]([a-z][A-Za-z0-9_.]*)["'`]/g)) {
      const key = match[1];
      if (known.has(key)) continue;
      const line = code.slice(0, match.index).split("\n").length;
      missing.push(`${file}:${line} → t("${key}")`);
    }
  }

  assert.deepEqual(missing, [], `t() called with keys absent from the catalogue:\n${missing.join("\n")}`);
});

test("every page and component renders through the catalogue", async () => {
  const surfaces = [
    "src/App.tsx",
    "src/pages/LandingPage.tsx",
    "src/pages/PublicBooking.tsx",
    "src/pages/OfflinePage.tsx",
    "src/pages/NotFoundPage.tsx",
    "src/components/ErrorBoundary.tsx",
    "src/components/landing/ThemeToggle.tsx",
    "src/components/landing/LanguageSwitcher.tsx",
    "src/components/landing/CurrencySwitcher.tsx",
    "src/components/landing/MemberPortal.tsx",
    "src/components/landing/PWAInstallPrompt.tsx",
  ];

  /**
   * "ج.م" is the Egyptian pound's currency symbol. It is a unit mark, not copy,
   * and is written the same way in both languages, so it is not a translation
   * miss. Whole string literals are matched rather than runs of Arabic
   * characters, otherwise the interpunct in "ج.م" splits it into two fragments
   * and neither matches the allow-list entry.
   */
  const LOCALE_NEUTRAL = new Set(['"ج.م"', "'ج.م'"]);

  const arabicLiterals = (code) =>
    [...new Set(code.match(/["'][^"'\n]*[\u0600-\u06FF][^"'\n]*["']/g) ?? [])].filter(
      (literal) => !LOCALE_NEUTRAL.has(literal),
    );

  for (const file of surfaces) {
    const code = stripComments(await readSource(file));

    // Arabic literals left in the code are untranslated copy. The catalogue in
    // lib/i18n.ts is the one place they belong.
    const arabic = arabicLiterals(code);
    assert.deepEqual(
      arabic,
      [],
      `${file} still contains hardcoded Arabic: ${arabic.slice(0, 5).join(", ")}`,
    );

    // A surface that imports nothing from the i18n layer cannot be translated.
    assert.ok(
      /useI18n|from "\.\.?\/.*i18n"|translate\(/.test(code),
      `${file} never reads the translation layer`,
    );
  }
});

test("direction is owned by <html>, not hardcoded per page", async () => {
  const i18n = await readSource("src/context/I18nContext.tsx");
  assert.ok(
    i18n.includes('root.dir = isRTL(locale) ? "rtl" : "ltr"'),
    "I18nContext no longer sets <html dir>",
  );
  assert.ok(i18n.includes("root.lang = locale"), "I18nContext no longer sets <html lang>");

  // A hardcoded dir="rtl" container inside an ltr document is exactly what
  // made the English build render mirrored.
  for (const file of ["src/pages/LandingPage.tsx", "src/pages/PublicBooking.tsx"]) {
    const code = stripComments(await readSource(file));
    assert.ok(!code.includes('dir="rtl"'), `${file} still hardcodes dir="rtl"`);
  }

  // Physical box utilities must not creep back in either.
  for (const file of ["src/pages/LandingPage.tsx", "src/pages/PublicBooking.tsx"]) {
    const code = stripComments(await readSource(file));
    const physical = code.match(/\b(ml-\d|mr-\d|pl-\d|pr-\d|text-left|text-right)\b/g) ?? [];
    assert.deepEqual(physical, [], `${file} uses physical (RTL-unsafe) utilities`);
  }
});

test("a11y linting is enabled and cannot be silently disabled", async () => {
  const pkg = JSON.parse(await readSource("package.json"));
  assert.ok(
    pkg.devDependencies?.["eslint-plugin-jsx-a11y"],
    "eslint-plugin-jsx-a11y is not a declared dependency",
  );

  const config = await readSource("eslint.config.js");
  assert.ok(config.includes("jsx-a11y"), "the plugin is installed but never registered");
  for (const rule of [
    "jsx-a11y/label-has-associated-control",
    "jsx-a11y/alt-text",
    "jsx-a11y/anchor-is-valid",
    "jsx-a11y/heading-has-content",
    "jsx-a11y/interactive-supports-focus",
    "jsx-a11y/no-static-element-interactions",
  ]) {
    assert.ok(config.includes(rule), `${rule} is not enforced`);
  }
});

test("every form control in the booking flow has a real label", async () => {
  const booking = await readCode("src/pages/PublicBooking.tsx");
  const portal = await readCode("src/components/landing/MemberPortal.tsx");

  // MemberPortal shipped four <label> elements with neither htmlFor nor a
  // wrapping control, so screen readers announced nothing for those fields.
  const labels = portal.match(/<label\b[^>]*>/g) ?? [];
  for (const label of labels) {
    assert.ok(
      label.includes("htmlFor="),
      `MemberPortal has an unassociated label: ${label.slice(0, 70)}`,
    );
  }

  // The shared field component must not spread unknown props onto the input:
  // the a11y rule treats an element carrying a spread as opaque and skips it.
  assert.ok(!/\{\.\.\.rest\}/.test(booking), "LabelledInput still spreads unknown props");
  assert.ok(
    /<label[^>]*>\s*\{label\}[\s\S]*?<Input/.test(booking),
    "LabelledInput must wrap its Input in a <label> (implicit association)",
  );

  // Placeholder-only labelling fails WCAG 3.3.2 / 4.1.2.
  assert.ok(!/placeholder=/.test(booking), "the booking form still uses placeholder as a label");
});

test("session-replay analytics is not shipped", async () => {
  const analytics = await readSource("src/components/landing/Analytics.tsx");
  const code = stripComments(analytics);

  // Clarity records session replay, which on this site captures whatever a
  // visitor types into the booking form.
  assert.ok(!/CLARITY/i.test(code), "Clarity is still wired up");
  assert.ok(!/clarity\.ms/.test(code), "Clarity is still loaded");

  for (const file of ["netlify.toml", "vercel.json", "public/_headers"]) {
    const target = file.startsWith("public/") ? await read(file.replace("public/", "")) : await readSource(file);
    assert.ok(!/clarity\.ms/.test(target), `${file} still allows the Clarity origin`);
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   Booking handoff
   Real salons send a confirmation; this one used to show a tick and two lines.
   These assert the handoff exists, and that the generated calendar file is
   actually RFC 5545 — the failure mode for hand-written .ics is silent, and a
   malformed file downloads and then does nothing when opened.
 ────────────────────────────────────────────────────────────────────────── */

test("the booking confirmation hands the appointment back to the visitor", async () => {
  const confirmation = await readSource("src/components/booking/BookingConfirmation.tsx");
  const code = stripComments(confirmation);

  for (const key of ["addToCalendar", "sendWhatsapp", "directions", "reference"]) {
    assert.ok(code.includes(key), `the confirmation is missing ${key}`);
  }

  // The reference is what the salon quotes on the phone.
  assert.ok(/reference/.test(code), "the confirmation has no booking reference");
});

test("the generated calendar file is valid iCalendar", async () => {
  const { buildCalendarFile } = await import("../src/lib/ical.ts");

  const ics = buildCalendarFile({
    uid: "REF-123",
    salonName: "Salon Pro",
    date: "2026-09-04",
    time: "15:30",
    durationMinutes: 90,
    // A comma, a semicolon and a newline are the three characters that break a
    // hand-written TEXT property, so they are all in here on purpose. Note the
    // semicolon must be ASCII: `؛` is an ordinary character to an importer and
    // must NOT be escaped.
    services: ["قص كلاسيك, مع غسيل", "حمام; مغربي", "باقة زفاف\nشامل"],
    barberName: "أحمد",
    customerName: "سارة",
    address: "12 شارع元素的, القاهرة",
  });

  assert.ok(ics, "no calendar file was produced");
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"), "the file does not open with CRLF after VCALENDAR");
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"), "the file does not end with a CRLF");

  // RFC 5545: every line break in the file must be CRLF. A stray LF is what
  // makes Google Calendar show the event with no time at all.
  assert.equal((ics.match(/\r\n/g) || []).length, (ics.match(/\n/g) || []).length, "the file mixes CRLF and LF");

  for (const required of ["BEGIN:VEVENT", "DTSTAMP:", "DTSTART:", "DTEND:", "UID:REF-123@salon-pro", "END:VEVENT"]) {
    assert.ok(ics.includes(required), `the calendar is missing ${required}`);
  }

  // Timestamps must be UTC, i.e. ending in Z, and start/end must differ by the
  // 90-minute duration that was requested.
  const start = /DTSTART:(\d{8}T\d{6}Z)/.exec(ics);
  const end = /DTEND:(\d{8}T\d{6}Z)/.exec(ics);
  assert.ok(start && end, "DTSTART/DTEND are not in the UTC form");
  const minutes = (Date.parse(end[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")) - Date.parse(start[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"))) / 60000;
  assert.equal(minutes, 90, "DTEND does not honour the requested duration");

  // Commas, semicolons and newlines inside a TEXT value must be escaped, or the
  // importer splits the property in half.
  assert.ok(ics.includes("قص كلاسيك\\, مع غسيل"), "commas in a service name are not escaped");
  assert.ok(ics.includes("حمام\\; مغربي"), "semicolons in a service name are not escaped");
  assert.ok(ics.includes("باقة زفاف\\nشامل"), "newlines in a service name are not escaped");

  // No physical line may exceed 75 octets, counted in bytes rather than
  // characters — Arabic service names cross the limit in half the characters.
  const encoder = new TextEncoder();
  for (const line of ics.split("\r\n")) {
    // Continuation lines legitimately start with a space, which is not counted.
    const body = line.startsWith(" ") ? line.slice(1) : line;
    assert.ok(encoder.encode(body).length <= 75, `an unfolded line is ${encoder.encode(body).length} octets: ${line}`);
  }

  // Out-of-range input must be rejected. `new Date(y, m, d, 99, 99)` does not
  // fail, it rolls over to the following day and 05:35 — which would put a
  // silent, wrong time in the visitor's calendar.
  assert.equal(buildCalendarFile({ uid: "x", salonName: "s", date: "04/09/2026", time: "15:30" }), null);
  assert.equal(buildCalendarFile({ uid: "x", salonName: "s", date: "2026-09-04", time: "99:99" }), null);
  assert.equal(buildCalendarFile({ uid: "x", salonName: "s", date: "2026-13-45", time: "15:30" }), null);
  assert.ok(buildCalendarFile({ uid: "x", salonName: "s", date: "2026-09-04", time: "00:00" }));
});

test("an interrupted booking is not thrown away", async () => {
  const draft = await readSource("src/lib/bookingDraft.ts");
  const booking = await readSource("src/pages/PublicBooking.tsx");

  assert.ok(/localStorage/.test(draft), "the draft is not persisted");
  // Safari private mode throws on access, which must not break the booking.
  assert.ok(/catch/.test(draft), "localStorage access is unguarded");
  assert.ok(/clearBookingDraft/.test(booking), "the draft survives a successful booking");
  assert.ok(/readBookingDraft/.test(booking), "the draft is never restored");
});

test("whatsapp links are built once, not twice", async () => {
  const shared = await readSource("src/lib/publicSite.ts");
  const landing = await readSource("src/pages/LandingPage.tsx");
  const booking = await readSource("src/pages/PublicBooking.tsx");

  assert.ok(/export function buildWhatsappUrl/.test(shared), "buildWhatsappUrl is not shared");
  // Two copies is how the hard-coded Egyptian country code survived in one of them.
  assert.equal(
    (landing.match(/function buildWhatsappUrl/g) || []).length +
      (booking.match(/function buildWhatsappUrl/g) || []).length,
    0,
    "a page defines its own buildWhatsappUrl instead of importing the shared one",
  );
});

/* ──────────────────────────────────────────────────────────────────────────
   Navigation honesty
   The header advertised #offers and #team while the page rendered neither.
 ────────────────────────────────────────────────────────────────────────── */

test("every navigation anchor resolves to a section", async () => {
  const landing = await readSource("src/pages/LandingPage.tsx");
  const offers = await readSource("src/components/landing/OffersSection.tsx");
  const team = await readSource("src/components/landing/TeamSection.tsx");

  // Anchors are derived from the same conditionals that gate the sections.
  assert.ok(/offerItems\.length \?/.test(landing), "#offers is shown unconditionally");
  assert.ok(/showStaff && teamMembers\.length/.test(landing), "#team is shown unconditionally");
  assert.ok(/id="offers"/.test(offers), "OffersSection has no #offers element");
  assert.ok(/id="team"/.test(team), "TeamSection has no #team element");
});

/* ──────────────────────────────────────────────────────────────────────────
   Loading states
 ────────────────────────────────────────────────────────────────────────── */

test("loading states reserve their layout", async () => {
  const landing = stripComments(await readSource("src/pages/LandingPage.tsx"));

  assert.ok(!/Scissors size=\{30\}/.test(landing), "the landing page still centres a spinner glyph");
  assert.ok(/ServiceRowSkeleton/.test(landing), "the landing page has no skeleton state");
});

test("the print stylesheet targets the public site", async () => {
  // Comments are stripped, because the comment explaining why the admin class
  // names were dropped quotes them verbatim.
  const css = stripComments(await readSource("src/styles/index.css"));
  const printBlock = css.slice(css.indexOf("@media print"));

  // The old block listed admin-only class names that do not exist here.
  assert.ok(!/\.sidebar/.test(printBlock), "print CSS still targets .sidebar");
  assert.ok(!/\.bento-card/.test(printBlock), "print CSS still targets .bento-card");

  // Appending the href to every link printed "#services" next to each nav item.
  assert.ok(
    !/a\[href\]\s*::after/.test(printBlock),
    "print CSS appends every href, including anchors and tel: links",
  );

  // The fixed header and the footer are chrome and are hidden. Scoped to the
  // sticky nav rather than to `header` outright: the FAQ, offers, team and
  // about sections all use a <header> as their heading wrapper, so hiding every
  // one of them printed the page with no section titles at all.
  assert.ok(
    /header\.sticky/.test(printBlock),
    "print CSS does not hide the fixed header",
  );
  assert.ok(/(^|[\s,])footer[\s,{]/.test(printBlock), "print CSS does not hide the footer");
  assert.ok(
    !/(^|[\s,{])header[\s,{]/.test(printBlock.replace(/header\.sticky/g, "")),
    "print CSS hides every <header>, including the section headings",
  );
  assert.ok(/break-inside:\s*avoid/.test(printBlock), "print CSS allows rows to split across sheets");
});

/* ──────────────────────────────────────────────────────────────────────────
   Theme ownership
   The public palette belongs to the salon. These primitives carried `dark:`
   variants inherited from the admin app, so a light-OS visitor on the midnight
   theme received a white card holding white text — measured in the browser, not
   guessed at.
 ────────────────────────────────────────────────────────────────────────── */

test("dark mode follows the salon palette, not the operating system", async () => {
  const css = await readSource("src/styles/index.css");
  const theme = await readSource("src/lib/theme.ts");

  // Tailwind v4 resolves `dark:` from prefers-color-scheme by default. The
  // variant has to be redefined as class-based for `applyThemeMode` to matter.
  assert.ok(
    /@custom-variant dark \(&:where\(\.dark, \.dark \*\)\)/.test(css),
    "`dark:` is still driven by prefers-color-scheme, so the salon theme cannot win",
  );
  assert.ok(/applyThemeMode/.test(theme), "theme.ts has no applyThemeMode");
  assert.ok(/classList\.toggle\("dark"/.test(theme), "applyThemeMode does not toggle the .dark class");

  // Every page that resolves a palette has to apply it.
  for (const page of ["src/pages/LandingPage.tsx", "src/pages/PublicBooking.tsx"]) {
    const source = await readSource(page);
    assert.ok(/applyThemeMode\(theme\)/.test(source), `${page} resolves a theme but never applies it`);
  }
});

test("the shared Card primitive does not paint its own background", async () => {
  // Stripped, because the comment explaining the removal quotes the offending
  // class names verbatim.
  const card = stripComments(await readSource("src/components/ui/card.tsx"));

  // `.public-card` sets a light gradient through the `background` shorthand.
  // A shorthand resets every background longhand, so a caller's `bg-white/5`
  // fixed the colour and left the white gradient painting on top.
assert.ok(!/public-card/.test(card), "Card still opts into the .public-card white gradient");
  // `bg-white` is the problem; `bg-white/5` (an overlay) would be fine.
  assert.ok(!/bg-white(?![/\d])/.test(card), "Card still hard-codes a background colour");
  assert.ok(!/dark:bg-/.test(card), "Card still branches on the dark: variant");
});

/* ──────────────────────────────────────────────────────────────────────────
   Owner settings must actually reach the page
   Five fields had labelled inputs in `WebsiteSettingsPanel`, a type in
   `website.ts`, and defaults in `useWebsiteSettings` — and rendered nowhere.
   `publicSiteContent` passed them into `copy`, which made them look wired up:
   the data arrived and was dropped.
   This test enumerates the settings the admin declares and requires each one to
   be referenced by the public site, so the next dead field fails the build
   instead of shipping.
 ────────────────────────────────────────────────────────────────────────── */

const ADMIN_SETTINGS = path.join(root, "..", "frontend", "src", "types", "website.ts");

test("every setting the owner can edit is consumed by the public site", async (t) => {
  let declared;
  try {
    declared = await fs.readFile(ADMIN_SETTINGS, "utf8");
  } catch {
    // The admin app is a separate deployable and is absent from some checkouts.
    // Skipping is correct; failing would break a legitimate standalone build.
    t.skip("frontend/src/types/website.ts is not present in this checkout");
    return;
  }

  const keys = [...new Set(declared.match(/\blanding[A-Z][A-Za-z0-9_]*/g) || [])].sort();

  assert.ok(keys.length > 20, `only ${keys.length} landing settings found — the extraction is broken`);

  const consumed = new Set();
  for (const file of [
    "src/pages/LandingPage.tsx",
    "src/pages/PublicBooking.tsx",
    "src/components/landing/Hero.tsx",
    "src/components/landing/ServicesList.tsx",
    "src/components/landing/OwnerSections.tsx",
    "src/components/landing/TeamSection.tsx",
    "src/components/landing/OffersSection.tsx",
    "src/components/landing/AboutSection.tsx",
    "src/lib/publicSiteContent.ts",
    "src/lib/theme.ts",
  ]) {
    const source = await readSource(file);
    for (const key of keys) {
      if (source.includes(key)) consumed.add(key);
    }
  }

  const dead = keys.filter((key) => !consumed.has(key));
  assert.deepEqual(
    dead,
    [],
    `the owner can edit these settings but nothing renders them: ${dead.join(", ")}`,
  );
});

test("the about block preserves the owner's own line breaks", async () => {
  const about = await readSource("src/components/landing/AboutSection.tsx");

  // The admin field is a textarea, so newlines are expected input; collapsing
  // them silently discards the owner's formatting.
  assert.ok(/whitespace-pre-line/.test(about), "the about body collapses newlines");
});

test("the header badge and hero highlight are optional, not required", async () => {
  const hero = await readSource("src/components/landing/Hero.tsx");
  const about = await readSource("src/components/landing/AboutSection.tsx");

  // Every one of these is optional, so an unfilled field must omit the block
  // rather than render an empty shell.
  assert.ok(/hasHighlight/.test(hero), "the hero renders its callout unconditionally");
  assert.ok(/highlight\?\.badge\?\.trim\(\)/.test(hero), "hero highlight fields are not trimmed");

  // The guard is `!heading && !hasImage`, not `!heading`: a salon that uploaded
  // an about photograph and left the title blank still has something to show,
  // and dropping the section would delete that photograph from the page. What
  // must never render is the section with *nothing* in it, or a heading shell
  // with no text — hence both checks.
  assert.ok(
    /!heading\s*&&\s*!hasImage\s*\)\s*return null/.test(about),
    "an about section with neither a title nor a photo still renders",
  );
  assert.ok(
    /\{heading\s*\?/.test(about),
    "the about heading renders unconditionally, so a blank title prints an empty shell",
  );
});

/* ──────────────────────────────────────────────────────────────────────────
   The publish snapshot
   `snapshot_fields` in the publish endpoint is the single list deciding what the
   public site can ever receive. Three location fields were on the model, in the
   pydantic schema, and rendered by OwnerSections — and missing from that list,
   so an owner could set them and watch nothing change.
 ────────────────────────────────────────────────────────────────────────── */

const BACKEND_MODEL = path.join(root, "..", "backend", "app", "models", "business_settings.py");
const BACKEND_PUBLISH = path.join(
  root,
  "..",
  "backend",
  "app",
  "api",
  "v1",
  "endpoints",
  "business_settings.py",
);

test("every landing setting the backend stores is published to the public site", async (t) => {
  let model;
  let publish;
  try {
    model = await fs.readFile(BACKEND_MODEL, "utf8");
    publish = await fs.readFile(BACKEND_PUBLISH, "utf8");
  } catch {
    t.skip("the backend is not present in this checkout");
    return;
  }

  const stored = new Set(model.match(/\blanding_[a-z0-9_]+/g) || []);
  assert.ok(stored.size > 20, `only ${stored.size} landing columns found — the extraction is broken`);

  // The list literal that builds the snapshot.
  const start = publish.indexOf("snapshot_fields = [");
  assert.ok(start > -1, "the publish endpoint no longer builds a snapshot");

  const end = publish.indexOf("]", start);
  const published = new Set(
    (publish.slice(start, end).match(/\blanding_[a-z0-9_]+/g) || []),
  );

  const dropped = [...stored].filter((field) => !published.has(field)).sort();
  assert.deepEqual(
    dropped,
    [],
    `the backend stores these but never publishes them: ${dropped.join(", ")}`,
  );
});

/* ──────────────────────────────────────────────────────────────────────────
   Backend reachability
   The public site had capabilities sitting unused in the API the whole time.
   These assert the calls exist so a future refactor cannot quietly drop one and
   leave the feature looking present but non-functional.
 ────────────────────────────────────────────────────────────────────────── */

test("the public site uses the backend capabilities that already existed", async () => {
  const landing = await readSource("src/pages/LandingPage.tsx");
  const booking = await readSource("src/pages/PublicBooking.tsx");
  const member = await readSource("src/context/MemberAuthContext.tsx");

  // GET /reviews/public has been public, unauthenticated and rate-limited all
  // along. Owner-typed testimonials are marketing copy, not evidence.
  assert.ok(landing.includes("/reviews/public"), "the landing page does not fetch public reviews");

  // POST /reviews accepts appointment_id and marks is_verified_visit for
  // completed appointments — exactly the reference the confirmation shows.
  const confirmation = await readSource("src/components/booking/BookingConfirmation.tsx");
  assert.ok(confirmation.includes('api.post("/reviews"'), "there is no way to leave a review");

  // GET /public/member/bookings returned the member's whole history and was
  // never called.
  assert.ok(member.includes("/public/member/bookings"), "member booking history is not fetched");
});

test("member booking history reads the payload shape the API actually returns", async () => {
  const member = await readSource("src/context/MemberAuthContext.tsx");
  const code = stripComments(member);

  // MemberBookingRead is camelCase: scheduledAt, serviceName, barberName. An
  // earlier version read snake_case, so the history rendered with a blank date
  // and an empty service name on every row while looking otherwise correct.
  for (const field of ["scheduledAt", "serviceName", "barberName"]) {
    assert.ok(code.includes(field), `member history does not read the API's ${field}`);
  }
  assert.ok(!/item\.appointment_date/.test(code), "member history still reads snake_case");
  assert.ok(!/item\.service_name/.test(code), "member history still reads snake_case");
});

test("dates are formatted for the active locale, not printed raw", async () => {
  const i18n = await readSource("src/lib/i18n.ts");
  const confirmation = await readSource("src/components/booking/BookingConfirmation.tsx");
  const member = await readSource("src/context/MemberAuthContext.tsx");

  // Intl.NumberFormat and a 12-hour time formatter existed; Intl.DateTimeFormat
  // did not, so the most important line on the confirmation screen rendered a
  // raw YYYY-MM-DD to English visitors.
  assert.ok(/Intl\.DateTimeFormat/.test(i18n), "there is no locale-aware date formatter");
  assert.ok(/formatDate/.test(confirmation), "the confirmation does not use it");
  assert.ok(/formatDate/.test(member), "the booking history does not use it");

  // The raw value must not reach the visible row.
  const row = /<Row label=\{t\("booking\.summary\.date"\)\} value=\{([^}]+)\}/.exec(confirmation);
  assert.ok(row, "the date row was not found");
  assert.notEqual(row[1].trim(), "details.date", "the confirmation still shows the raw ISO date");
});

test("self-service cancel and reschedule exist on both sides", async () => {
  const member = await readSource("src/context/MemberAuthContext.tsx");
const publish = await fs
    .readFile(
      path.join(root, "..", "backend", "app", "api", "v1", "endpoints", "member_public.py"),
      "utf8",
    )
    .catch(() => null);

  assert.ok(member.includes("cancelBooking"), "no client method for cancelling");
  assert.ok(member.includes("rescheduleBooking"), "no client method for rescheduling");

  if (!publish) return; // backend absent from this checkout
  assert.ok(publish.includes("/member/bookings/{appointment_id}/cancel"), "no cancel endpoint");
  assert.ok(publish.includes("/member/bookings/{appointment_id}/reschedule"), "no reschedule endpoint");

  // Ownership must be enforced in the query, not by comparing ids afterwards —
  // otherwise the endpoint confirms that someone else's appointment exists.
  assert.ok(
    /Appointment\.customer_id == customer\.customer_id/.test(publish),
    "the endpoints do not scope the appointment to the member",
  );
});

test("entity detail pages exist for services, barbers and offers", async () => {
  const app = await readSource("src/App.tsx");
  const entity = await readSource("src/pages/EntityPage.tsx");

  for (const kind of ["service", "barber", "offer"]) {
    assert.ok(
      new RegExp(`/salon/:publicSlug/${kind}/:entityId`).test(app),
      `no /salon/:slug/${kind}/:id route`,
    );
  }

  // Without an `Offer` on the Service, a search result cannot show a price, which
  // was the entire point of giving each service its own URL.
  assert.ok(/"@type": "Service"/.test(entity), "service pages emit no Service schema");
  assert.ok(/"@type": "Offer"/.test(entity), "pages emit no Offer schema");
  assert.ok(/"@type": "Person"/.test(entity), "barber pages emit no Person schema");

  // Every route must stay under /salon/* — that is the only scope the Netlify
  // SPA fallback covers, so a top-level route 404s on Netlify while working on
  // Vercel.
  assert.ok(
    !/path="\/(service|barber|offer)/.test(app),
    "an entity route sits outside the /salon/* SPA fallback scope",
  );
});

test("session-recording chat is gone, and the CSP no longer permits it", async () => {
  const chat = stripComments(await readSource("src/components/landing/LiveChat.tsx"));
  assert.ok(!/client\.crisp\.chat/.test(chat), "Crisp is still loaded");

  // Clarity was removed for recording the booking form's name, phone and email.
  // Crisp recorded the same session and its origin was still in the CSP.
  for (const file of ["netlify.toml", "vercel.json", "public/_headers"]) {
    const target = file.startsWith("public/")
      ? await read(file.replace("public/", ""))
      : await readSource(file);
    assert.ok(!/crisp/i.test(target), `${file} still allows the Crisp origin`);
  }
});

test("the booking funnel actually reports conversions", async () => {
  const booking = await readSource("src/pages/PublicBooking.tsx");

  // `trackEvent` had been exported since the analytics component was written and
  // had zero call sites, so the funnel was invisible.
  for (const event of ["booking_started", "booking_step", "booking_completed"]) {
    assert.ok(booking.includes(event), `no ${event} event is reported`);
  }
  // Validation failures are the most actionable signal, and must not record what
  // was typed — only which fields failed.
  assert.ok(/booking_validation_failed/.test(booking), "validation failures are not reported");
  assert.ok(!/booking_validation_failed[\s\S]{0,200}(email|phone|notes|first_name)/.test(booking),
    "a validation event appears to send field values");
});

/* ──────────────────────────────────────────────────────────────────────────
   Entity routes must be real documents, not client-rendered shells
 ────────────────────────────────────────────────────────────────────────── */

test("entity pages are prerendered when the catalogue is reachable", async () => {
  const prerender = await readSource("scripts/prerender.mjs");

  // The discovery step, and the env var that switches it on.
  assert.ok(/discoverCatalogueRoutes/.test(prerender), "prerender has no catalogue discovery");
  assert.ok(/PRERENDER_API_URL/.test(prerender), "discovery is not configurable");
  assert.ok(/booking-catalog/.test(prerender), "discovery does not read the catalogue");

  // A build must not depend on a running backend, so discovery is bounded and
  // non-fatal.
  assert.ok(/setTimeout\(\(\) => controller\.abort\(\), \d+\)/.test(prerender),
    "the catalogue fetch has no timeout, so a build can hang");
  assert.ok(/catch/.test(prerender), "discovery is not failure-tolerant");

  // The discovered routes must reach the sitemap — an indexable page that is
  // not listed is only findable by crawling.
  assert.ok(/buildSitemap\(routes\)/.test(prerender), "the sitemap ignores discovered routes");
  assert.ok(!/buildSitemap\(\)\s*;/.test(prerender), "the sitemap is still built from the static list only");

  // Each entity type needs its own schema in the static document, or the whole
  // point of prerendering is lost.
  for (const type of ["Service", "Person", "Offer"]) {
    assert.ok(prerender.includes(`"@type": "${type}"`), `discovered pages emit no ${type} schema`);
  }
});

test("offers carry their service ids so ?offer= can preselect", async () => {
  const catalogue = await fs
    .readFile(
      path.join(root, "..", "backend", "app", "api", "v1", "endpoints", "booking_public.py"),
      "utf8",
    )
    .catch(() => null);

  const booking = await readSource("src/pages/PublicBooking.tsx");
  const mock = await readSource("src/lib/mockCatalog.ts");

  // `Offer.offer_services` has always existed in the model, but the public
  // payload omitted it — so an offer's price was visible and its services were
  // not, and `?offer=<id>` had nothing to select.
  if (catalogue) {
    assert.ok(/service_ids/.test(catalogue), "booking-catalog does not send service_ids per offer");
  }

  // All three deep links must be read, not just `?service=`.
  for (const param of ["service", "offer", "barber"]) {
    assert.ok(booking.includes(`searchParams.get("${param}")`), `?${param}= is never read`);
  }
  assert.ok(/service_ids/.test(booking), "the offer deep link does not resolve its services");

  // The demo catalogue has to exercise this, or the feature cannot be reviewed.
  assert.ok(/service_ids/.test(mock), "the demo offers have no service_ids");
});
