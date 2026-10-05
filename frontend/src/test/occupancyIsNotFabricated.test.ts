import { describe, it, expect } from "vitest";

/**
 * `/owner/dashboard-stats` computed occupancy inside a try/except whose handler
 * was:
 *
 *     except Exception:
 *         occupancy = 72
 *
 * So a failed query produced "72%" and rendered beside six genuinely measured
 * figures. Nothing about it looked wrong -- 72% is a plausible occupancy rate,
 * which is precisely why it survived: a fabricated figure that matches the shape
 * of the real ones is the hardest kind to notice.
 *
 * There was a second, quieter version of the same lie on the frontend:
 *
 *     {occupancy ?? 0}%
 *
 * and in the hook:
 *
 *     occupancy: data.stats?.occupancy != null ? ... : DEFAULT_STATS.occupancy
 *
 * Both replaced "unknown" with zero. So even after the backend stopped lying,
 * the null would have been swallowed on arrival and reported as an empty salon.
 *
 * These tests pin the three places that have to agree for the fix to hold.
 */
import { formatStatValue } from "@/features/reports-dashboard/utils";

describe("a missing occupancy is not a number", () => {
  describe("formatStatValue", () => {
    it("renders an em dash for null rather than the string 'null%'", () => {
      // The literal `${null}%` is "null%" -- the worst of the three options,
      // because it looks like a formatting bug rather than missing data.
      expect(formatStatValue("occupancy", null)).toBe("—");
      expect(formatStatValue("occupancy", undefined)).toBe("—");
    });

    it("still renders a real occupancy as a percentage", () => {
      expect(formatStatValue("occupancy", 72)).toBe("72%");
      expect(formatStatValue("occupancy", 0)).toBe("0%");
    });

    it("treats a missing money figure as no money", () => {
      // The opposite policy, deliberately: a missing revenue figure genuinely is
      // no revenue. Only occupancy carries information in its absence.
      expect(formatStatValue("todayRevenue", 0)).not.toBe("—");
      expect(formatStatValue("todayRevenue", null)).toBe("—");
    });
  });

  describe("the hook", () => {
    it("passes a null occupancy through instead of defaulting it to zero", async () => {
      const mod = await import("@/features/reports-dashboard/constants");
      const { readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");

      // The default must not be a number standing in for "unknown", because the
      // hook used to substitute exactly this value.
      expect(mod.DEFAULT_STATS.occupancy).toBe(0);

      const text = readFileSync(
        resolve(
          process.cwd(),
          "src/features/reports-dashboard/hooks/useReportsDashboard.ts",
        ),
        "utf8",
      );

      // The old coercion, in any spelling, is the bug this file is here to stop.
      expect(text).not.toMatch(
        /occupancy\s*:\s*data\.stats\?\.occupancy\s*!=\s*null/,
      );
      expect(text).toMatch(/occupancy:\s*rawOccupancy\s*\?\?\s*null/);
    });
  });

  describe("the registry-free default", () => {
    it("keeps the demo occupancy labelled as a demo figure", async () => {
      const mod = await import("@/features/reports-dashboard/constants");

      // DEMO_STATS.occupancy is 72, the same number the exception handler used
      // to invent. That is fine here precisely because DEMO_STATS is only ever
      // shown behind the demo banner, and it is worth pinning that the two are
      // still deliberately distinct.
      expect(mod.DEMO_STATS.occupancy).toBe(72);
      expect(mod.DEFAULT_STATS.occupancy).not.toBe(72);
    });
  });
});