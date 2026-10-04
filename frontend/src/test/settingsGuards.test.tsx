import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import Settings from "@/pages/owner/Settings";

const mockNavigate = vi.fn();
let confirmSpy: ReturnType<typeof vi.spyOn>;

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { role: "OWNER", is_active: true },
    loading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/api", () => {
  const api = {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  };
  return { default: api, api, staticURL: "http://localhost:8000" };
});

vi.mock("@/services/apiAdapter", () => ({
  adaptObject: (res: unknown, fallback: unknown) => res ?? fallback,
}));

vi.mock("@/services/businessSettingsService", () => ({
  businessSettingsService: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  Toaster: () => null,
}));

vi.mock("@/pages/owner/ServicesManagement", () => ({ default: () => <div>services</div> }));
vi.mock("@/pages/owner/SecurityAccess", () => ({ default: () => <div>security</div> }));
vi.mock("@/pages/owner/UsersPanel", () => ({ default: () => <div>users</div> }));
vi.mock("@/pages/owner/BusinessSettingsPage", () => ({ default: () => <div>website</div> }));
vi.mock("@/pages/owner/LoyaltySettingsPanel", () => ({ default: () => <div>loyalty</div> }));
vi.mock("@/pages/owner/WorkingHoursPanel", () => ({
  default: ({ onDirtyChange }: { onDirtyChange?: (d: boolean) => void }) => (
    <div>
      <span>hours-panel</span>
      <button type="button" onClick={() => onDirtyChange?.(true)}>
        make-dirty
      </button>
    </div>
  ),
}));

const api = (await import("@/services/api")).default as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};
const service = (
  (await import("@/services/businessSettingsService")) as unknown as {
    businessSettingsService: {
      get: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  }
).businessSettingsService;

const shopPayload = {
  salonName: "صالون الأناقة",
  shopPhone: "01000000000",
  address: "القاهرة",
  currency: "EGP",
  version: 4,
  publicSiteStale: false,
};

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="search">{location.search}</span>;
};

const renderSettings = (entry = "/owner/settings?tab=shop") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Settings />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(shopPayload);
  api.put.mockResolvedValue(shopPayload);
  api.post.mockResolvedValue(shopPayload);
  service.get.mockResolvedValue({ working_hours: {} });
  service.update.mockResolvedValue({ working_hours: {} });
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("Settings tab accessibility", () => {
  it("exposes a tablist with the active tab selected", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("tablist", { name: "أقسام الإعدادات" })).toBeInTheDocument();
    });
    const shop = await screen.findByRole("tab", { name: /بيانات المنشأة/ });
    expect(shop).toHaveAttribute("aria-selected", "true");
  });

  it("wires aria-controls to the tabpanel", async () => {
    renderSettings();
    const shop = await screen.findByRole("tab", { name: /بيانات المنشأة/ });
    const controls = shop.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    const panel = document.getElementById(controls as string);
    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", shop.id);
  });

  it("keeps unselected tabs out of the tab order", async () => {
    renderSettings();
    const shop = await screen.findByRole("tab", { name: /بيانات المنشأة/ });
    const hours = screen.getByRole("tab", { name: /ساعات العمل/ });
    expect(shop).toHaveAttribute("tabindex", "0");
    expect(hours).toHaveAttribute("tabindex", "-1");
  });

  it("moves to the next tab with ArrowDown and switches the panel", async () => {
    renderSettings();
    const shop = await screen.findByRole("tab", { name: /بيانات المنشأة/ });
    shop.focus();

    fireEvent.keyDown(shop, { key: "ArrowDown" });

    await waitFor(() => {
      expect(screen.getByTestId("search")).toHaveTextContent("tab=hours");
    });
  });

  it("jumps to the first tab with Home", async () => {
    renderSettings("/owner/settings?tab=loyalty");
    const loyalty = await screen.findByRole("tab", { name: /نظام الولاء/ });
    fireEvent.keyDown(loyalty, { key: "Home" });
    await waitFor(() => {
      expect(screen.getByTestId("search")).toHaveTextContent("tab=shop");
    });
  });

  it("wraps around with ArrowUp from the first tab", async () => {
    renderSettings();
    const shop = await screen.findByRole("tab", { name: /بيانات المنشأة/ });
    fireEvent.keyDown(shop, { key: "ArrowUp" });
    await waitFor(() => {
      expect(screen.getByTestId("search")).toHaveTextContent("tab=security");
    });
  });
});

