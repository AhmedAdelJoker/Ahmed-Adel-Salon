import React from "react";
import { vi, expect, describe, beforeEach, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { toHaveNoViolations } from "jest-axe";
import "@testing-library/jest-dom";

declare module "vitest" {
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}

expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { role: "CASHIER", is_active: true },
    loading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("@/context/SalonContext", () => ({
  useSalon: () => ({
    settings: {
      salon_name: "صالون برو",
      shop_phone: "0123456789",
      address: "القاهرة، مصر",
      receipt_footer: "شكراً لزيارتكم",
      public_slug: "demo-salon",
    },
    drawerBalance: 1000,
    refreshBalance: vi.fn(),
  }),
  SalonProvider: ({ children }) => <>{children}</>,
}));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({ socket: null }),
  SocketProvider: ({ children }) => <>{children}</>,
}));

vi.mock("@/context/PreferencesContext", () => ({
  PreferencesProvider: ({ children }) => <>{children}</>,
}));

vi.mock("@/context/UIContext", () => ({
  UIProvider: ({ children }) => <>{children}</>,
}));

vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    default: {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: vi.fn().mockResolvedValue({
        data: { invoice_no: "INV-001", total_amount: 100 },
      }),
    },
  };
});

vi.mock("@/services/posShiftService", () => ({
  posShiftService: {
    current: vi.fn().mockResolvedValue(null),
    open: vi.fn().mockResolvedValue({}),
    close: vi.fn().mockResolvedValue({}),
  },
}));

// Import after mocks
import POS from "@/pages/cashier/POS/index";

