/**
 * The palette table and its derived values.
 *
 * ## The failure this prevents
 *
 * `complete()` derives `okLine`, `stopLine`, `mutedWash` and the two glass
 * values from the colours each palette states. That derivation is the only
 * reason the six palettes can be six short blocks of intentional colour instead
 * of six blocks of arithmetic — and arithmetic is exactly what silently rots:
 * a dark palette ends up with a light-mode border, or a glass that is 0.95
 * opaque on a light ground and turns every caption over a photograph into a
 * black box.
 *
 * These assertions are per-palette rather than per-field for the same reason:
 * the property that matters is "every palette has a *distinguishable* value
 * here", not "this particular hex is correct".
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BRAND_THEMES,
  DEFAULT_THEME_NAME,
  THEME_NAMES,
  THEME_PALETTES,
  isBrandThemeName,
  resolveTheme,
} from "../src/lib/theme.ts";

const rgbaChannels = (value) => {
  const match = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(value);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: Number(match[4]) };
};

test("every palette name resolves and every palette is complete", () => {
  for (const name of THEME_NAMES) {
    assert.ok(isBrandThemeName(name), `${name} should be a known theme name`);
    const palette = THEME_PALETTES[name];
    assert.ok(palette, `${name} should have a completed palette`);
    for (const field of ["okLine", "stopLine", "mutedWash", "glass", "glassStrong"]) {
      assert.equal(typeof palette[field], "string", `${name}.${field} should be a string`);
      assert.ok(palette[field].length > 0, `${name}.${field} should not be empty`);
    }
  }
});

test("the authored palettes carry no derived values", () => {
  // If these start appearing in BRAND_THEMES the derivation is being bypassed,
  // and whichever copy wins is the one nobody reads.
  for (const name of THEME_NAMES) {
    const authored = BRAND_THEMES[name];
    for (const field of ["okLine", "stopLine", "mutedWash", "glass", "glassStrong"]) {
      assert.equal(
        authored[field],
        undefined,
        `BRAND_THEMES.${name}.${field} should be derived, not authored`,
      );
    }
  }
});

test("glass panels are translucent over their own palette's ground", () => {
  // A glass panel carries light text in the design. If it were opaque it would
  // be a flat card, and if it were built from the *card* colour a light palette
  // would put a cream panel over a photograph.
  for (const name of THEME_NAMES) {
    const { bg, glass, glassStrong } = THEME_PALETTES[name];
    const glassRgba = rgbaChannels(glass);
    const strongRgba = rgbaChannels(glassStrong);
    const bgRgba = rgbaChannels(bg);
    const bgHex = /^#([0-9a-f]{6})$/i.exec(bg);

    if (glassRgba && bgRgba) {
      assert.deepEqual(
        [glassRgba.r, glassRgba.g, glassRgba.b],
        [bgRgba.r, bgRgba.g, bgRgba.b],
        `${name} glass should be tinted with its own bg`,
      );
    } else if (glassRgba && bgHex) {
      const body = bgHex[1];
      const channels = [
        parseInt(body.slice(0, 2), 16),
        parseInt(body.slice(2, 4), 16),
        parseInt(body.slice(4, 6), 16),
      ];
      assert.deepEqual(
        [glassRgba.r, glassRgba.g, glassRgba.b],
        channels,
        `${name} glass should be tinted with its own bg`,
      );
    }

    assert.ok(glassRgba.a < 1, `${name} glass must stay translucent`);
    assert.ok(glassRgba.a > 0.5, `${name} glass at ${glassRgba.a} is too see-through for text`);
    assert.ok(
      strongRgba.a >= glassRgba.a,
      `${name} glassStrong should be at least as opaque as glass`,
    );
  }
});

test("every palette's status lines are distinguishable from each other", () => {
  // `okLine` is used as the border of the "open now" pill. If it resolved to the
  // same colour for open and closed the two states would be indistinguishable at
  // a glance, which is the one thing the pill exists to communicate.
  for (const name of THEME_NAMES) {
    const palette = THEME_PALETTES[name];
    assert.notEqual(
      palette.okLine,
      palette.stopLine,
      `${name}: open and closed must not share a border colour`,
    );
  }
});

test("resolveTheme returns a complete palette, not an authored one", () => {
  const dark = resolveTheme({ landing_theme_id: "midnight" }, "dark");
  const light = resolveTheme({ landing_theme_id: "midnight" }, "light");

  assert.equal(dark.isDark, true);
  assert.equal(light.isDark, false);
  // Same brand, different ground: the accent identity is preserved.
  assert.equal(dark.brand, light.brand);
  assert.equal(dark.accent, THEME_PALETTES.midnight.accent);

  for (const palette of [dark, light]) {
    assert.equal(typeof palette.glass, "string");
    assert.equal(typeof palette.okLine, "string");
  }
});

test("an unknown theme id falls back to the default rather than throwing", () => {
  const fallback = resolveTheme({ landing_theme_id: "does-not-exist" });
  assert.equal(fallback.bg, THEME_PALETTES[DEFAULT_THEME_NAME].bg);
  assert.equal(fallback.accent, THEME_PALETTES[DEFAULT_THEME_NAME].accent);
});

test("all six palettes are registered", () => {
  // The admin panel offers exactly these. Dropping one silently resets any
  // salon that had selected it, because the id still resolves in the database
  // but not here.
  assert.deepEqual([...THEME_NAMES].sort(), [
    "clay",
    "gold",
    "graphite",
    "midnight",
    "moss",
    "silver",
  ]);
});