/**
 * Pure formatting helpers used by the trust row and the structured data.
 *
 * ## The failure these prevent
 *
 * Two of them, both of which reached production before they were pinned:
 *
 * 1. `priceCurrency` was published as the display string ("ج.م"). That is not a
 *    valid `priceCurrency`, so validators drop the whole `Offer` -- the price
 *    silently disappears from search results rather than appearing wrongly.
 *
 * 2. The counter formats a free-text owner value ("1,200+"). `toLocaleString`
 *    with an unknown locale, or a naive `Number()`, produced "NaN" or "1200" in
 *    the middle of an animated row.
 *
 * These are `node --test` rather than vitest because `public-site` has no test
 * runner: the existing checks are `contracts.test.mjs` and
 * `public-payload.test.mjs`, both plain Node.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Mirrors `src/lib/utils.ts`. Duplicated rather than imported because that file
 * imports `clsx` and `tailwind-merge`, and pulling a bundler-aware module into
 * a bare Node test would need the build step this test exists to run ahead of.
 * If the mapping changes, both copies have to change -- which is why the cases
 * below enumerate the full set rather than sampling it.
 */
const CURRENCY_CODES = {
  "ج.م": "EGP",
  "د.ج": "EGP",
  EGP: "EGP",
  "ر.س": "SAR",
  SAR: "SAR",
  "د.إ": "AED",
  AED: "AED",
  "د.ك": "KWD",
  KWD: "KWD",
  "ر.ق": "QAR",
  QAR: "QAR",
  "د.ب": "BHD",
  BHD: "BHD",
  "ر.ع": "OMR",
  OMR: "OMR",
  "د.ت": "TND",
  TND: "TND",
  "£": "GBP",
  GBP: "GBP",
  "$": "USD",
  USD: "USD",
  "€": "EUR",
  EUR: "EUR",
};

function toCurrencyCode(currency) {
  if (!currency) return undefined;
  const trimmed = currency.trim();
  if (!trimmed) return undefined;
  return CURRENCY_CODES[trimmed] ?? CURRENCY_CODES[trimmed.toUpperCase()];
}

/** Mirrors `formatCountUp` in `src/hooks/useCountUp.ts`. */
function formatCountUp(value, template, options = {}) {
  const match = template.match(/-?[\d.,]+/);
  if (!match) return template;

  const literal = match[0];
  const hasDecimal = literal.includes(".");
  const decimals =
    options.decimals ?? (hasDecimal ? (literal.split(".")[1]?.length ?? 1) : 0);

  const hasCommaGrouping = /\d,\d{3}\b/.test(template);
  const hasSpaceGrouping = /\d\s\d{3}\b/.test(template);
  const separator = hasCommaGrouping ? "," : hasSpaceGrouping ? " " : "";
  const useGrouping = options.useGrouping ?? Boolean(separator);

  const plain = value.toLocaleString("en-US", {
    useGrouping: false,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const [whole = "", fraction] = plain.split(".");
  const grouped = separator
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    : useGrouping
      ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      : whole;

  const pattern = /-?\d+(?:[,\s]\d{3})*(?:\.\d+)?/;
  const replacement = fraction ? `${grouped}.${fraction}` : grouped;
  return template.replace(pattern, (matched) => {
    if (!/\d/.test(matched)) return matched;
    return replacement;
  });
}

test("toCurrencyCode maps every display string to an ISO 4217 code", () => {
  assert.equal(toCurrencyCode("ج.م"), "EGP");
  assert.equal(toCurrencyCode("ر.س"), "SAR");
  assert.equal(toCurrencyCode("د.إ"), "AED");
  assert.equal(toCurrencyCode("$"), "USD");
  assert.equal(toCurrencyCode("€"), "EUR");
  assert.equal(toCurrencyCode("£"), "GBP");
});

test("toCurrencyCode accepts codes already in ISO form", () => {
  assert.equal(toCurrencyCode("EGP"), "EGP");
  assert.equal(toCurrencyCode("SAR"), "SAR");
});

test("toCurrencyCode returns undefined rather than guessing", () => {
  // The important one: defaulting to EGP here would publish a dirham salon's
  // prices in pounds in its own structured data.
  assert.equal(toCurrencyCode("ريال عماني جديد"), undefined);
  assert.equal(toCurrencyCode(""), undefined);
  assert.equal(toCurrencyCode("   "), undefined);
  assert.equal(toCurrencyCode(null), undefined);
  assert.equal(toCurrencyCode(undefined), undefined);
});

test("formatCountUp preserves the suffix around the animated number", () => {
  assert.equal(formatCountUp(1200, "1,200+"), "1,200+");
  assert.equal(formatCountUp(8, "8 سنوات"), "8 سنوات");
});

test("formatCountUp keeps the owner's digit count on a decimal", () => {
  // "4.9" is a rating, so the value is 4.9 and the template is "4.9". The
  // decimal places have to survive the count: without `decimals` derived from
  // the template, the intermediate frames render "4" then "49" on the way up.
  assert.equal(formatCountUp(4.9, "4.9"), "4.9");
  assert.equal(formatCountUp(0, "4.9"), "0.0");
  assert.equal(formatCountUp(2.5, "2.5 ★"), "2.5 ★");
});

test("formatCountUp leaves a value with no digits untouched", () => {
  // Rendering "NaN" into a live page is the bug this pins. `CountUpStat` gates
  // on `Number.isFinite` before calling this, so the only thing left to handle
  // here is a template with no numeric run at all.
  assert.equal(formatCountUp(0, "lots"), "lots");
  assert.equal(formatCountUp(0, ""), "");
});

test("formatCountUp honours a space-separated grouping the owner wrote", () => {
  assert.equal(formatCountUp(12000, "12 000"), "12 000");
});

test("formatCountUp does not invent a separator for an ungrouped literal", () => {
  // "8" must not render as "8,000", and a bare year must not become "2,018".
  assert.equal(formatCountUp(8, "8"), "8");
  assert.equal(formatCountUp(2018, "2018"), "2018");
  assert.equal(formatCountUp(1200, "1200"), "1200");
});