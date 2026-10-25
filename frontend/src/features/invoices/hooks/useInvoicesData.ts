/**
 * Invoices feature: list/filter/sort/pagination data.
 *
 * All filtering and sorting happens on the server so the numbers describe the
 * whole selected period, not just the 20 rows currently on screen. Every
 * request is sequence-guarded: a slow response for an old filter can never
 * overwrite the result of a newer one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { getApiErrorMessage } from "@/lib/core/utils";
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
  invoiceIsClosed,
  rowsFromInvoice,
} from "@/features/invoices/utils/invoice";

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

function initialRange(): DateRange {
  if (typeof window !== "undefined") {
    const urlMonth = new URLSearchParams(window.location.search).get("month");
    if (urlMonth) {
      const [y, m] = urlMonth.split("-").map(Number);
      if (y && m && m >= 1 && m <= 12) {
        return {
          from: fmtLocal(new Date(y, m - 1, 1)),
          to: fmtLocal(new Date(y, m, 0)),
        };
      }
    }
  }
  return presetRange("month");
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
  const [initial] = useState<DateRange>(initialRange);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(true);
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
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    invoiceNo: true,
    customer: true,
    date: true,
    payment: true,
    status: true,
    amount: true,
    actions: true,
  });

  const [adjustmentDialog, setAdjustmentDialog] = useState<any>({
    open: false,
    invoice: null,
    type: "discount",
    reason: "",
    new_value: "",
    notes: "",
  });
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
  const [busyPdfId, setBusyPdfId] = useState<number | string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const requestSeq = useRef(0);

  const timePreset = useMemo(
    () => detectPreset({ from: fromDate, to: toDate }),
    [fromDate, toDate],
  );

  const applyPreset = useCallback((preset: Exclude<TimePreset, "custom">) => {
    const range = presetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
    setCurrentPage(1);
    const params = new URLSearchParams(window.location.search);
    if (params.has("month")) {
      params.delete("month");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`,
      );
    }
  }, []);

  const applyRange = useCallback((range: DateRange) => {
    setFromDate(range.from);
    setToDate(range.to);
    setCurrentPage(1);
    const params = new URLSearchParams(window.location.search);
    if (params.has("month")) {
      params.delete("month");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`,
      );
    }
  }, []);

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
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const apiErr = err as { response?: { data?: unknown } };
      console.error("Invoices load error:", apiErr?.response?.data || err);
      const message = getApiErrorMessage(apiErr, "فشل تحميل سجل الفواتير");
      setError(message);
      toast.error(message);
    } finally {
      if (seq === requestSeq.current) setInvoicesLoading(false);
    }
  }, [buildParams]);

  const fetchAdjustments = useCallback(async () => {
    try {
      setAdjustmentsLoading(true);
      setAdjustmentsError(null);
      const res = await api.get("/invoice-adjustment-requests");
      setAdjustments(adaptList(res));
    } catch (err) {
      console.error("Adjustments load error:", err);
      setAdjustments([]);
      setAdjustmentsError(
        getApiErrorMessage(err, "تعذر تحميل طلبات تعديل الفواتير"),
      );
    } finally {
      setAdjustmentsLoading(false);
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
  const pendingAdjustments = adjustments.filter(
    (request) =>
      String(request.status || request.request_status || "").toLowerCase() ===
      "pending",
  ).length;

  const exportToCSV = useCallback(async () => {
    try {
      const res = await api.get("/invoices", {
        params: buildParams({ skip: 0, limit: 1000 }),
      });
      const raw = res.data || {};
      const items = Array.isArray(raw) ? raw : raw.items || [];
      if (!items.length) {
        toast.error("لا توجد فواتير مطابقة للتصدير");
        return;
      }
      const headers = [
        "رقم الفاتورة",
        "العميل",
        "الخبير",
        "التاريخ",
        "طريقة الدفع",
        "الحالة",
        "الإجمالي",
      ];
      const rows = items.map((invoice: any) => [
        invoiceNo(invoice),
        invoiceCustomer(invoice),
        invoiceBarber(invoice),
        formatDate(invoice.created_at || invoice.createdAt),
        invoicePaymentLabel(invoice),
        invoiceStatusLabel(invoice),
        invoiceTotal(invoice).toFixed(2),
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
      toast.success(`تم تصدير ${items.length} فاتورة`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "تعذر تصدير الفواتير"));
    }
  }, [buildParams, fromDate, toDate]);

  const openInvoicePdf = useCallback(async (invoice: any) => {
    const id = invoiceId(invoice);
    if (!id) return toast.error("لا يمكن تحديد رقم الفاتورة");
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
      toast.error("تعذر فتح ملف PDF");
    } finally {
      setBusyPdfId(null);
    }
  }, []);

  const openAdjustmentDialog = useCallback((invoice: any) => {
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
    if (!reason) return toast.error("يرجى ذكر سبب التعديل");

    const type = adjustmentDialog.type;
    const newValue = String(adjustmentDialog.new_value || "").trim();

    if (type === "discount") {
      const parsed = Number(newValue);
      if (!newValue || !Number.isFinite(parsed) || parsed < 0) {
        return toast.error("أدخل قيمة خصم صحيحة أكبر من أو تساوي صفر");
      }
      if (parsed > invoiceSubtotal(adjustmentDialog.invoice)) {
        return toast.error("الخصم لا يمكن أن يتجاوز إجمالي الفاتورة قبل الخصم");
      }
    }

    if (type === "payment_method" && !ALLOWED_ADJUSTMENT_PAYMENTS.includes(newValue)) {
      return toast.error("اختر طريقة دفع صحيحة");
    }

    if (
      !adjustmentDialog.invoice ||
      invoiceIsClosed(adjustmentDialog.invoice) ||
      !isInvoiceEditable(adjustmentDialog.invoice)
    ) {
      toast.error("انتهت فترة تعديل هذه الفاتورة (ساعة واحدة)");
      setAdjustmentDialog((prev: any) => ({ ...prev, open: false }));
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
      toast.success("تم إرسال طلب التعديل بنجاح");
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
      toast.error(getApiErrorMessage(err, "فشل إرسال الطلب"));
    } finally {
      setAdjustmentSubmitting(false);
    }
  }, [adjustmentDialog, refreshAll]);

  return {
    invoices,
    adjustments,
    invoicesLoading,
    adjustmentsLoading,
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
    adjustmentDialog,
    setAdjustmentDialog,
    adjustmentSubmitting,
    busyPdfId,
    selectedInvoice,
    setSelectedInvoice,
    totalPages,
    pendingAdjustments,
    openInvoicePdf,
    openAdjustmentDialog,
    submitAdjustmentRequest,
  };
}
