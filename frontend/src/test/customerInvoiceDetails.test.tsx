import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Tabs } from "@/components/ui/tabs";
import { CustomerInvoicesTab } from "@/features/customers";

/**
 * The invoices tab of the customer page used to end at a bare table: a store
 * owner could see an invoice's number and its total but had no way to open
 * what was actually inside it. The eye button now opens the shared
 * `InvoiceDetailsDialog` from the page; these tests pin the button's contract
 * — it appears only when the page can open the dialog, reports the clicked
 * invoice exactly, and the empty state stays untouched.
 */

const invoices = [
  {
    id: 11,
    invoice_no: "INV-00011",
    created_at: "2026-10-10T10:00:00",
    total_amount: 250,
    is_closed: true,
  },
  {
    id: 12,
    invoice_no: "INV-00012",
    created_at: "2026-10-12T10:00:00",
    total_amount: 90,
    is_closed: false,
  },
];

function renderTab(props: Parameters<typeof CustomerInvoicesTab>[0]) {
  return render(
    <Tabs value="invoices">
      <CustomerInvoicesTab {...props} />
    </Tabs>,
  );
}

describe("CustomerInvoicesTab details button", () => {
  it("takes the row's exact invoice to onViewInvoice", () => {
    const onViewInvoice = vi.fn();
    renderTab({ invoices, loading: false, onViewInvoice });

    fireEvent.click(screen.getAllByTitle("تفاصيل الفاتورة")[1]);

    expect(onViewInvoice).toHaveBeenCalledTimes(1);
    expect(onViewInvoice).toHaveBeenCalledWith(invoices[1]);
  });

  it("exports a row button per invoice, named for screen readers", () => {
    const onViewInvoice = vi.fn();
    renderTab({ invoices, loading: false, onViewInvoice });

    const buttons = screen.getAllByTitle("تفاصيل الفاتورة");
    expect(buttons).toHaveLength(invoices.length);
    buttons.forEach((b) =>
      expect(b.getAttribute("aria-label")).toBe("تفاصيل الفاتورة"),
    );
  });

  it("renders no action column without a handler", () => {
    renderTab({ invoices, loading: false });

    expect(screen.queryByTitle("تفاصيل الفاتورة")).toBeNull();
    // and no empty header for it either
    expect(screen.queryByText("إجراءات")).toBeNull();
  });

  it("keeps the empty state when the customer has no invoices", () => {
    renderTab({ invoices: [], loading: false, onViewInvoice: vi.fn() });

    expect(screen.queryByTitle("تفاصيل الفاتورة")).toBeNull();
    expect(screen.getByText("لا توجد فواتير")).toBeTruthy();
  });
});