describe("Settings unsaved-changes guard", () => {
  it("opens a confirm dialog when leaving a dirty tab", async () => {
    renderSettings("/owner/settings?tab=hours");
    await screen.findByText("hours-panel");

    fireEvent.click(screen.getByRole("button", { name: "make-dirty" }));
    fireEvent.click(screen.getByRole("tab", { name: /بيانات المنشأة/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("لديك تغييرات غير محفوظة")).toBeInTheDocument();
    expect(within(dialog).getByText(/ساعات العمل/)).toBeInTheDocument();
  });

  it("stays on the current tab when the dialog is cancelled", async () => {
    renderSettings("/owner/settings?tab=hours");
    await screen.findByText("hours-panel");
    fireEvent.click(screen.getByRole("button", { name: "make-dirty" }));

    fireEvent.click(screen.getByRole("tab", { name: /بيانات المنشأة/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "العودة والإكمال" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByTestId("search")).toHaveTextContent("tab=hours");
  });

  it("navigates when the dialog is confirmed", async () => {
    renderSettings("/owner/settings?tab=hours");
    await screen.findByText("hours-panel");
    fireEvent.click(screen.getByRole("button", { name: "make-dirty" }));

    fireEvent.click(screen.getByRole("tab", { name: /بيانات المنشأة/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "متابعة بدون حفظ" }));

    await waitFor(() => {
      expect(screen.getByTestId("search")).toHaveTextContent("tab=shop");
    });
  });

  it("switches freely when nothing is dirty", async () => {
    renderSettings("/owner/settings?tab=hours");
    await screen.findByText("hours-panel");

    fireEvent.click(screen.getByRole("tab", { name: /بيانات المنشأة/ }));

    await waitFor(() => {
      expect(screen.getByTestId("search")).toHaveTextContent("tab=shop");
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Settings browser-back guard", () => {
  it("asks before letting history navigation discard changes", async () => {
    renderSettings("/owner/settings?tab=hours");
    await screen.findByText("hours-panel");
    fireEvent.click(screen.getByRole("button", { name: "make-dirty" }));

    confirmSpy.mockReturnValue(false);
    fireEvent(
      window,
      new PopStateEvent("popstate", {
        state: {},
        // the browser already moved the URL to ?tab=shop
      }),
    );
    window.history.replaceState(null, "", "/owner/settings?tab=shop");

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/ساعات العمل/);
  });

  it("follows the navigation when the user accepts the loss", async () => {
    renderSettings("/owner/settings?tab=hours");
    await screen.findByText("hours-panel");
    fireEvent.click(screen.getByRole("button", { name: "make-dirty" }));

    confirmSpy.mockReturnValue(true);
    fireEvent(window, new PopStateEvent("popstate", { state: {} }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
  });
});

describe("Settings concurrency and publish state", () => {
  it("sends the version it read so a lost update is rejected", async () => {
    renderSettings();
    const input = await screen.findByLabelText(/المسمى التجاري الرسمي/);
    fireEvent.change(input, { target: { value: "اسم جديد" } });

    fireEvent.click(screen.getAllByRole("button", { name: "حفظ" })[0]);

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const payload = api.put.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.expectedVersion).toBe(4);
  });

  it("shows a conflict banner and a refetch action on 409", async () => {
    api.put.mockRejectedValue({
      response: { status: 409, data: { detail: "تم تعديل الإعدادات من مستخدم آخر" } },
    });
    renderSettings();
    const input = await screen.findByLabelText(/المسمى التجاري الرسمي/);
    fireEvent.change(input, { target: { value: "اسم جديد" } });
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ" })[0]);

    expect(await screen.findByText("تم تعديل الإعدادات من مستخدم آخر")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /جلب أحدث نسخة/ }).length).toBeGreaterThan(0);
  });

  it("lists every server validation error", async () => {
    api.put.mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: [
            { loc: ["body", "shop_phone"], msg: "String too long", type: "x" },
            { loc: ["body", "address"], msg: "String too long", type: "x" },
          ],
        },
      },
    });
    renderSettings();
    const input = await screen.findByLabelText(/المسمى التجاري الرسمي/);
    fireEvent.change(input, { target: { value: "اسم جديد" } });
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ" })[0]);

    expect(await screen.findByText(/2 أخطاء من الخادم/)).toBeInTheDocument();
    // both entries survive even though the message is identical — the field differs
    expect(screen.getAllByText("القيمة طويلة جداً")).toHaveLength(2);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items.some((t) => t?.includes("رقم التواصل"))).toBe(true);
    expect(items.some((t) => t?.includes("العنوان"))).toBe(true);
  });

  it("does not offer publish when the snapshot is current", async () => {
    renderSettings();
    await screen.findByLabelText(/المسمى التجاري الرسمي/);
    expect(screen.queryByRole("button", { name: /انشر الآن/ })).toBeNull();
  });

  it("warns and republishes when the public site is stale", async () => {
    api.get.mockResolvedValue({ ...shopPayload, publicSiteStale: true });
    renderSettings();
    await screen.findByLabelText(/المسمى التجاري الرسمي/);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/الموقع العام لازم ينشر تاني/);

    fireEvent.click(within(banner).getByRole("button", { name: /انشر الآن/ }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/business-settings/publish-site");
    });
  });
});

describe("Settings lazy loading", () => {
  it("does not fetch shop data when the hours tab is opened directly", async () => {
    renderSettings("/owner/settings?tab=hours");
    await screen.findByText("hours-panel");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("fetches shop data once the shop tab is opened", async () => {
    renderSettings("/owner/settings?tab=hours");
    await screen.findByText("hours-panel");
    fireEvent.click(screen.getByRole("tab", { name: /بيانات المنشأة/ }));

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  });
});
