import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * The dashboard used to render `DEMO_STATS` -- 18,750 EGP of revenue, 72%
 * occupancy -- while the request was still in flight.
 *
 * `useReportsDashboard` initialises:
 *
 *     const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
 *     ...
 *     export const DEFAULT_STATS: DashboardStats = { ...DEMO_STATS };
 *
 * so `loading === true` and `stats.todayRevenue === 18750` are true at the same
 * time, and `KpiStats` renders them unconditionally. An owner opening /owner
 * sees a day's revenue that was invented before the server answered, and a slow
 * connection makes the lie last longer.
 *
 * The demo banner is honest, but it renders only on `isDemo && !loading` -- so
 * it cannot cover this window. Fabricated numbers must never be on screen
 * without the label that says they are fabricated.
 */
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { full_name: "Owner", role: "owner" } }),
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("owner dashboard never shows invented figures unlabelled", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("DEFAULT_STATS is not the demo figures", async () => {
    const mod = await import("@/features/reports-dashboard/constants");
    // The default has to be zeros, not a copy of the demo. A default that
    // happens to equal the demo is indistinguishable from real data.
    for (const [key, value] of Object.entries(mod.DEFAULT_STATS)) {
      expect(value, `${key} defaults to a non-zero figure`).toBe(0);
    }
  });

  it("during loading the KPI numbers are not populated", async () => {
    let resolve: (v: unknown) => void = () => {};
    const pending = new Promise((r) => {
      resolve = r;
    });

    vi.doMock("@/services/api", () => ({
      default: { get: () => pending },
    }));

    const { useReportsDashboard: useHook } = await import(
      "@/features/reports-dashboard/hooks/useReportsDashboard"
    );

    function Probe() {
      const { stats, loading, isDemo } = useHook();
      return (
        <div>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="demo">{String(isDemo)}</span>
          <span data-testid="revenue">{stats.todayRevenue}</span>
        </div>
      );
    }

    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    );

    await flush();
    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(Number(screen.getByTestId("revenue").textContent)).toBe(0);

    resolve({ data: { stats: { todayRevenue: 100 } } });
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
  });
});