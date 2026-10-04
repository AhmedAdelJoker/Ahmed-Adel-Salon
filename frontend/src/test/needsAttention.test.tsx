import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * `/owner` answered "how did we do" and `/owner/alerts` answered "what is
 * pending", but nothing on the dashboard answered "what do I have to deal with
 * today". The owner had to navigate to a second page to find out.
 *
 * `NeedsAttention` reads the same `/owner/alerts` aggregate the alerts page
 * renders, so the count here and the list there are one fact.
 *
 * The dangerous failure mode for this specific card is a request that fails and
 * renders as zero. That reads as "the salon is clean", which is exactly the
 * wrong conclusion on exactly the day it matters -- so most of these tests are
 * about keeping "unknown" distinguishable from "nothing".
 */
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { full_name: "Owner", role: "owner" } }),
}));

const mockGet = vi.fn();

vi.mock("@/services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: vi.fn(),
  },
}));

const payload = (
  alerts: unknown[],
  counts?: Record<string, number>,
) => ({
  data: {
    alerts,
    counts: counts ?? {
      total: alerts.length,
      high: alerts.filter((a: any) => a.priority === "high").length,
      medium: alerts.filter((a: any) => a.priority === "medium").length,
      low: alerts.filter((a: any) => a.priority === "low").length,
    },
    generated_at: "2026-10-04T10:00:00",
  },
});

const alert = (over: Record<string, unknown> = {}) => ({
  key: "a-1",
  source: "invoice_adjustment_requests",
  title: "طلب تعديل فاتورة",
  message: "INV-1042",
  priority: "high",
  occurred_at: "2026-10-04T09:00:00",
  destination: "/owner/adjustment-requests",
  ...over,
});

const importCard = async () => {
  const mod = await import(
    "@/features/reports-dashboard/components/NeedsAttention"
  );
  return mod.NeedsAttention;
};

let NeedsAttention: any;

describe("needs-attention card", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockGet.mockReset();
    NeedsAttention = await importCard();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderCard = () => render(<NeedsAttention onNavigate={vi.fn()} />);

  it("reads the alerts aggregate rather than its own endpoint", async () => {
    mockGet.mockResolvedValue(payload([]));

    renderCard();

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith("/owner/alerts", { params: { limit: 4 } }),
    );
  });

  it("shows the count and the items", async () => {
    mockGet.mockResolvedValue(
      payload([
        alert({ key: "a-1", title: "طلب تعديل فاتورة", message: "INV-1042" }),
        alert({ key: "a-2", title: "خصم بانتظار الموافقة", message: "INV-1043", priority: "medium" }),
      ]),
    );

    renderCard();

    await waitFor(() => expect(screen.getByText(/2 بنود بانتظارك/)).toBeTruthy());
    expect(screen.getByText("طلب تعديل فاتورة")).toBeTruthy();
    expect(screen.getByText("خصم بانتظار الموافقة")).toBeTruthy();
    expect(screen.getByText("حرجة")).toBeTruthy();
    expect(screen.getByText("مراجعة")).toBeTruthy();
  });

  it("uses the singular for exactly one item", async () => {
    // "1 بنود بانتظارك" is the kind of thing that makes a dashboard feel
    // machine-generated.
    mockGet.mockResolvedValue(payload([alert()]));

    renderCard();

    await waitFor(() => expect(screen.getByText(/بند واحد بانتظارك/)).toBeTruthy());
    expect(screen.queryByText(/1 بنود/)).toBeNull();
  });

  it("says so plainly when nothing is pending", async () => {
    mockGet.mockResolvedValue(payload([]));

    renderCard();

    await waitFor(() => expect(screen.getByText(/لا يوجد ما ينتظرك/)).toBeTruthy());
    // Not a cheerful "all good!" with no basis -- the specifics, so the reader
    // can tell it checked.
    expect(screen.getByText(/لا طلبات موافقة/)).toBeTruthy();
  });

  it("never renders zero when the request failed", async () => {
    mockGet.mockRejectedValue(new Error("boom"));

    renderCard();

    await waitFor(() => expect(screen.getByText(/تعذّر تحميل/)).toBeTruthy());
    // The distinction the whole card exists to preserve.
    expect(screen.getByText(/لم يتم تأكيد وجود أو عدم وجود/)).toBeTruthy();
    expect(screen.queryByText(/لا يوجد ما ينتظرك/)).toBeNull();
    expect(screen.queryByText(/0 بنود/)).toBeNull();
  });

  it("does not render a zero for an empty severity category", async () => {
    // A "0 حرجة" pill is noise that implies a category exists.
    mockGet.mockResolvedValue(payload([alert({ priority: "low" })]));

    renderCard();

    await waitFor(() => expect(screen.getByText(/بند واحد/)).toBeTruthy());
    expect(screen.queryByText("حرجة")).toBeNull();
    expect(screen.getByText("معلومة")).toBeTruthy();
  });

  it("offers the overflow only when there is more than it shows", async () => {
    mockGet.mockResolvedValue(
      payload([alert({ key: "a-1" })], { total: 9, high: 9, medium: 0, low: 0 }),
    );

    renderCard();

    await waitFor(() => expect(screen.getByText(/عرض 8 بنداً آخر/)).toBeTruthy());
  });

  it("hides the overflow link when everything fits", async () => {
    mockGet.mockResolvedValue(payload([alert({ key: "a-1" })]));

    renderCard();

    await waitFor(() => expect(screen.getByText("طلب تعديل فاتورة")).toBeTruthy());
    expect(screen.queryByText(/بنداً آخر/)).toBeNull();
  });

  it("sends the owner to the destination the backend named", async () => {
    const onNavigate = vi.fn();
    mockGet.mockResolvedValue(
      payload([alert({ destination: "/inventory" })]),
    );

    render(<NeedsAttention onNavigate={onNavigate} />);

    const button = await screen.findByText("طلب تعديل فاتورة");
    button.closest("button")?.click();

    expect(onNavigate).toHaveBeenCalledWith("/inventory");
  });
});