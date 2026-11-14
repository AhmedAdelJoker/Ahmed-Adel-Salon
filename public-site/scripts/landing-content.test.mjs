/**
 * `buildLandingSiteContent` and the spelling of the settings it reads.
 *
 * ## The failure this prevents
 *
 * `booking-catalog` forwards every setting snake_cased (`landing_stats`,
 * `landing_features`, `landing_trust_badges`, `landing_testimonials`,
 * `landing_portfolio`) because that is how the rest of its payload is shaped.
 * `publicSiteContent` read all five in camelCase. The owner's values arrived,
 * were assigned to a variable nobody read, and the sections rendered empty.
 *
 * Nothing raised, nothing logged: an owner who filled in their stats, features,
 * testimonials and gallery saw a correct-looking page with all of it missing,
 * and the settings panel reported every edit as saved.
 *
 * The fix is `listSetting`, and this pins it on both spellings so the next key
 * added to either side fails here rather than in production.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Node's ESM loader needs an explicit extension, and the modules under test
 * import each other without one because Vite resolves it.
 *
 * Rather than change the source for the benefit of a test -- the extensionless
 * form is what every other module in `src/lib/` uses and rewriting one of them
 * would be inconsistent -- the sources are mirrored into a temporary directory
 * and the imports are rewritten to `.ts` there. The mirror lives inside the
 * project so bare imports still resolve against `public-site/node_modules`,
 * and it is deleted when the run ends. `src/` itself is never written to, so an
 * interrupted run cannot leave the tree with rewritten imports.
 *
 * The chain is walked rather than listed. It is three modules deep
 * (`publicSiteContent` → `imageOptimizer` → `services/api` → `lib/utils`), and
 * a hand-written list missed a level each time one was added, so the suite
 * failed to load and the assertions below never ran — the test that guards the
 * owner's copy was the one test that was not running.
 */
const PUBLIC_SITE = join(import.meta.dirname, "..");
const SRC = join(PUBLIC_SITE, "src");

/** Every `.ts` file under `src`, so the import graph can be walked. */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

