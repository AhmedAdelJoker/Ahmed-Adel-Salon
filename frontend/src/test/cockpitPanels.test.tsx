import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

// Imported once, statically.
//
// The first version of this file did `await import("@/features/reports-dashboard")`
// inside `beforeEach`, so every one of the eighteen tests re-imported the whole
// feature barrel -- recharts, every sibling component, and their modules. Alone
// that is a few hundred milliseconds; under the full suite with twenty-six files
// competing it crossed vitest's 10s hook timeout and failed roughly one run in
// three, in a test that had nothing to do with timing.
//
// `vi.mock` is hoisted above this import, so the api mock still applies.
import {
  DayStatusBar,
  Delta,
  RankingTable,
  RevenueSparkline,
  useOperatingSummary,
} from "@/features/reports-dashboard";

/**
 * The rebuilt cockpit adds three panels. Each one is a place where a number can
 * be missing, so each has the same three states to get right:
 *
 *   loaded    -- show the figure
 *   empty     -- the server answered, and there is genuinely nothing
 *   unavailable -- the server could not answer
 *
 * The failure this guards against is the one the alerts page already had: an
 * empty table that reads as "nobody sold anything" when the truth is "we could
 * not check". A missing ranking is not a zero ranking.
 */
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { full_name: "Owner", role: "OWNER" } }),
}));

const mockGet = vi.fn();

vi.mock("@/services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: vi.fn(),
  },
}));

