/**
 * The public payload must carry every setting the public site reads.
 *
 * ## The failure this exists to prevent
 *
 * `publish-site` snapshotted ~55 settings and the public site read most of
 * them, but the `booking-catalog` endpoint forwarded only seven. Everything
 * else — most importantly `landing_theme_id`, which selects the entire colour
 * scheme — was silently dropped, so a salon's chosen palette, currency, social
 * links and all their authored copy had no effect on the live page while the
 * settings panel reported every edit as saved.
 *
 * Two independent halves have to agree for a setting to reach a visitor:
 *
 *   1. the field is in `publish_site`'s snapshot list, and
 *   2. the public endpoint forwards it from the snapshot.
 *
 * This checks both, and cross-checks the two lists against each other. A field
 * added to only one side is the exact shape of the original bug, so it fails
 * here rather than in production.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const here = path.dirname(fileURLToPath(import.meta.url));
// scripts/ -> public-site/ -> repo root/, then backend/app.
const backend = path.join(here, "..", "..", "backend", "app");

const readCode = (relative) =>
  readFile(path.join(backend, relative), "utf8").catch(() => null);

/** Strip comments so a field mentioned only in prose is not counted. */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/**
 * Quoted keys inside the endpoint's business payload, together with the
 * accessor they read through.
 *
 * The accessors differ by type on purpose: `public_payload` normalises working
 * hours, `_as_bool` keeps a stringly-typed boolean a boolean, and `_json_safe`
 * guards the JSON columns. Any of them counts as forwarded.
 */
function forwardedFields(code) {
  const start = code.indexOf('"business": {');
  assert.ok(start > -1, "booking-catalog has no business payload");
  const end = code.indexOf("        },", start);
  const block = code.slice(start, end > -1 ? end : start + 8000);
  return new Set(
    [...block.matchAll(/"([a-z0-9_]+)":\s*(?:public_|_as_bool|_json_safe)/g)].map(
      (m) => m[1],
    ),
  );
}

/** Quoted strings inside publish_site's snapshot_fields list. */
function snapshotFields(code) {
  const start = code.indexOf("snapshot_fields = [");
  assert.ok(start > -1, "publish_site has no snapshot_fields list");
  const end = code.indexOf("]", start);
  return new Set(
    [...code.slice(start, end).matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]),
  );
}

/**
 * Settings the public site reads off the catalogue payload. Anything missing
 * from the API response is a setting the owner can edit that cannot work.
 */
const REQUIRED_BY_PUBLIC_SITE = [
  "salon_name",
  "shop_phone",
  "shop_whatsapp",
  "address",
  "logo_url",
  "public_slug",
  "working_hours",
  "currency",
  "landing_theme_id",
  "google_maps_url",
  "landing_cover_image_url",
  "landing_show_staff",
  "landing_show_staff_bio",
  "landing_public_header_badge",
  "landing_contact_eyebrow",
  "landing_contact_title",
  "landing_contact_subtitle",
  "social_facebook",
  "social_instagram",
  "social_tiktok",
  "social_youtube",
];

test("the public payload forwards every setting the site reads", async () => {
  const endpoint = stripComments(
    (await readCode("api/v1/endpoints/booking_public.py")) ?? "",
  );
  const settings = stripComments(
    (await readCode("api/v1/endpoints/business_settings.py")) ?? "",
  );

  const forwarded = forwardedFields(endpoint);
  const snapshotted = snapshotFields(settings);

  const missingForward = REQUIRED_BY_PUBLIC_SITE.filter(
    (field) => !forwarded.has(field),
  );
  assert.deepEqual(
    missingForward,
    [],
    `the public endpoint does not forward: ${missingForward.join(", ")}\n` +
      "these settings are editable and snapshotted, so the site silently " +
      "ignores them",
  );

  // The two lists are written in two different files by two different commits.
  // Anything in one and not the other can never reach a visitor.
  const snapshottedOnly = [...snapshotted].filter((f) => !forwarded.has(f));
  assert.deepEqual(
    snapshottedOnly,
    [],
    `snapshotted but never forwarded: ${snapshottedOnly.join(", ")}`,
  );
});

test("the palette selector survives the round trip", async () => {
  const endpoint = stripComments(
    (await readCode("api/v1/endpoints/booking_public.py")) ?? "",
  );
  const theme = await readFile(
    path.join(here, "..", "src", "lib", "theme.ts"),
    "utf8",
  );

  assert.ok(
    forwardedFields(endpoint).has("landing_theme_id"),
    "landing_theme_id is not forwarded, so a salon's palette cannot apply",
  );

  // Both halves of the naming convention, because resolveTheme accepts either.
  assert.ok(
    /landing_theme_id/.test(theme),
    "the public site no longer reads landing_theme_id",
  );
});

test("list-valued settings are not routed through the working-hours helper", async () => {
  const endpoint = stripComments(
    (await readCode("api/v1/endpoints/booking_public.py")) ?? "",
  );

  // `public_payload` normalises working hours and always returns a dict.
  // Passing a list through it hands the client an object where it expects an
  // array, so the gallery and the stats render as nothing.
  for (const field of [
    "landing_portfolio",
    "landing_stats",
    "landing_features",
    "landing_trust_badges",
    "landing_testimonials",
  ]) {
    const line = endpoint
      .split("\n")
      .find((l) => l.includes(`"${field}"`));
    assert.ok(line, `${field} is not in the payload`);
    assert.ok(
      !line.includes("public_payload("),
      `${field} is a list but is shaped by the working-hours helper, ` +
        "which always returns a dict",
    );
  }
});