/** `from "./x"` / `from "../y"` → the same specifier with `.ts` appended. */
const EXTENSIONLESS = /(\bfrom\s+")(\.[^"]*?)(")/g;

/**
 * `import.meta.env` is a Vite compile-time substitution, so it does not exist
 * under plain Node. `services/api` reads `import.meta.env.VITE_API_URL` at
 * module scope, so the module throws before the test can assert anything.
 * An empty object stands in for it: the API URL then falls back to its own
 * default, which is what a build without `VITE_API_URL` gets anyway.
 */
const VITE_ENV = /import\.meta\.env\b/g;

const mirrorRoot = mkdtempSync(join(PUBLIC_SITE, ".tmp-landing-test-"));
const mirrorSrc = join(mirrorRoot, "src");
cpSync(SRC, mirrorSrc, { recursive: true });

const removeMirror = () => {
  try {
    rmSync(mirrorRoot, { recursive: true, force: true });
  } catch {
    // A leftover mirror is inert; it is outside `src` and never built.
  }
};
process.on("exit", removeMirror);

for (const file of sourceFiles(mirrorSrc)) {
  const source = readFileSync(file, "utf8");
  const hasExtensionless = new RegExp(EXTENSIONLESS.source).test(source);
  const hasViteEnv = VITE_ENV.test(source);
  if (!hasExtensionless && !hasViteEnv) continue;

  let patched = source;
  if (hasExtensionless) {
    patched = patched.replace(EXTENSIONLESS, (match, before, spec, after) =>
      /\.(ts|tsx|js|css|json)$/.test(spec) ? match : `${before}${spec}.ts${after}`,
    );
  }
  if (hasViteEnv) {
    patched = patched.replace(VITE_ENV, "({} as any)");
  }

  writeFileSync(file, patched, "utf8");
}

let buildLandingSiteContent;
try {
  ({ buildLandingSiteContent } = await import(
    pathToFileURL(join(mirrorSrc, "lib", "publicSiteContent.ts")).href
  ));
} finally {
  removeMirror();
}

const ROWS = {
  landingStats: [{ value: "1.2K", label: "clients" }],
  landingFeatures: [{ title: "Sterilised tools", description: "Every client" }],
  landingTrustBadges: [{ label: "Since 2018" }],
  landingTestimonials: [{ name: "A Customer", quote: "Good cut" }],
  landingPortfolio: ["uploads/one.jpg", "uploads/two.jpg"],
};

/** camelCase -> landing_snake_case, mirroring how the endpoint forwards them. */
const snake = (key) =>
  key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

function payload(spelling) {
  const out = {};
  for (const [key, value] of Object.entries(ROWS)) {
    out[spelling === "snake" ? snake(key) : key] = value;
  }
  return out;
}

test("every list-valued setting is read from the snake_case spelling", () => {
  const content = buildLandingSiteContent(payload("snake"));

  assert.equal(content.stats.length, 1);
  assert.equal(content.stats[0].value, "1.2K");

  assert.equal(content.features.length, 1);
  assert.equal(content.features[0].title, "Sterilised tools");

  assert.equal(content.trustBadges.length, 1);
  assert.equal(content.trustBadges[0].label, "Since 2018");

  assert.equal(content.testimonials.length, 1);
  assert.equal(content.testimonials[0].name, "A Customer");
  assert.equal(content.testimonials[0].quote, "Good cut");

  assert.equal(content.portfolio.length, 2);
});

test("the camelCase spelling still works", () => {
  // The preview draft path (`publicSitePreview`) writes camelCase, so dropping
  // it would break owner previews before it broke the live site.
  const content = buildLandingSiteContent(payload("camel"));
  assert.equal(content.stats.length, 1);
  assert.equal(content.features.length, 1);
  assert.equal(content.testimonials.length, 1);
  assert.equal(content.portfolio.length, 2);
});

test("an empty payload produces empty sections, not a crash", () => {
  const content = buildLandingSiteContent({});
  assert.deepEqual(content.stats, []);
  assert.deepEqual(content.features, []);
  assert.deepEqual(content.testimonials, []);
  assert.deepEqual(content.portfolio, []);
});

test("a malformed row is dropped rather than rendered blank", () => {
  const content = buildLandingSiteContent({
    landing_features: [{ title: "Kept", description: "Yes" }, { description: "no title" }, null],
  });
  assert.equal(content.features.length, 1);
  assert.equal(content.features[0].title, "Kept");
});

/**
 * The scalar copy keys, which the list fix above did not cover.
 *
 * `landingServicesTitle` and its thirty-nine siblings are read by name out of
 * the same payload, and they were read in camelCase only. The endpoint
 * forwards them snake_cased, so every one of them was silently empty and each
 * section fell back to the interface's generic string — the services band read
 * "خدمات واضحة وأسعار ظاهرة" instead of the owner's "ماذا نقدم لك؟", and the
 * contact band read the salon name instead of the owner's own heading.
 *
 * This pins both spellings for the copy map, so the next key added to either
 * side fails here rather than on the page.
 */
const COPY_ROWS = {
  landingServicesTitle: "ماذا نقدم لك؟",
  landingServicesEyebrow: "خدماتنا",
  landingContactTitle: "يسعدنا سماع صوتك",
  landingPortfolioTitle: "إبداعاتنا",
  landingTestimonialsTitle: "ماذا يقول عملاؤنا",
  landingLocationTitle: "تجدنا هنا",
};

function copyPayload(spelling) {
  const out = {};
  for (const [key, value] of Object.entries(COPY_ROWS)) {
    out[spelling === "snake" ? snake(key) : key] = value;
  }
  return out;
}

test("scalar copy is read from the snake_case spelling the endpoint forwards", () => {
  const content = buildLandingSiteContent(copyPayload("snake"));

  assert.equal(content.copy.landingServicesTitle, "ماذا نقدم لك؟");
  assert.equal(content.copy.landingServicesEyebrow, "خدماتنا");
  assert.equal(content.copy.landingContactTitle, "يسعدنا سماع صوتك");
  assert.equal(content.copy.landingPortfolioTitle, "إبداعاتنا");
  assert.equal(content.copy.landingTestimonialsTitle, "ماذا يقول عملاؤنا");
  assert.equal(content.copy.landingLocationTitle, "تجدنا هنا");
});

test("scalar copy still reads the camelCase spelling the preview draft writes", () => {
  const content = buildLandingSiteContent(copyPayload("camel"));

  assert.equal(content.copy.landingServicesTitle, "ماذا نقدم لك؟");
  assert.equal(content.copy.landingContactTitle, "يسعدنا سماع صوتك");
});

test("a copy key the owner adds later arrives under its camelCase name", () => {
  // The passthrough loop is what lets a new settings field reach the page
  // without a code change. It has to normalise the spelling, or the value
  // lands under a name no component reads.
  const content = buildLandingSiteContent({
    landing_offers_title: "عروض هذا الأسبوع",
  });
  assert.equal(content.copy.landingOffersTitle, "عروض هذا الأسبوع");
});

test("the staff switches are not read as copy", () => {
  // `landing_show_staff` is a boolean. Copying it into the copy map would put
  // the string "true" where a boolean is expected.
  const content = buildLandingSiteContent({
    landing_show_staff: false,
    landing_show_staff_bio: false,
  });
  assert.equal(content.copy.landingShowStaff, undefined);
  assert.equal(content.copy.landingShowStaffBio, undefined);
});
