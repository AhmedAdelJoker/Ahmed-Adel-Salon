import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  formatDateParts,
  invoicePaymentLabel,
  invoiceStatusLabel,
  isInvoiceEditable,
  rowsFromInvoice,
  type InvoiceRecord,
} from "@/features/invoices/utils/invoice";
import { InvoicesTable } from "@/features/invoices";

/**
 * The ledger's pure helpers had no coverage; regressions here (Arabic literals
 * in the English UI, wrong cancel semantics) are invisible to the type
 * checker. These tests pin the behaviour users actually feel.
 */

const nowIso = () => new Date().toISOString();

describe("invoice utils", () => {
  it("renders dates with Latin digits regardless of locale", () => {
    const parts = formatDateParts("2026-11-02T17:43:00");
    expect(parts.date).toMatch(/20\s*26/);
    expect(parts.date).toMatch(/[0-9]{2}/);
    expect(parts.full).toContain("2026");
  });

  it("translates payment and status labels", () => {
    const invoice = (overrides: InvoiceRecord = {}): InvoiceRecord => ({
      id: 1,
      invoice_no: "INV-1",
      payment_method: "card",
      is_closed: false,
      ...overrides,
    });
    expect(invoicePaymentLabel(invoice())).toBe("شبكة");
    expect(invoiceStatusLabel(invoice({ is_closed: true }))).toBe("ملغاة");
    expect(invoiceStatusLabel(invoice())).toBe("مكتملة");
  });

  it("reads item rows from items or legacy lines", () => {
    const fromItems: InvoiceRecord = {
      items: [{ id: 1, name: "خدمة" }],
    };
    const fromLegacyLines: InvoiceRecord = {
      lines: [{ id: 2, name: "منتج" }],
    };
    expect(rowsFromInvoice(fromItems)).toHaveLength(1);
    expect(rowsFromInvoice(fromLegacyLines)).toHaveLength(1);
    expect(rowsFromInvoice({})).toEqual([]);
  });

  it("blocks edits on voided invoices and outside the 1-hour window", () => {
    expect(isInvoiceEditable(null)).toBe(false);
    expect(isInvoiceEditable({ is_closed: true, created_at: nowIso() })).toBe(
      false,
    );
    expect(isInvoiceEditable({ created_at: nowIso() })).toBe(true);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(isInvoiceEditable({ created_at: twoHoursAgo })).toBe(false);
    expect(isInvoiceEditable({ created_at: "not-a-date" })).toBe(false);
  });
});

const invoice: InvoiceRecord = {
  id: 1,
  invoice_no: "INV-KEYBOARD-1",
  customer_name: "عميل اختبار",
  barber_name: "احمد",
  payment_method: "cash",
  total_amount: 200,
  is_closed: false,
  created_at: nowIso(),
  items: [{ id: 1, service_name: "حلاقة", quantity: 1, unit_price: 200, total_price: 200 }],
};

const visibleColumns = {
  invoiceNo: true,
  customer: true,
  date: true,
  payment: true,
  status: true,
  amount: true,
  actions: true,
};

function renderTable(onSelectInvoice: (invoice: InvoiceRecord) => void) {
  return render(
    <InvoicesTable
      loading={false}
      error={null}
      filteredInvoices={[invoice]}
      visibleColumns={visibleColumns}
      sortConfig={{ key: "date", direction: "desc" }}
      handleSort={vi.fn()}
      busyPdfId={null}
      busyWhatsappId={null}
      hasFilters={false}
      onSelectInvoice={onSelectInvoice}
      onPrintInvoice={vi.fn()}
      onOpenPdf={vi.fn()}
      onSendWhatsapp={vi.fn()}
      onRequestAdjustment={vi.fn()}
      onResetFilters={vi.fn()}
    />,
  );
}

describe("InvoicesTable keyboard behaviour", () => {
  it("does not open the invoice when Enter is pressed on the row actions button", () => {
    const onSelectInvoice = vi.fn();
    renderTable(onSelectInvoice);

    // Desktop and mobile both render an actions trigger with this label.
    const triggers = screen.getAllByLabelText(
      "إجراءات الفاتورة INV-KEYBOARD-1",
    );
    for (const trigger of triggers) {
      fireEvent.keyDown(trigger, { key: "Enter" });
      fireEvent.keyDown(trigger, { key: " " });
    }
    expect(onSelectInvoice).not.toHaveBeenCalled();
  });

  it("activates the row itself on Enter/Space", () => {
    const onSelectInvoice = vi.fn();
    const { container } = renderTable(onSelectInvoice);

    const row = container.querySelector("tr[tabindex=\"0\"]");
    expect(row).toBeTruthy();
    fireEvent.keyDown(row as Element, { key: "Enter" });
    expect(onSelectInvoice).toHaveBeenCalledWith(invoice);
  });
});
