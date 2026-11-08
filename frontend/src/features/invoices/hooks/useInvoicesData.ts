/**
 * Invoices feature: list/filter/sort/pagination data.
 *
 * All filtering and sorting happens on the server so the numbers describe the
 * whole selected period, not just the 20 rows currently on screen. Every
 * request is sequence-guarded: a slow response for an old filter can never
 * overwrite the result of a newer one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { getApiErrorMessage } from "@/lib/core/utils";
import i18n from "@/i18n";
import {
  formatDate,
  invoiceBarber,
  invoiceCustomer,
  invoiceId,
  invoiceNo,
  invoicePaymentLabel,
  invoiceStatusLabel,
  invoiceTotal,
  isInvoiceEditable,
  invoiceSubtotal,
  invoiceDiscount,
  invoiceTaxAmount,
  invoiceIsClosed,
  rowsFromInvoice,
  type InvoiceRecord,
} from "@/features/invoices/utils/invoice";
import type { AdjustmentDialogState } from "@/features/invoices/components/InvoicesDialogs";

export type TimePreset = "today" | "week" | "month" | "last_month" | "custom";

export interface DateRange {
  from: string;
  to: string;
}

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function presetRange(preset: Exclude<TimePreset, "custom">): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { from: fmtLocal(today), to: fmtLocal(today) };
    case "week": {
      const start = new Date(today);
      // Egyptian weeks start on Saturday.
      start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
      return { from: fmtLocal(start), to: fmtLocal(today) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmtLocal(start), to: fmtLocal(end) };
    }
    case "month":
    default:
      return {
        from: fmtLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: fmtLocal(today),
      };
  }
}

export function detectPreset(range: DateRange): TimePreset {
  const presets: Exclude<TimePreset, "custom">[] = [
    "today",
    "week",
    "month",
    "last_month",
  ];
  for (const preset of presets) {
    const candidate = presetRange(preset);
    if (candidate.from === range.from && candidate.to === range.to) {
      return preset;
    }
  }
  return "custom";
}

export function monthRange(yearMonth: string): DateRange | null {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return {
    from: fmtLocal(new Date(y, m - 1, 1)),
    to: fmtLocal(new Date(y, m, 0)),
  };
}

const SORT_PARAM: Record<string, string> = {
  invoiceNo: "invoice_no",
  date: "created_at",
  amount: "total_amount",
};

const ALLOWED_ADJUSTMENT_PAYMENTS = ["cash", "card", "bank_transfer", "wallet"];

const DEFAULT_SUMMARY = { count: 0, total: 0, average: 0, closed: 0 };

function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function useInvoicesData() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initial] = useState<DateRange>(() => {
    const month = searchParams.get("month");
    const range = month ? monthRange(month) : null;
    return range && range.from !== range.to ? range : presetRange("month");
  });
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [adjustmentsError, setAdjustmentsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    invoiceNo: true,
    customer: true,
    date: true,
    payment: true,
    status: true,
    amount: true,
    actions: true,
  });

  const [adjustmentDialog, setAdjustmentDialog] = useState<AdjustmentDialogState>({
    open: false,
    invoice: null,
    type: "discount",
    reason: "",
    new_value: "",
    notes: "",
  });
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
  const [pendingAdjustments, setPendingAdjustments] = useState(0);
  const [busyPdfId, setBusyPdfId] = useState<number | string | null>(null);
  const [busyWhatsappId, setBusyWhatsappId] = useState<number | string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  const requestSeq = useRef(0);

  const timePreset = useMemo(
    () => detectPreset({ from: fromDate, to: toDate }),
    [fromDate, toDate],
  );

  const clearMonthParam = useCallback(() => {
    if (!searchParams.has("month")) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("month");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const applyPreset = useCallback(
    (preset: Exclude<TimePreset, "custom">) => {
      const range = presetRange(preset);
      setFromDate(range.from);
      setToDate(range.to);
      setCurrentPage(1);
      clearMonthParam();
    },
    [clearMonthParam],
  );

  const applyRange = useCallback(
    (range: DateRange) => {
      setFromDate(range.from);
      setToDate(range.to);
      setCurrentPage(1);
      clearMonthParam();
    },
    [clearMonthParam],
  );

  const shiftMonth = useCallback(
    (delta: number) => {
      const anchor = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
      if (Number.isNaN(anchor.getTime())) return;
      const start = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      applyRange({ from: fmtLocal(start), to: fmtLocal(end) });
    },
    [fromDate, applyRange],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setCurrentPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSort = useCallback((key: string) => {
    if (!SORT_PARAM[key]) return;
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  }, []);

  const buildParams = useCallback(
    (overrides: Record<string, unknown> = {}) => {
      const params: Record<string, unknown> = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (paymentFilter !== "all") params.payment_method = paymentFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (debouncedQuery) params.q = debouncedQuery;
      params.sort = SORT_PARAM[sortConfig.key] || "created_at";
      params.order = sortConfig.direction;
      return { ...params, ...overrides };
    },
    [
      currentPage,
      fromDate,
      toDate,
      paymentFilter,
      statusFilter,
      debouncedQuery,
      sortConfig,
      pageSize,
    ],
  );

  const fetchInvoices = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      setInvoicesLoading(true);
      const res = await api.get("/invoices", { params: buildParams() });
      if (seq !== requestSeq.current) return;
      const raw = res.data || {};
      const items = Array.isArray(raw) ? raw : raw.items || adaptList(res);
      setInvoices(items);
      setTotalCount(
        typeof raw.total === "number" ? raw.total : items.length,
      );
      setSummary(raw.summary || { ...DEFAULT_SUMMARY, count: items.length });
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const apiErr = err as { response?: { data?: unknown } };
      console.error("Invoices load error:", apiErr?.response?.data || err);
      const message = getApiErrorMessage(
        apiErr,
        i18n.t("invoices:toasts.loadFailed"),
      );
      setError(message);
      toast.error(message);
    } finally {
      if (seq === requestSeq.current) setInvoicesLoading(false);
    }
  }, [buildParams]);

  const fetchAdjustments = useCallback(async () => {
    try {
      setAdjustmentsError(null);
      // The list endpoint already filters by role (cashiers get their own
      // only), so ask for exactly one row and read the total from the header
      // instead of downloading rows just to count them.
      const res = await api.get("/invoice-adjustment-requests", {
        params: { status: "pending", limit: 1 },
      });
      const fromHeader = Number(res?.headers?.["x-total-count"]);
      setPendingAdjustments(
        Number.isFinite(fromHeader)
          ? fromHeader
          : Array.isArray(res.data)
            ? res.data.length
            : 0,
      );
    } catch (err) {
      console.error("Adjustments load error:", err);
      setPendingAdjustments(0);
      setAdjustmentsError(
        getApiErrorMessage(
          err,
          i18n.t("invoices:toasts.loadAdjustmentsFailed"),
        ),
      );
    }
  }, []);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    void fetchAdjustments();
  }, [fetchAdjustments]);

  const refreshAll = useCallback(() => {
    void fetchInvoices();
    void fetchAdjustments();
  }, [fetchInvoices, fetchAdjustments]);

  const filteredInvoices = invoices;
  const searchPending = query.trim() !== debouncedQuery;

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));

  const exportToCSV = useCallback(async () => {
    try {
      setExporting(true);
      // The server caps a page at 1000 rows, so a period with more invoices
      // than that used to export only the first thousand — silently, with a
      // toast that said "exported N invoices". The export now walks the
      // whole result set page by page and reports what it really wrote.
      const PAGE_SIZE = 500;
      const collected: InvoiceRecord[] = [];
      let skip = 0;
      let total = Number.POSITIVE_INFINITY;

      while (collected.length < total) {
        const res = await api.get("/invoices", {
          params: buildParams({ skip, limit: PAGE_SIZE }),
        });
        const raw = res.data || {};
        const page = Array.isArray(raw) ? raw : raw.items || [];
        if (!page.length) break;
        collected.push(...page);
        total = typeof raw.total === "number" ? raw.total : collected.length;
        skip += page.length;
        if (page.length < PAGE_SIZE) break;
      }

      const items = collected;
      if (!items.length) {
        toast.error(i18n.t("invoices:csv.noMatching"));
        return;
      }
      const headers = [
        i18n.t("invoices:csv.invoiceNo"),
        i18n.t("invoices:csv.customer"),
        i18n.t("invoices:csv.barber"),
        i18n.t("invoices:csv.date"),
        i18n.t("invoices:csv.payment"),
        i18n.t("invoices:csv.status"),
        i18n.t("invoices:csv.total"),
        i18n.t("invoices:csv.discount"),
        i18n.t("invoices:csv.tax"),
      ];
      const rows = items.map((invoice) => [
        invoiceNo(invoice),
        invoiceCustomer(invoice),
        invoiceBarber(invoice),
        formatDate(invoice.created_at || invoice.createdAt),
        invoicePaymentLabel(invoice),
        invoiceStatusLabel(invoice),
        invoiceTotal(invoice).toFixed(2),
        invoiceDiscount(invoice).toFixed(2),
        invoiceTaxAmount(invoice).toFixed(2),
      ]);
      const csv =
        "\uFEFF" +
        [headers, ...rows]
          .map((row) => row.map(escapeCsv).join(","))
          .join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoices_${fromDate}_${toDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(i18n.t("invoices:csv.exported", { count: items.length }));
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, i18n.t("invoices:csv.exportFailed")),
      );
    } finally {
      setExporting(false);
    }
  }, [buildParams, fromDate, toDate]);

  const openInvoicePdf = useCallback(async (invoice: InvoiceRecord) => {
    const id = invoiceId(invoice);
    if (!id) return toast.error(i18n.t("invoices:toasts.notDetermined"));
    try {
      setBusyPdfId(id);
      const response = await api.get(`/invoices/${id}/pdf`, {
        params: { inline: true },
        responseType: "blob",
      });
      const file = new Blob([response.data], {
        type:
          (response?.headers?.["content-type"] as string | undefined) ||
          "application/pdf",
      });
      const fileUrl = URL.createObjectURL(file);
      // `window.open(blob, "_blank", "noopener,noreferrer")` opens a blank
      // tab: the blob belongs to the opener's registry, so the new context
      // cannot resolve it. Opening it normally and clearing `opener`
      // afterwards keeps the tabnabbing protection and shows the PDF.
      const viewer = window.open(fileUrl, "_blank");
      if (viewer) viewer.opener = null;
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    } catch {
      toast.error(i18n.t("invoices:toasts.pdfFailed"));
    } finally {
      setBusyPdfId(null);
    }
  }, []);

  const sendInvoicePdfWhatsapp = useCallback(async (invoice: InvoiceRecord) => {
    const id = invoiceId(invoice);
    if (!id) return toast.error(i18n.t("invoices:toasts.notDetermined"));
    try {
      setBusyWhatsappId(id);
      await api.post(`/invoices/${id}/send-whatsapp-pdf`);
      toast.success(i18n.t("invoices:toasts.whatsappSent"));
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, i18n.t("invoices:toasts.whatsappFailed")),
      );
    } finally {
      setBusyWhatsappId(null);
    }
  }, []);

  const openAdjustmentDialog = useCallback((invoice: InvoiceRecord) => {
    setAdjustmentDialog({
      open: true,
      invoice,
      type: "discount",
      reason: "",
      new_value: "",
      notes: "",
    });
  }, []);

  const submitAdjustmentRequest = useCallback(async () => {
    const reason = String(adjustmentDialog.reason || "").trim();
    if (!reason) return toast.error(i18n.t("invoices:toasts.reasonRequired"));

    const type = adjustmentDialog.type;
    const newValue = String(adjustmentDialog.new_value || "").trim();

    if (type === "discount") {
      const parsed = Number(newValue);
      if (!newValue || !Number.isFinite(parsed) || parsed < 0) {
        return toast.error(i18n.t("invoices:toasts.invalidDiscount"));
      }
      if (parsed > invoiceSubtotal(adjustmentDialog.invoice)) {
        return toast.error(i18n.t("invoices:toasts.discountTooLarge"));
      }
    }

    if (type === "payment_method" && !ALLOWED_ADJUSTMENT_PAYMENTS.includes(newValue)) {
      return toast.error(i18n.t("invoices:toasts.invalidPaymentMethod"));
    }

    if (
      !adjustmentDialog.invoice ||
      invoiceIsClosed(adjustmentDialog.invoice) ||
      !isInvoiceEditable(adjustmentDialog.invoice)
    ) {
      toast.error(i18n.t("invoices:toasts.expiredEditSave"));
      setAdjustmentDialog((prev) => ({ ...prev, open: false }));
      return;
    }

    try {
      setAdjustmentSubmitting(true);
      const id = invoiceId(adjustmentDialog.invoice);
      const payload = {
        request_type: type,
        reason,
        notes: String(adjustmentDialog.notes || "").trim(),
        old_values: {
          total_amount: invoiceTotal(adjustmentDialog.invoice),
          subtotal_amount: invoiceSubtotal(adjustmentDialog.invoice),
          discount_amount: invoiceDiscount(adjustmentDialog.invoice),
          payment_method: adjustmentDialog.invoice?.payment_method,
          items_count: rowsFromInvoice(adjustmentDialog.invoice).length,
        },
        requested_values:
          type === "void" ? { status: "cancelled" } : { new_value: newValue },
      };
      await api.post(`/invoices/${id}/adjustment-requests`, payload);
      toast.success(i18n.t("invoices:toasts.sentSuccess"));
      setAdjustmentDialog({
        open: false,
        invoice: null,
        type: "discount",
        reason: "",
        new_value: "",
        notes: "",
      });
      refreshAll();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, i18n.t("invoices:toasts.submitFailed")),
      );
    } finally {
      setAdjustmentSubmitting(false);
    }
  }, [adjustmentDialog, refreshAll]);

  return {
    invoices,
    invoicesLoading,
    adjustmentsError,
    error,
    loading: invoicesLoading,
    query,
    setQuery,
    searchPending,
    paymentFilter,
    setPaymentFilter,
    statusFilter,
    setStatusFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    currentPage,
    setCurrentPage,
    timePreset,
    applyPreset,
    applyRange,
    shiftMonth,
    sortConfig,
    showColumnPicker,
    setShowColumnPicker,
    pageSize,
    totalCount,
    visibleColumns,
    toggleColumn,
    handleSort,
    fetchInvoices,
    refreshAll,
    filteredInvoices,
    summary,
    exportToCSV,
    exporting,
    adjustmentDialog,
    setAdjustmentDialog,
    adjustmentSubmitting,
    busyPdfId,
    busyWhatsappId,
    selectedInvoice,
    setSelectedInvoice,
    totalPages,
    pendingAdjustments,
    lastUpdated,
    openInvoicePdf,
    sendInvoicePdfWhatsapp,
    openAdjustmentDialog,
    submitAdjustmentRequest,
  };
}
