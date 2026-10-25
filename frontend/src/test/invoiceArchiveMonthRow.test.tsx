import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonthArchiveRow } from "@/features/invoice-archive";
import type { ArchiveMonth, MonthInvoice } from "@/features/invoice-archive";

/**
 * قفل الشهر living في جدول مستقل (`month_closures`) يعني أن حالة الشهر لم تعد
 * مشتقة من `invoices.is_closed`، وأن إلغاء فاتورة منفردة لا يُمسح بفتح
 * الشهر. هذه الاختبارات تثبت العقد اللي بيشوفه المستخدم: شارة حالة الشهر،
 * زر القفل معطّل عند وجود مسودات، وإجراءات المسودات (إتمام/حذف) في الشهر
 * المنتهي.
 */

function month(overrides: Partial<ArchiveMonth> = {}): ArchiveMonth {
  return {
    key: "2026-08",
    label: "August 2026",
    label_ar: "أغسطس 2026",
    year: 2026,
    month: 8,
    invoice_count: 4,
    draft_count: 0,
    voided_count: 0,
    total_amount: 1364,
    paid_count: 4,
    is_locked: false,
    locked_at: null,
    status: "open",
    change_percent: null,
    ...overrides,
  };
}

function draft(overrides: Partial<MonthInvoice> = {}): MonthInvoice {
  return {
    id: 7,
    invoice_no: "DRAFT-20260819211550",
    customer_name: "احمد عادل ابراهيم",
    barber_name: "احمد عادل ابراهيم",
    created_at: "2026-08-19T21:15:50",
    payment_method: "cash",
    total_amount: 0,
    customer_id: 5,
    items: [],
    ...overrides,
  };
}

function invoice(overrides: Partial<MonthInvoice> = {}): MonthInvoice {
  return {
    id: 3,
    invoice_no: "INV-20260827-0001",
    customer_name: "احمد عادل ابراهيم",
    barber_name: "احمد عادل ابراهيم",
    created_at: "2026-08-27T09:47:00",
    payment_method: "cash",
    total_amount: 442,
    is_closed: false,
    items: [],
    ...overrides,
  };
}

function renderRow(props: Partial<Parameters<typeof MonthArchiveRow>[0]> = {}) {
  const defaults: Parameters<typeof MonthArchiveRow>[0] = {
    month: month(),
    index: 0,
    isExpanded: true,
    monthData: { items: [invoice()], total: 1 },
    drafts: [],
    draftsLoading: false,
    busyDraftId: null,
    invoicesLoading: false,
    loadingMoreKey: null,
    closingMonth: null,
    reopeningMonth: null,
    canManage: true,
    onToggleExpand: vi.fn(),
    onLoadMore: vi.fn(),
    onConfirmClose: vi.fn(),
    onConfirmReopen: vi.fn(),
    onSelectInvoice: vi.fn(),
    onFinalizeDraft: vi.fn(),
    onDeleteDraft: vi.fn(),
    daysInMonth: () => 31,
  };
  return render(<MonthArchiveRow {...defaults} {...props} />);
}

describe("MonthArchiveRow month lock", () => {
  it("shows a locked month as locked and offers to reopen it", () => {
    renderRow({
      month: month({
        is_locked: true,
        status: "locked",
        locked_at: "2026-10-21T22:00:00",
      }),
    });

    expect(screen.getAllByText("مقفل").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /إعادة فتح الشهر/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^قفل الشهر$/ })).toBeNull();
  });

  it("marks a month with a voided invoice as partial, not locked", () => {
    renderRow({ month: month({ voided_count: 1, status: "partial" }) });

    expect(screen.getByText("جزئي")).toBeTruthy();
    expect(screen.getByText(/قابل للتعديل/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^قفل الشهر$/ })).toBeTruthy();
  });
});

describe("MonthArchiveRow drafts", () => {
  it("blocks the lock while the month still has drafts", () => {
    renderRow({ month: month({ draft_count: 2 }) });

    const lock = screen.getByRole("button", { name: /^قفل الشهر$/ }) as HTMLButtonElement;
    expect(lock.disabled).toBe(true);
    expect(screen.getByText(/أكمل أو احذف 2 مسودة أولًا/)).toBeTruthy();
  });

  it("lists the month drafts with their own actions", () => {
    renderRow({ month: month({ draft_count: 1 }), drafts: [draft()] });

    expect(screen.getByText(/مسودات غير مكتملة \(1\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /إتمام/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /حذف/ })).toBeTruthy();
  });

  it("cannot finalize a draft that has no items", () => {
    renderRow({ month: month({ draft_count: 1 }), drafts: [draft()] });

    const finalize = screen.getByRole("button", {
      name: /إتمام/,
    }) as HTMLButtonElement;
    expect(finalize.disabled).toBe(true);
  });

  it("finalizes a draft that has items", () => {
    const onFinalizeDraft = vi.fn();
    const target = draft({ items: [{ service_name: "حلاقة" }] });
    renderRow({
      month: month({ draft_count: 1 }),
      drafts: [target],
      onFinalizeDraft,
    });

    const finalize = screen.getByRole("button", {
      name: /إتمام/,
    }) as HTMLButtonElement;
    expect(finalize.disabled).toBe(false);
    fireEvent.click(finalize);
    expect(onFinalizeDraft).toHaveBeenCalledWith("2026-08", target);
  });

  it("asks before deleting a draft", () => {
    const onDeleteDraft = vi.fn();
    const target = draft();
    renderRow({
      month: month({ draft_count: 1 }),
      drafts: [target],
      onDeleteDraft,
    });

    fireEvent.click(screen.getByRole("button", { name: /حذف/ }));
    expect(onDeleteDraft).toHaveBeenCalledWith("2026-08", target);
  });

  it("hides the draft actions from a viewer who cannot manage the archive", () => {
    renderRow({
      month: month({ draft_count: 1 }),
      drafts: [draft()],
      canManage: false,
    });

    expect(screen.queryByRole("button", { name: /إتمام/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /حذف/ })).toBeNull();
    expect(screen.getByText(/الإتاحة للمدير أو المالك/)).toBeTruthy();
  });
});
