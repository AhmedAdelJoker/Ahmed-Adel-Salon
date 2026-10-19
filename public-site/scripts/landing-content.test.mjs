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
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Node's ESM loader needs an explicit extension, and `publicSiteContent.ts`
 * imports `./imageOptimizer` without one because Vite resolves it.
 *
 * Rather than change the source for the benefit of a test -- the extensionless
 * form is what every other module in `src/lib/` uses and rewriting one of them
 * would be inconsistent -- the import is rewritten to `.ts` for the duration of
 * the run and restored afterwards. If the process dies mid-test the file is
 * left with an extension, which is valid TypeScript and still builds; the
 * failure mode is cosmetic, not a broken tree.
 */
const TARGET = join(import.meta.dirname, "..", "src", "lib", "publicSiteContent.ts");
const IMPORT_LINE = 'import { resolveAssetUrl } from "./imageOptimizer";';
const PATCHED_LINE = 'import { resolveAssetUrl } from "./imageOptimizer.ts";';

const original = readFileSync(TARGET, "utf8");
if (!original.includes(IMPORT_LINE)) {
  throw new Error(`expected to find ${IMPORT_LINE} in ${TARGET}`);
}
writeFileSync(TARGET, original.replace(IMPORT_LINE, PATCHED_LINE), "utf8");

let buildLandingSiteContent;
try {
  ({ buildLandingSiteContent } = await import("../src/lib/publicSiteContent.ts"));
} finally {
  writeFileSync(TARGET, original, "utf8");
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