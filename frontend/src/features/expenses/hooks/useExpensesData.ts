import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import type { ExpenseFormData, ExpenseRecord, ExpenseSummary } from "@/types/expenses";
import { PAYMENT_METHODS, CATEGORY_COLORS } from "@/features/expenses/constants";

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 200;
const EXPORT_MAX_ROWS = 5000;

export function useExpensesData(isOwner: boolean) {
  const { t } = useTranslation("owner");
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewItem, setViewItem] = useState<ExpenseRecord | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState<ExpenseFormData>({
    title: "", description: "", amount: "", category: "أخرى",
    payment_method: "cash", expense_date: new Date().toISOString().split("T")[0],
    status: "recorded", invoice_image_url: "",
    recipient_name: "", reference_type: "", reference_id: "", internal_notes: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setCurrentPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const buildFilterParams = useCallback((base: Record<string, unknown> = {}) => {
    const params: Record<string, unknown> = { ...base };
    if (categoryFilter !== "all") params.category = categoryFilter;
    if (paymentFilter !== "all") params.payment_method = paymentFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (debouncedSearch) params.q = debouncedSearch;
    return params;
  }, [categoryFilter, paymentFilter, statusFilter, dateFrom, dateTo, debouncedSearch]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * PAGE_SIZE;
      const params = buildFilterParams({ limit: PAGE_SIZE, skip });
      // Charts must aggregate the same range as the list, not the current
      // page — otherwise every page flip redraws them differently.
      const summaryParams: Record<string, unknown> = {};
      if (dateFrom) summaryParams.from_date = dateFrom;
      if (dateTo) summaryParams.to_date = dateTo;
      const [listRes, summaryRes] = await Promise.all([
        api.get("/expenses", { params }),
        api.get("/expenses/summary", { params: summaryParams }),
      ]);
      const data = listRes.data;
      const items: ExpenseRecord[] = Array.isArray(data) ? data : data.items || data.data || [];
      setExpenses(items);

      // Phase 2: prefer X-Total-Count header (set by /expenses endpoint)
      const headers = (listRes as { headers?: Record<string, unknown> }).headers ?? {};
      const headerTotal = headers["x-total-count"] ?? headers["X-Total-Count"];
      const headerNum = Number(headerTotal);
      if (Number.isFinite(headerNum) && headerNum >= 0) {
        setTotalCount(headerNum);
      } else {
        // Fallback for old responses: best-effort estimate
        setTotalCount(Array.isArray(data)
          ? (items.length < PAGE_SIZE && currentPage === 1 ? items.length : items.length + (currentPage - 1) * PAGE_SIZE)
          : (data as { total?: number })?.total ?? items.length);
      }
      setSummary(summaryRes.data || null);
    } catch (_err) {
      toast.error(t("expenses.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [currentPage, buildFilterParams, dateFrom, dateTo, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = useCallback(() => {
    setFormData({ title: "", description: "", amount: "", category: "أخرى", payment_method: "cash", expense_date: new Date().toISOString().split("T")[0], status: "recorded", invoice_image_url: "", recipient_name: "", reference_type: "", reference_id: "", internal_notes: "" });
    setIsEditing(false);
    setCurrentId(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.title?.trim() || !formData.amount || !formData.category) { toast.error(t("expenses.completeBasicData")); return; }
    const parsedAmount = Number(formData.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { toast.error(t("expenses.invalidAmount")); return; }
    if (["إيجار", "مشتريات"].includes(formData.category) && !formData.recipient_name?.trim()) { toast.error(t("expenses.recipientRequired")); return; }
    if (!isOwner && isEditing) return toast.error(t("expenses.ownerOnlyEdit"));
    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        ...formData,
        amount: Number(formData.amount),
        expense_date: formData.expense_date ? new Date(formData.expense_date).toISOString() : new Date().toISOString(),
        recipient_name: formData.recipient_name?.trim() || null,
        reference_type: formData.reference_type || null,
        reference_id: formData.reference_id ? Number(formData.reference_id) : null,
        internal_notes: formData.internal_notes?.trim() || null,
      };
      if (isEditing) { await api.put(`/expenses/${currentId}`, payload); toast.success(t("expenses.updateSuccess")); }
      else { await api.post("/expenses", payload); toast.success(t("expenses.createSuccess")); }
      setIsModalOpen(false); resetForm(); fetchData();
    } catch (_err) {
      const apiErr = _err as { response?: { data?: { detail?: unknown } } };
      const msg = apiErr?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : t("expenses.saveFailed"));
    } finally { setIsSubmitting(false); }
  }, [formData, isOwner, isEditing, currentId, fetchData, resetForm, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try { await api.delete(`/expenses/${deleteId}`); toast.success(t("expenses.deleteSuccess")); setDeleteId(null); fetchData(); }
    catch (_err) { toast.error(t("expenses.deleteFailed")); }
  }, [deleteId, fetchData, t]);

  const handleEdit = useCallback((exp: ExpenseRecord) => {
    setViewItem(null);
    setFormData({
      title: exp.title || "",
      description: exp.description || "",
      amount: exp.amount?.toString() || "",
      category: exp.category || "أخرى",
      payment_method: exp.payment_method || "cash",
      expense_date: exp.expense_date ? new Date(String(exp.expense_date)).toISOString().split("T")[0] : "",
      status: exp.status || "recorded",
      invoice_image_url: (exp.invoice_image_url as string) || "",
      recipient_name: (exp.recipient_name as string) || "",
      reference_type: (exp.reference_type as string) || "",
      reference_id: exp.reference_id != null ? String(exp.reference_id) : "",
      internal_notes: (exp.internal_notes as string) || "",
    });
    setCurrentId(exp.id != null ? exp.id : null);
    setIsEditing(true); setIsModalOpen(true);
  }, []);

  const handleView = useCallback((exp: ExpenseRecord) => { setViewItem(exp); setIsViewOpen(true); }, []);

  const handleApprove = useCallback(async (id: number | string) => {
    try { await api.post(`/expenses/${id}/approve`); toast.success(t("expenses.approveSuccess")); fetchData(); }
    catch (_err) { toast.error(t("expenses.approveFailed")); }
  }, [fetchData, t]);

  const handleReject = useCallback(async (id: number | string) => {
    try { await api.post(`/expenses/${id}/reject`); toast.success(t("expenses.rejectSuccess")); fetchData(); }
    catch (_err) {
      const apiErr = _err as { response?: { data?: { detail?: unknown } } };
      const msg = apiErr?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : t("expenses.rejectFailed"));
    }
  }, [fetchData, t]);

  const handleInvoiceUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData(); fd.append("file", file);
      const res = await api.post("/expenses/upload-invoice", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setFormData((p) => ({ ...p, invoice_image_url: res.data?.url || "" })); toast.success(t("expenses.uploadSuccess"));
    } catch (err) { toast.error(t("expenses.uploadFailed")); }
    finally { setUploading(false); if (invoiceInputRef.current) invoiceInputRef.current.value = ""; }
  }, [t]);

  const exportToCSV = useCallback(async () => {
    // CSV cell: always quoted, and neutralize spreadsheet formula injection
    // for cells that start with = + - @ (Excel/LibreOffice evaluate them).
    const csvCell = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    // Export ALL filtered rows, not the current page — a 20-row "export" of a
    // financial ledger silently lies about completeness.
    const collected: ExpenseRecord[] = [];
    for (let skip = 0; skip < EXPORT_MAX_ROWS; skip += EXPORT_PAGE_SIZE) {
      const res = await api.get("/expenses", {
        params: buildFilterParams({ limit: EXPORT_PAGE_SIZE, skip }),
      });
      const data = res.data;
      const items: ExpenseRecord[] = Array.isArray(data) ? data : data.items || data.data || [];
      collected.push(...items);
      if (items.length < EXPORT_PAGE_SIZE) break;
    }
    if (!collected.length) return toast.error(t("expenses.noDataExport"));
    const headers = [t("expenses.csvColTitle"), t("expenses.csvColCategory"), t("expenses.csvColAmount"), t("expenses.csvColPaymentMethod"), t("expenses.csvColDate"), t("expenses.csvColStatus"), t("expenses.csvColDescription")];
    const statusLabels: Record<string, string> = {
      approved: t("expenses.statusApproved"),
      pending_audit: t("expenses.statusPending"),
      rejected: t("expenses.statusRejected"),
    };
    const rows = collected.map((exp) => [
      exp.title, exp.category, exp.amount,
      PAYMENT_METHODS.find((m) => m.value === exp.payment_method)?.label || exp.payment_method,
      new Date(String(exp.expense_date || "")).toLocaleDateString("ar-EG"),
      statusLabels[String(exp.status)] || exp.status,
      exp.description || "",
    ]);
    const csvContent = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`; link.click(); URL.revokeObjectURL(link.href);
    toast.success(t("expenses.exportSuccess", { count: collected.length }));
  }, [buildFilterParams, t]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const expenseRows = Array.isArray(expenses) ? expenses : [];
  const categoryData = useMemo(() => {
    // Server-side aggregation for the active date range — the page-derived
    // version changed on every page flip.
    if (!summary?.categories?.length) return [];
    return summary.categories.map((c) => ({
      name: c.name,
      value: Number(c.value || 0),
      color: CATEGORY_COLORS[c.name] || "var(--text-muted)",
    }));
  }, [summary]);
  const paymentData = useMemo(() => {
    if (!summary?.payment_breakdown?.length) return [];
    return summary.payment_breakdown.map((p) => ({
      name: PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method,
      value: Number(p.amount || 0),
    }));
  }, [summary]);
  const totalAmount = expenseRows.reduce((s, e) => s + Number(e.amount || 0), 0);
  const pendingTotal = Number(summary?.pending_total ?? 0);
  const pendingCount = Number(summary?.pending_count ?? 0);
  const hasActiveFilters = categoryFilter !== "all" || paymentFilter !== "all" || statusFilter !== "all" || !!dateFrom || !!dateTo || !!debouncedSearch;

  return {
    expenses, summary, loading, currentPage, setCurrentPage, totalCount, totalPages, expenseRows, categoryData, paymentData, totalAmount, pendingTotal, pendingCount, hasActiveFilters,
    isModalOpen, setIsModalOpen, isEditing, isSubmitting, deleteId, setDeleteId, uploading, viewItem, isViewOpen, setIsViewOpen,
    searchTerm, setSearchTerm, categoryFilter, setCategoryFilter, dateFrom, setDateFrom, dateTo, setDateTo, paymentFilter, setPaymentFilter, statusFilter, setStatusFilter,
    formData, setFormData, invoiceInputRef, fetchData, handleSubmit, handleDelete, handleEdit, handleView, handleApprove, handleReject, handleInvoiceUpload, resetForm, exportToCSV,
  };
}
