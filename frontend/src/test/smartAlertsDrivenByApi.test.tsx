import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * `/owner/alerts` rendered five hardcoded findings from a `useState` literal:
 *
 *     const [alerts, setAlerts] = useState(INITIAL_ALERTS);
 *
 * A suspended employee with live permissions, an invoice edited after payment, a
 * 3am login from an unrecognised device. No request was ever made, and nothing
 * on the page said any of it was illustrative.
 *
 * The page also asserted three things that were not measurements:
 *   - "حالة النظام: آمن ومستقر" -- a security verdict, hardcoded.
 *   - "الذكاء الاصطناعي يراجع العمليات المالية... لحظياً" -- there is no AI.
 *   - a "تجاهل" button that filtered local state, so acknowledging an alert was
 *     forgotten on refresh.
 *
 * The source-scanning test next to this one proves the strings are gone. This
 * one proves the page is driven by the response: real findings appear, a
 * genuinely empty response says so, and a failed request is not allowed to look
 * like an empty one.
 */
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { full_name: "Owner", role: "owner" } }),
}));

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock("@/services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

const payload = (alerts: unknown[]) => ({
  data: {
    alerts,
    counts: {
      total: alerts.length,
      high: alerts.filter((a: any) => a.priority === "high").length,
      medium: alerts.filter((a: any) => a.priority === "medium").length,
      low: alerts.filter((a: any) => a.priority === "low").length,
    },
    generated_at: "2026-10-04T10:00:00",
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SmartAlerts />
    </MemoryRouter>,
  );

const importPage = async () => {
  const mod = await import("@/pages/owner/SmartAlerts");
  return mod.default;
};

let SmartAlerts: any;

describe("owner alerts page is driven by the API", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockGet.mockReset();
    mockPatch.mockReset();
    SmartAlerts = await importPage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks the backend for the alerts", async () => {
    mockGet.mockResolvedValue(payload([]));

    renderPage();

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/owner/alerts"));
  });

  it("renders the findings the API returned", async () => {
    mockGet.mockResolvedValue(
      payload([
        {
          key: "adjustment-7",
          source: "invoice_adjustment_requests",
          title: "طلب تعديل فاتورة بانتظار الموافقة",
          message: "طلب discount على الفاتورة INV-1042",
          priority: "high",
          occurred_at: "2026-10-04T09:00:00",
          destination: "/owner/adjustment-requests",
        },
        {
          key: "low-stock-3",
          source: "products",
          title: "مخزون تحت الحد الأدنى",
          message: "المنتج «شامبو» بقي 1 وحد التنبيه 5",
          priority: "medium",
          occurred_at: null,
          destination: "/inventory",
        },
      ]),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/طلب تعديل فاتورة بانتظار الموافقة/)).toBeTruthy(),
    );
    expect(screen.getByText(/INV-1042/)).toBeTruthy();
    expect(screen.getByText(/مخزون تحت الحد الأدنى/)).toBeTruthy();
  });

  it("shows an empty state when the response is genuinely empty", async () => {
    mockGet.mockResolvedValue(payload([]));

    renderPage();

    await waitFor(() => expect(screen.getByText(/لا يوجد ما ينتظرك/)).toBeTruthy());
    // "Nothing pending" and "we could not ask" must not read the same.
    expect(screen.queryByText(/تعذّر تحميل التنبيهات/)).toBeNull();
  });

  it("reports a failed request instead of showing an empty alerts page", async () => {
    // The dangerous version of this feature is a request that fails and renders
    // as zero findings: the owner concludes the salon is clean.
    mockGet.mockRejectedValue(new Error("network down"));

    renderPage();

    await waitFor(() => expect(screen.getByText(/تعذّر تحميل التنبيهات/)).toBeTruthy());
    expect(screen.getByText(/ليست حالة/)).toBeTruthy();
    // No reassuring empty state alongside an error.
    expect(screen.queryByText(/لا يوجد ما ينتظرك/)).toBeNull();
  });

  it("does not offer dismissal for a pending request", async () => {
    // A pending approval is resolved by approving it. A dismiss button here
    // would be a way to make the count go down without doing anything.
    mockGet.mockResolvedValue(
      payload([
        {
          key: "adjustment-7",
          source: "invoice_adjustment_requests",
          title: "طلب تعديل فاتورة",
          message: "م",
          priority: "high",
          occurred_at: "2026-10-04T09:00:00",
          destination: "/owner/adjustment-requests",
        },
      ]),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText(/طلب تعديل فاتورة/)).toBeTruthy());
    expect(screen.queryByText(/تعليم كمقروء/)).toBeNull();
  });

  it("marks a notification read through the API rather than hiding it locally", async () => {
    mockGet.mockResolvedValue(
      payload([
        {
          key: "notification-42",
          source: "notifications",
          title: "طلب بانتظارك",
          message: "راجع الطلب",
          priority: "low",
          occurred_at: "2026-10-04T09:00:00",
          destination: "/notifications",
        },
      ]),
    );
    mockPatch.mockResolvedValue({ data: {} });

    renderPage();

    const button = await screen.findByText(/تعليم كمقروء/);
    button.click();

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith("/notifications/42/read"),
    );
    await waitFor(() => expect(screen.queryByText(/طلب بانتظارك/)).toBeNull());
  });

  it("makes no security verdict and claims no AI", async () => {
    mockGet.mockResolvedValue(payload([]));

    const { container } = renderPage();

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const text = container.textContent ?? "";
    expect(text).not.toContain("الذكاء الاصطناعي");
    expect(text).not.toContain("آمن ومستقر");
  });

  it("filters to high severity only when asked", async () => {
    mockGet.mockResolvedValue(
      payload([
        {
          key: "a",
          source: "products",
          title: "طلب urgent",
          message: "م",
          priority: "high",
          occurred_at: "2026-10-04T09:00:00",
          destination: "/inventory",
        },
        {
          key: "b",
          source: "notifications",
          title: "إشعار عادي",
          message: "م",
          priority: "low",
          occurred_at: "2026-10-04T09:00:00",
          destination: "/notifications",
        },
      ]),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText("طلب urgent")).toBeTruthy());
    expect(screen.getByText("إشعار عادي")).toBeTruthy();

    screen.getByText(/الحرجة فقط/).click();

    await waitFor(() => expect(screen.queryByText("إشعار عادي")).toBeNull());
    expect(screen.getByText("طلب urgent")).toBeTruthy();
  });
});