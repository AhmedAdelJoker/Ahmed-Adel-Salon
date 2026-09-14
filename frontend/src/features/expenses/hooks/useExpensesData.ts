import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import type { ExpenseFormData, ExpenseRecord, ExpenseSummary } from "@/types/expenses";
import { PAYMENT_METHODS, CATEGORY_COLORS } from "@/features/expenses/constants";

const PAGE_SIZE = 20;

export function useExpensesData(isOwner: boolean) {
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * PAGE_SIZE;
      const params: Record<string, unknown> = { limit: PAGE_SIZE, skip, q: debouncedSearch };
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (paymentFilter !== "all") params.payment_method = paymentFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const [listRes, summaryRes] = await Promise.all([api.get("/expenses", { params }), api.get("/expenses/summary")]);
      const data = listRes.data;
      const items: ExpenseRecord[] = Array.isArray(data) ? data : data.items || data.data || [];
      setExpenses(items);
      setTotalCount(Array.isArray(data)
        ? (items.length < PAGE_SIZE && currentPage === 1 ? items.length : items.length + (currentPage - 1) * PAGE_SIZE)
        : data.total || items.length);
      if (Array.isArray(data) && items.length === PAGE_SIZE) {
        setTotalCount((prev) => Math.max(prev, items.length + 1));
      }
      setSummary(summaryRes.data || null);
    } catch (_err) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, categoryFilter, dateFrom, dateTo, paymentFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = useCallback(() => {
    setFormData({ title: "", description: "", amount: "", category: "أخرى", payment_method: "cash", expense_date: new Date().toISOString().split("T")[0], status: "recorded", invoice_image_url: "", recipient_name: "", reference_type: "", reference_id: "", internal_notes: "" });
    setIsEditing(false);
    setCurrentId(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.title?.trim() || !formData.amount || !formData.category) { toast.error("يرجى إكمال البيانات الأساسية"); return; }
    if (["إيجار", "مشتريات"].includes(formData.category) && !formData.recipient_name?.trim()) { toast.error("اسم المستفيد/المورد مطلوب لفئة الإيجار والمشتريات"); return; }
    if (!isOwner && isEditing) return toast.error("التعديل متاح للمالك فقط");
    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        ...formData,
        amount: Math.abs(Number(formData.amount)),
        expense_date: formData.expense_date ? new Date(formData.expense_date).toISOString() : new Date().toISOString(),
        recipient_name: formData.recipient_name?.trim() || null,
        reference_type: formData.reference_type || null,
        reference_id: formData.reference_id ? Number(formData.reference_id) : null,
        internal_notes: formData.internal_notes?.trim() || null,
      };
      if (isEditing) { await api.put(`/expenses/${currentId}`, payload); toast.success("تم التحديث"); }
      else { await api.post("/expenses", payload); toast.success("تم التسجيل"); }
      setIsModalOpen(false); resetForm(); fetchData();
    } catch (_err) {
      const apiErr = _err as { response?: { data?: { detail?: unknown } } };
      const msg = apiErr?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "فشل الحفظ");
    } finally { setIsSubmitting(false); }
  }, [formData, isOwner, isEditing, currentId, fetchData, resetForm]);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try { await api.delete(`/expenses/${deleteId}`); toast.success("تم الحذف"); setDeleteId(null); fetchData(); }
    catch (_err) { toast.error("حذف السجلات المالية غير مسموح به حالياً"); }
  }, [deleteId, fetchData]);

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
    try { await api.post(`/expenses/${id}/approve`); toast.success("تم اعتماد المصروف"); fetchData(); }
    catch (err) { toast.error("فشل الاعتماد"); }
  }, [fetchData]);

  const handleInvoiceUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData(); fd.append("file", file);
      const res = await api.post("/expenses/upload-invoice", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setFormData((p) => ({ ...p, invoice_image_url: res.data?.url || "" })); toast.success("تم رفع الصورة");
    } catch (err) { toast.error("فشل الرفع"); }
    finally { setUploading(false); if (invoiceInputRef.current) invoiceInputRef.current.value = ""; }
  }, []);

  const exportToCSV = useCallback(() => {
    if (!expenses.length) return toast.error("لا توجد بيانات للتصدير");
    const headers = ["العنوان", "التصنيف", "المبلغ", "طريقة الدفع", "التاريخ", "الوصف"];
    const rows = expenses.map((exp) => [exp.title, exp.category, exp.amount, PAYMENT_METHODS.find((m) => m.value === exp.payment_method)?.label || exp.payment_method, new Date(String(exp.expense_date || "")).toLocaleDateString("ar-EG"), exp.description || ""]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`; link.click(); URL.revokeObjectURL(link.href);
    toast.success("تم تصدير البيانات بنجاح");
  }, [expenses]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const expenseRows = Array.isArray(expenses) ? expenses : [];
  const categoryData = useMemo(() => {
    if (!expenses.length) return [];
    const grouped: Record<string, number> = {};
    expenses.forEach((exp) => { const key = String(exp.category || "أخرى"); grouped[key] = (grouped[key] || 0) + Number(exp.amount || 0); });
    return Object.entries(grouped).map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "#6b7280" }));
  }, [expenses]);
  const paymentData = useMemo(() => {
    if (!expenses.length) return [];
    const grouped: Record<string, number> = {};
    expenses.forEach((exp) => { const method = PAYMENT_METHODS.find((m) => m.value === exp.payment_method)?.label || exp.payment_method || "غير محدد"; grouped[method] = (grouped[method] || 0) + Number(exp.amount || 0); });
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [expenses]);
  const totalAmount = expenseRows.reduce((s, e) => s + Number(e.amount || 0), 0);
  const hasActiveFilters = categoryFilter !== "all" || paymentFilter !== "all" || !!dateFrom || !!dateTo || !!debouncedSearch;

  return {
    expenses, summary, loading, currentPage, setCurrentPage, totalCount, totalPages, expenseRows, categoryData, paymentData, totalAmount, hasActiveFilters,
    isModalOpen, setIsModalOpen, isEditing, isSubmitting, deleteId, setDeleteId, uploading, viewItem, isViewOpen, setIsViewOpen,
    searchTerm, setSearchTerm, categoryFilter, setCategoryFilter, dateFrom, setDateFrom, dateTo, setDateTo, paymentFilter, setPaymentFilter,
    formData, setFormData, invoiceInputRef, fetchData, handleSubmit, handleDelete, handleEdit, handleView, handleApprove, handleInvoiceUpload, resetForm, exportToCSV,
  };
}
