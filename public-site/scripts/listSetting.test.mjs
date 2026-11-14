/**
 * `listSetting`: read a settings value under either spelling.
 *
 * The admin panel writes camelCase; `booking-catalog` forwards snake_cased.
 * Reading only camelCase is why owners saw their stats/features/testimonials
 * vanish from the public page.
 */

import assert from "node:assert";
import { test } from "node:test";
import { listSetting } from "../src/lib/listSetting.ts";

test("reads a list under its camelCase spelling", () => {
  const settings = { landingFeatures: [{ title: "A", description: "B" }] };
  assert.deepEqual(listSetting(settings, "landingFeatures"), [
    { title: "A", description: "B" },
  ]);
});

test("reads a list under its snake_case spelling", () => {
  const settings = { landing_features: [{ title: "A", description: "B" }] };
  assert.deepEqual(listSetting(settings, "landingFeatures"), [
    { title: "A", description: "B" },
  ]);
});

test("camelCase wins when both are present", () => {
  const settings = {
    landingFeatures: [{ title: "Camel", description: "X" }],
    landing_features: [{ title: "Snake", description: "Y" }],
  };
  assert.deepEqual(listSetting(settings, "landingFeatures"), [
    { title: "Camel", description: "X" },
  ]);
});

test("undefined when neither spelling holds a list", () => {
  const settings = { landing_features: "not a list" };
  assert.equal(listSetting(settings, "landingFeatures"), undefined);
});

test("returns [] when empty array", () => {
  assert.deepEqual(listSetting({ landingStats: [] }, "landingStats"), []);
});

test("a plain string value is not treated as a list", () => {
  assert.equal(listSetting({ landingFeatures: "nope" }, "landingFeatures"), undefined);
});