describe("cockpit panels", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  describe("RankingTable", () => {
    const row = (name: string, revenue: number, count = 1) => ({
      name,
      revenue,
      count,
      countLabel: "فاتورة",
    });

    it("distinguishes an empty ranking from an unavailable one", () => {
      // Container-scoped rather than `screen`, which searches the whole
      // document. This test renders twice in one body, and under parallel load
      // the global query intermittently matched markup that was not this
      // component's -- a flake that only appeared in the full suite, never when
      // the file ran alone.
      const empty = render(
        <RankingTable title="الأعلى" rows={[]} unavailable={false} />,
      );
      expect(within(empty.container).getByText(/لا توجد بيانات/)).toBeTruthy();
      empty.unmount();

      const failed = render(
        <RankingTable title="الأعلى" rows={null} unavailable />,
      );
      // Not the same sentence. One says "checked, nothing there", the other
      // says "could not check".
      expect(within(failed.container).getByText(/تعذّر تحميل/)).toBeTruthy();
      expect(within(failed.container).queryByText(/لا توجد بيانات/)).toBeNull();
    });

    it("names every row and scales bars against the leader", () => {
      const { container } = render(
        <RankingTable
          title="الأعلى"
          rows={[row("سالم", 1000, 5), row("هدى", 250, 2)]}
          unavailable={false}
        />,
      );

      expect(screen.getByText("سالم")).toBeTruthy();
      expect(screen.getByText("هدى")).toBeTruthy();

      const bars = container.querySelectorAll("span[style*='width']");
      expect(bars.length).toBe(2);
      // The leader fills, the second is a quarter. Bars normalised to the top
      // row rather than to the total, so the ranking is actually comparable.
      expect((bars[0] as HTMLElement).style.width).toBe("100%");
      expect((bars[1] as HTMLElement).style.width).toBe("25%");
    });

    it("gives a zero-revenue row no bar", () => {
      const { container } = render(
        <RankingTable
          title="الأعلى"
          rows={[row("سالم", 1000), row("صفر", 0)]}
          unavailable={false}
        />,
      );

      const bars = container.querySelectorAll("span[style*='width']");
      expect((bars[1] as HTMLElement).style.width).toBe("0%");
    });

    it("uses a table so the ranking is readable by assistive tech", () => {
      render(<RankingTable title="الأعلى إيراداً" rows={[row("سالم", 1000)]} />);

      expect(screen.getByRole("table")).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "الإيراد" })).toBeTruthy();
    });
  });

  describe("Delta", () => {
    it("says there is no comparison rather than inventing one", () => {
      // The single most misleading thing a delta can do: report +100% against a
      // baseline that was never measured.
      render(<Delta value={null} />);
      expect(screen.getByText("لا مقارنة")).toBeTruthy();
    });

    it("renders a real delta with its direction", () => {
      const up = render(<Delta value={12.4} />);
      expect(screen.getByText("+12%")).toBeTruthy();
      up.unmount();

      render(<Delta value={-8} />);
      expect(screen.getByText(/-8%/)).toBeTruthy();
    });

    it("calls a zero change flat rather than positive", () => {
      render(<Delta value={0} />);
      expect(screen.getByText("ثابت")).toBeTruthy();
    });
  });

  describe("RevenueSparkline", () => {
    const series = (values: number[]) =>
      values.map((revenue, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
        revenue,
        is_today: i === values.length - 1,
      }));

    it("says so when the series is unavailable", () => {
      render(<RevenueSparkline data={[]} baseline={null} unavailable />);
      expect(screen.getByText(/لا يتوفر رسم بياني/)).toBeTruthy();
    });

    it("draws an honest flat line for a window with no revenue", () => {
      const { container } = render(
        <RevenueSparkline data={series([0, 0, 0])} baseline={0} />,
      );

      const polyline = container.querySelector("polyline");
      const points = polyline?.getAttribute("points") ?? "";

      // Every y identical. Not a decorative wave implying movement.
      const ys = points.split(" ").map((p) => p.split(",")[1]);
      expect(new Set(ys).size).toBe(1);
      expect(screen.getByText("لا يوجد متوسط سابق")).toBeTruthy();
    });

    it("describes itself for screen readers", () => {
      const { container } = render(
        <RevenueSparkline data={series([100, 200, 300])} baseline={150} />,
      );

      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("role")).toBe("img");
      // The label reports the window it was actually given, not the default it
      // was configured with.
      expect(svg?.getAttribute("aria-label")).toContain("3");
      expect(svg?.getAttribute("aria-label")).toContain("300");
    });

    it("says plainly when the window holds no revenue at all", () => {
      const { container } = render(
        <RevenueSparkline data={series([0, 0, 0])} baseline={0} />,
      );

      // The accessible description has to carry the same message as the shape:
      // a flat line at the floor, not a small trend.
      expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain(
        "لا يوجد إيراد",
      );
    });

    it("omits the baseline line when there is no baseline", () => {
      const { container } = render(
        <RevenueSparkline data={series([100, 200])} baseline={null} />,
      );

      expect(container.querySelectorAll("line")).toHaveLength(0);
    });
  });

  describe("DayStatusBar", () => {
    it("reports a closed salon", () => {
      render(
        <DayStatusBar
          status={{
            now: "2026-10-04T22:00:00",
            is_open: false,
            open_shift: null,
            last_closed_at: "2026-10-04T20:00:00",
            last_closing_cash: 1500,
          }}
        />,
      );

      expect(screen.getByText("مغلق")).toBeTruthy();
      expect(screen.getByText(/آخر إغلاق/)).toBeTruthy();
    });

    it("flags an overdue shift instead of calling it merely open", () => {
      render(
        <DayStatusBar
          status={{
            now: "2026-10-04T22:00:00",
            is_open: true,
            open_shift: {
              id: 1,
              user_id: 2,
              opening_cash: 500,
              opened_at: "2026-10-03T20:00:00",
              hours_open: 26,
              overdue: true,
            },
            last_closed_at: null,
            last_closing_cash: null,
          }}
        />,
      );

      expect(screen.getByText("وردية متأخرة")).toBeTruthy();
      expect(screen.getByText("لم تُغلق بعد")).toBeTruthy();
    });

    it("says it could not determine the shift state", () => {
      render(<DayStatusBar status={null} unavailable />);
      expect(screen.getByText(/تعذّر تحديد حالة الوردية/)).toBeTruthy();
    });
  });

  describe("useOperatingSummary", () => {
    it("marks each section separately when one fails", async () => {
      mockGet.mockResolvedValue({
        data: {
          // The server answered, but could not build the staff ranking.
          daily: [{ date: "2026-10-04", revenue: 10, appointments: 1, is_today: true }],
          previous_window_average: 5,
          top_barbers: null,
          top_services: [],
          day_status: null,
          generated_at: "2026-10-04T22:00:00",
        },
      });

      const seen: any[] = [];
      function Probe() {
        const state = useOperatingSummary(14);
        seen.push(state.failures);
        return null;
      }

      render(<Probe />);

      await waitFor(() => expect(seen.length).toBeGreaterThan(0));
      await waitFor(() =>
        expect(seen[seen.length - 1]).toEqual({
          daily: false,
          barbers: true,
          services: false,
          status: true,
        }),
      );
    });

    it("reports every section unavailable when the request fails", async () => {
      mockGet.mockRejectedValue(new Error("offline"));

      const seen: any[] = [];
      function Probe() {
        const state = useOperatingSummary(14);
        seen.push(state.failures);
        return null;
      }

      render(<Probe />);

      await waitFor(() =>
        expect(seen[seen.length - 1]).toEqual({
          daily: true,
          barbers: true,
          services: true,
          status: true,
        }),
      );
    });

    it("asks for the window it was given", async () => {
      mockGet.mockResolvedValue({ data: { daily: [] } });

      function Probe() {
        useOperatingSummary(21);
        return null;
      }
      render(<Probe />);

      await waitFor(() =>
        expect(mockGet).toHaveBeenCalledWith("/owner/operating-summary", {
          params: { days: 21 },
        }),
      );
    });
  });
});