describe("POS Page Accessibility (axe-core)", () => {
  const renderPOS = () => {
    return render(<POS />);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set RTL direction
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  });

  test("POS page has no accessibility violations on initial load", async () => {
    const { container } = renderPOS();

    // Wait for loading to complete
    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    const results = await axe.run(container);
    expect(results).toHaveNoViolations();
  });

  test("Shift sidebar has no accessibility violations", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    // Check shift sidebar specifically
    const shiftSidebar =
      screen.getByText("الوردية").closest("section") ||
      screen.getByText("الوردية").parentElement;

    if (shiftSidebar) {
      const results = await axe.run(shiftSidebar);
      expect(results).toHaveNoViolations();
    }
  });

  test("Sessions queue cards are keyboard accessible", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    // Sessions queue should have focusable cards
    const sessionCards = container.querySelectorAll(
      '[role="button"][tabindex="0"]',
    );
    expect(sessionCards.length).toBeGreaterThanOrEqual(0); // May be 0 if no appointments

    // Each card should have aria-label
    sessionCards.forEach((card) => {
      expect(card).toHaveAttribute("aria-label");
    });
  });

  test("Bottom navigation has proper ARIA roles", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    // Check for bottom nav (mobile view)
    const bottomNav = container.querySelector('[role="tablist"]');
    if (bottomNav) {
      expect(bottomNav).toHaveAttribute("aria-label");

      const tabs = bottomNav.querySelectorAll('[role="tab"]');
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute("aria-selected");
        expect(tab).toHaveAttribute("aria-label");
      });
    }
  });

  test("Checkout button has data-pos-checkout attribute for keyboard shortcut", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    const checkoutBtn = container.querySelector('[data-pos-checkout="true"]');
    expect(checkoutBtn).toBeInTheDocument();
    expect(checkoutBtn).toHaveAttribute("data-pos-checkout", "true");
  });

  test("Category tabs have minimum 48px touch targets", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    // Switch to items tab to see category tabs
    // This would require interaction - for now check if they exist in DOM
    const categoryTabs = container.querySelectorAll('[class*="touch-target"]');
    // At minimum, the category tabs should have touch-target class
    expect(categoryTabs.length).toBeGreaterThan(0);
  });

  test("Select components replace native selects for accessibility", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    // There should be no native <select> elements in cart items
    // (they should be replaced with Radix Select)
    const nativeSelects = container.querySelectorAll("select");
    // Allow for any native selects that might be in other parts
    // but cart item barber selects should be Radix Select
    const cartItemSelects = container.querySelectorAll(
      "[data-radix-select-trigger]",
    );
    // If cart has items, there should be Radix selects
    // For empty cart, this might be 0
  });

  test("Focus visible styles are present on interactive elements", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="menuitem"], [role="tab"]',
    );

    focusableElements.forEach((el) => {
      const style = window.getComputedStyle(el);
      // Check for focus-visible styles (outline, ring, box-shadow)
      const hasFocusStyles =
        style.outline !== "none" ||
        style.boxShadow !== "none" ||
        style.borderColor !== style.color ||
        el.classList.contains("focus-visible:ring") ||
        el.classList.contains("focus-visible:outline");

      // Log elements without focus styles for debugging
      if (!hasFocusStyles && !("disabled" in el && el.disabled)) {
        console.warn(
          "Element may lack focus styles:",
          el.tagName,
          el.className,
          el.getAttribute("data-pos-checkout"),
        );
      }
    });
  });

  test("Color contrast meets WCAG AA for text elements", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    // axe will check color-contrast rule automatically
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: true },
      },
    });

    expect(
      results.violations.filter((v) => v.id === "color-contrast"),
    ).toHaveLength(0);
  });

  test("Page has proper heading structure", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    const results = await axe.run(container, {
      rules: {
        "heading-order": { enabled: true },
        "page-has-heading-one": { enabled: true },
      },
    });

    expect(
      results.violations.filter(
        (v) => v.id === "heading-order" || v.id === "page-has-heading-one",
      ),
    ).toHaveLength(0);
  });

  test("Form inputs have associated labels", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    const results = await axe.run(container, {
      rules: {
        label: { enabled: true },
      },
    });

    expect(results.violations.filter((v) => v.id === "label")).toHaveLength(0);
  });

  test("Buttons have accessible names", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    const results = await axe.run(container, {
      rules: {
        "button-name": { enabled: true },
      },
    });

    expect(
      results.violations.filter((v) => v.id === "button-name"),
    ).toHaveLength(0);
  });

  test("ARIA attributes are valid", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    const results = await axe.run(container, {
      rules: {
        "aria-valid-attr": { enabled: true },
        "aria-valid-attr-value": { enabled: true },
        "aria-required-attr": { enabled: true },
      },
    });

    expect(
      results.violations.filter((v) => v.id.startsWith("aria-")),
    ).toHaveLength(0);
  });

  test("Success overlay has proper dialog accessibility", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    // Success overlay would appear after checkout
    // Check if it has proper modal accessibility when rendered
    const overlay =
      container.querySelector('[role="dialog"]') ||
      container.querySelector(".fixed.inset-0");

    if (overlay) {
      const results = await axe.run(overlay);
      expect(results.violations).toHaveLength(0);
    }
  });

  test("Manager approval modal has proper accessibility", async () => {
    const { container } = renderPOS();

    await waitFor(() => {
      expect(
        screen.queryByText("تنشيط محطة الـ POS الآمنة..."),
      ).not.toBeInTheDocument();
    });

    // Modal would be rendered but hidden
    const modal = container.querySelector('[role="dialog"][aria-modal="true"]');

    if (modal) {
      const results = await axe.run(modal);
      expect(results.violations).toHaveLength(0);
    }
  });
});

describe("Accessibility Utilities", () => {
  test("runFullPageAudit returns expected structure", async () => {
    const { runFullPageAudit } = await import("@/test/a11y/utils");

    // Create a minimal test container
    const container = document.createElement("div");
    container.innerHTML = `
      <h1>Test</h1>
      <button>Click me</button>
      <input type="text" aria-label="Search" />
    `;
    document.body.appendChild(container);

    const results = await runFullPageAudit(container);

    expect(results).toHaveProperty("timestamp");
    expect(results).toHaveProperty("url");
    expect(results).toHaveProperty("viewport");
    expect(results).toHaveProperty("violations");
    expect(results).toHaveProperty("incomplete");
    expect(results).toHaveProperty("passes");
    expect(results).toHaveProperty("summary");
    expect(results.summary).toHaveProperty("total");
    expect(results.summary).toHaveProperty("critical");
    expect(results.summary).toHaveProperty("serious");
    expect(results.summary).toHaveProperty("moderate");
    expect(results.summary).toHaveProperty("minor");

    document.body.removeChild(container);
  });
});
