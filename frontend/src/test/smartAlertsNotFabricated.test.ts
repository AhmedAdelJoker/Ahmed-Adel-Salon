import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `/owner/alerts` renders five hardcoded alerts, unlabelled.
 *
 * They name real-looking things: a suspended employee who still has permissions,
 * an invoice edited after payment ("INV-9020"), a login at 3am from an
 * unrecognised device, three salary changes in a day. `useState(INITIAL_ALERTS)`
 * with no fetch, and no banner saying any of it is illustrative.
 *
 * On `/owner` the same class of problem was invented *figures*: 18,750 EGP shown
 * before the server replied. There it was mitigated by a banner -- which is
 * better than nothing and still wrong, because a fabricated number on a
 * dashboard is read as a number.
 *
 * Here it is worse than a fabricated figure. This page is about security, and
 * the first entry says an employee has live permissions while suspended. An
 * owner who reads that either chases a non-event or, worse, learns to dismiss
 * the page. A security surface that cries wolf is not a security surface.
 *
 * So the rule is not "label the demo data". The rule is that an alerts page
 * shows alerts this installation actually has, and says so when it has none.
 */
const SRC = join(__dirname, "..");

describe("the alerts page does not invent security findings", () => {
  const source = readFileSync(
    join(SRC, "pages/owner/SmartAlerts.tsx"),
    "utf8"
  );

  it("does not seed state with a literal list of alerts", () => {
    expect(source).not.toMatch(/useState\s*\(\s*INITIAL_ALERTS\s*\)/);
  });

  it("carries no fabricated alert text", () => {
    // The specific strings that made these read as findings rather than as
    // examples: a named employee, a real invoice number, a real hour.
    for (const fabrication of ["أحمد علي", "INV-9020", "3:00 صباحاً"]) {
      expect(
        source,
        `the page still contains the fabricated detail "${fabrication}"`
      ).not.toContain(fabrication);
    }
  });

  it("does not import the hardcoded list at all", () => {
    expect(source).not.toMatch(/INITIAL_ALERTS/);
  });
});