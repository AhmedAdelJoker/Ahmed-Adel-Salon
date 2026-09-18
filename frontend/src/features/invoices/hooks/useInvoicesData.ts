/**
 * Invoices feature: list/filter/sort/pagination data (moved from Invoices page).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { getApiErrorMessage } from "@/lib/core/utils";
import { invoiceCustomer, invoiceNo, invoiceId, invoiceTotal, invoicePayment, isInvoiceEditable } from "@/features/invoices/utils/invoice";

export function useInvoicesData() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [timePreset, setTimePreset] = useState("month");
  const [sortConfig, setSortConfig] = useState<any>({
    key: "created_at",
    direction: "desc",
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<any>({
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
    manager_pin: "",
  });
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
  const [busyPdfId, setBusyPdfId] = useState<number | string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const toggleColumn = useCallback((key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  }, []);

  const fetchInvoices = useCallback(async () => {
    const fetchInvoiceData = async () => {
      try {
        setInvoicesLoading(true);
        const params: Record<string, unknown> = {
          skip: (currentPage - 1) * pageSize,
          limit: pageSize,
        };
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;
        if (paymentFilter !== "all") params.payment_method = paymentFilter;
        if (statusFilter !== "all") params.status = statusFilter;

        const res = await api.get("/invoices", { params });
        const raw = res.data || {};
        const items = Array.isArray(raw) ? raw : raw.items || adaptList(res);
        const total = typeof raw.total === "number" ? raw.total : items.length;
        setInvoices(items);
        setTotalCount(total);
      } catch (error) {
        const apiErr = error as { response?: { data?: unknown } };
        console.error("Invoices load error:", apiErr?.response?.data || error);
        toast.error(getApiErrorMessage(apiErr, "فشل تحميل سجل الفواتير"));
        setInvoices([]);
      } finally {
        setInvoicesLoading(false);
      }
    };

    const fetchAdjustments = async () => {
      try {
        setAdjustmentsLoading(true);
        const res = await api.get("/invoice-adjustment-requests");
        setAdjustments(adaptList(res));
      } catch (error) {
        console.error("Adjustments load error:", error);
        setAdjustments([]);
      } finally {
        setAdjustmentsLoading(false);
      }
    };

    return Promise.all([fetchInvoiceData(), fetchAdjustments()]);
  }, [currentPage, fromDate, paymentFilter, statusFilter, toDate]);

  useEffect(() => {
    const fmtLocal = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const urlMonth = new URLSearchParams(window.location.search).get("month");
    if (urlMonth) {
      const [y, m] = urlMonth.split("-").map(Number);
      if (y && m) {
        const first = new Date(y, m - 1, 1);
        const last = new Date(y, m, 0);
        setFromDate(fmtLocal(first));
        setToDate(fmtLocal(last));
        return;
      }
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = "";
    let to = "";
    switch (timePreset) {
      case "today":
        from = fmtLocal(today);
        to = from;
        break;
      case "week": {
        const start = new Date(today);
        start.setDate(start.getDate() - start.getDay());
        from = fmtLocal(start);
        to = fmtLocal(today);
        break;
      }
      case "month":
        from = fmtLocal(new Date(now.getFullYear(), now.getMonth(), 1));
        to = fmtLocal(today);
        break;
      case "last_month": {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        from = fmtLocal(start);
        to = fmtLocal(end);
        break;
      }
      default:
        break;
    }
    if (timePreset !== "custom") {
      setFromDate(from);
      setToDate(to);
    }
  }, [timePreset]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const loading = invoicesLoading || adjustmentsLoading;

  const filteredInvoices = useMemo(() => {
    const text = query.trim().toLowerCase();
    const filtered = invoices.filter((invoice) => {
      if (!text) return true;
      return [invoiceNo(invoice), invoiceCustomer(invoice)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[key] ?? a.created_at ?? "";
      const bv = b[key] ?? b.created_at ?? "";
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [invoices, query, sortConfig]);

  const summary = useMemo(() => {
    const total = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const paid = filteredInvoices.filter((inv) => String(inv.status).toLowerCase() === "paid").length;
    return { total, count: filteredInvoices.length, paid, pending: filteredInvoices.length - paid };
  }, [filteredInvoices]);

  const averageInvoice = summary.count ? summary.total / summary.count : 0;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const pendingAdjustments = adjustments.filter(
    (request) =>
      String(request.status || request.request_status || "").toLowerCase() === "pending",
  ).length;

  const exportToCSV = useCallback(() => {
    const rows = filteredInvoices.map((inv) => ({
      No: invoiceNo(inv),
      Customer: invoiceCustomer(inv),
      Amount: inv.total_amount,
      Status: inv.status,
      Date: inv.created_at,
    }));
    const header = Object.keys(rows[0] || {}).join(",");
    const body = rows.map((r) => Object.values(r).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredInvoices]);

  const openInvoicePdf = useCallback(async (invoice: any, settings?: any) => {
    const id = invoiceId(invoice);
    if (!id) return toast.error("لا يمكن تحديد رقم الفاتورة");
    try {
      setBusyPdfId(id);
      const response = await api.get(`/invoices/${id}/pdf`, {
        params: { inline: true },
        responseType: "blob",
      });
      const file = new Blob([response.data], {
        type: (response?.headers?.["content-type"] as string | undefined) || "application/pdf",
      });
      const fileUrl = URL.createObjectURL(file);
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    } catch (err) {
      toast.error("تعذر فتح ملف PDF");
    } finally {
      setBusyPdfId(null);
    }
  }, []);

  const submitAdjustmentRequest = useCallback(async () => {
    if (!adjustmentDialog.reason) return toast.error("يرجى ذكر سبب التعديل");

    if (!isInvoiceEditable(adjustmentDialog.invoice)) {
      toast.error(
        "عفواً، انتهت الفترة المسموح بها لتعديل الفاتورة (ساعة واحدة)",
      );
      setAdjustmentDialog((p) => ({ ...p, open: false }));
      return;
    }

    try {
      setAdjustmentSubmitting(true);
      const id = invoiceId(adjustmentDialog.invoice);
      const payload = {
        request_type: adjustmentDialog.type,
        reason: adjustmentDialog.reason,
        notes: adjustmentDialog.notes,
        manager_pin: adjustmentDialog.manager_pin || null,
        old_values: {
          total_amount: invoiceTotal(adjustmentDialog.invoice),
          payment_method: invoicePayment(adjustmentDialog.invoice),
        },
        requested_values:
          adjustmentDialog.type === "void"
            ? { status: "cancelled" }
            : {
                new_value: adjustmentDialog.new_value,
              },
      };
      await api.post(`/invoices/${id}/adjustment-requests`, payload);
      toast.success("تم إرسال طلب التعديل بنجاح");
      setAdjustmentDialog({
        ...adjustmentDialog,
        open: false,
        manager_pin: "",
      });
      fetchInvoices();
    } catch (err) {
      toast.error("فشل إرسال الطلب");
    } finally {
      setAdjustmentSubmitting(false);
    }
  }, [adjustmentDialog, fetchInvoices]);

  return {
    invoices,
    adjustments,
    invoicesLoading,
    adjustmentsLoading,
    loading,
    query,
    setQuery,
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
    setTimePreset,
    sortConfig,
    showColumnPicker,
    setShowColumnPicker,
    pageSize,
    totalCount,
    visibleColumns,
    toggleColumn,
    handleSort,
    fetchInvoices,
    filteredInvoices,
    summary,
    exportToCSV,
    adjustmentDialog,
    setAdjustmentDialog,
    adjustmentSubmitting,
    busyPdfId,
    selectedInvoice,
    setSelectedInvoice,
    averageInvoice,
    totalPages,
    pendingAdjustments,
    openInvoicePdf,
    submitAdjustmentRequest,
  };
}