import { useAuth } from "../../context/AuthContext";
import React, { useState, useEffect, useRef } from "react";



import { useNavigate } from "react-router-dom";
import expenseService from "../../services/expenseService";
import {
  adaptList,
  adaptObject,
  normalizeListResponse,
} from "../../services/apiAdapter";
import { toast } from "react-hot-toast";
import exportService from "../../services/exportService";
import {
  Wallet,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  FileText,
  TrendingDown,
  PieChart as PieIcon,
  Tag,
  User,
  CreditCard,
  History,
  Activity,
  Archive,
  Search,
  Pencil,
  FileDown,
  FileSpreadsheet,
  Save,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import api from "../../services/api";
import { safePositive } from "../../lib/utils";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";

const CATEGORIES = [
  "رواتب",
  "إيجار",
  "مشتريات",
  "كهرباء",
  "مياه",
  "إنترنت",
  "صيانة",
  "تسويق",
  "ضيافة",
  "سلف",
  "أخرى",
];
const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "wallet", label: "محفظة" },
];

const Expenses = () => {
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const invoiceInputRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    category: "أخرى",
    payment_method: "cash",
    expense_date: new Date().toISOString().split("T")[0],
    status: "recorded",
    invoice_image_url: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const [listRes, summaryRes] = await Promise.all([
        expenseService.list({ limit: pageSize, skip, q: debouncedSearch }),
        expenseService.summary(),
      ]);
      const normalized = normalizeListResponse(listRes);
      setExpenses(normalized.items);
      setTotalCount(normalized.total);
      setSummary(adaptObject(summaryRes, {}));
    } catch (err) {
      console.error("Error fetching expenses", err);
      toast.error("فشل في تحميل البيانات المالية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, debouncedSearch]);

  const handleSubmit = async () => {
    try {
      if (!formData.amount || !formData.category || !formData.title) {
        toast.error("يرجى إكمال البيانات الأساسية (العنوان، المبلغ والتصنيف)");
        return;
      }

      setIsSubmitting(true);
      const payload = {
        ...formData,
        amount: safePositive(formData.amount),
        expense_date: formData.expense_date
          ? new Date(formData.expense_date).toISOString()
          : new Date().toISOString(),
      };

      if (isEditing) {
        await expenseService.update(currentId, payload);
        toast.success("تم تحديث المصروف بنجاح");
      } else {
        await expenseService.create(payload);
        toast.success("تم تسجيل المصروف بنجاح");
      }

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء المعالجة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (exp) => {
    setFormData({
      title: exp.title || "",
      description: exp.description || "",
      amount: exp.amount.toString(),
      category: exp.category,
      payment_method: exp.payment_method,
      expense_date: exp.expense_date
        ? new Date(exp.expense_date).toISOString().split("T")[0]
        : "",
      status: exp.status,
      invoice_image_url: exp.invoice_image_url || "",
    });
    setCurrentId(exp.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setIsSubmitting(true);
      await expenseService.remove(deleteId);
      toast.success("تم الحذف بنجاح");
      setDeleteId(null);
      fetchData();
    } catch (err) {
      toast.error("فشل الحذف");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvoiceUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("file", file);

    try {
      setUploading(true);
      const response = await api.post("/expenses/upload-invoice", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFormData((prev) => ({
        ...prev,
        invoice_image_url: response.data.url,
      }));
      toast.success("تم رفع صورة الفاتورة");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      amount: "",
      category: "أخرى",
      payment_method: "cash",
      expense_date: new Date().toISOString().split("T")[0],
      status: "recorded",
      invoice_image_url: "",
    });
    setIsEditing(false);
    setCurrentId(null);
  };

  const expenseRows = Array.isArray(expenses) ? expenses : [];
  const filteredExpenseRows = expenseRows.filter((exp) => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return true;

    return [
      exp.title,
      exp.description,
      exp.category,
      exp.payment_method,
      exp.created_by_user_id,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  if (loading && expenseRows.length === 0)
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Activity className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">
            جاري مزامنة السجلات المالية...
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-8 pb-10 erp-page-container" dir="rtl">
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="حذف القيد المالي؟"
        description="سيتم إزالة هذا المصروف من السجلات النشطة. هل أنت متأكد من هذا الإجراء الرقابي؟"
        onConfirm={handleDelete}
        loading={isSubmitting}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
            <TrendingDown className="text-white w-8 h-8" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-main tracking-tight leading-none">
              إدارة المصاريف
            </h1>
            <p className="text-base font-medium text-muted">
              متابعة التدفقات النقدية الخارجة وتكاليف التشغيل
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            type="button"
            variant="outline"
            title="تصدير السجل المالي إلى ملف Excel"
            onClick={() =>
              exportService.downloadExcel(
                "/exports/expenses/excel",
                "expenses_report",
              )
            }
            className="h-12 rounded-xl border-border px-6 text-xs font-black uppercase tracking-widest"
          >
            Excel <FileSpreadsheet className="mr-2 text-success" size={16} />
          </Button>
          <Button
            type="button"
            variant="outline"
            title="تصدير السجل المالي إلى CSV"
            onClick={() =>
              exportService.downloadCsv(
                "/exports/expenses/csv",
                "expenses_report",
              )
            }
            className="h-12 rounded-xl border-border px-6 text-xs font-black uppercase tracking-widest"
          >
            CSV <FileDown className="mr-2 text-info" size={16} />
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => navigate("/expenses/archive")}
            variant="outline"
            title="الانتقال إلى أرشيف العمليات السابقة"
            className="h-12 rounded-xl font-black uppercase tracking-widest text-xs px-8 border-border bg-card"
          >
            الأرشيف <Archive className="mr-2" size={18} />
          </Button>
          <Button
            type="button"
            variant="primary"
            title="توثيق مصروف تشغيلي جديد"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex-1 md:flex-none rounded-xl font-black px-10 h-12 shadow-lg shadow-accent/20 text-lg"
          >
            إضافة مصروف <Plus className="mr-2" size={20} strokeWidth={2.5} />
          </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
        <Card className="rounded-premium border border-border/60 bg-card p-7 shadow-soft transition-all hover:border-accent/20 group">
          <div className="p-3 rounded-2xl bg-danger-soft/30 w-fit mb-5">
            <Wallet className="w-6 h-6 text-danger" />
          </div>
          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 group-hover:text-accent transition-colors">
              مصروفات اليوم
            </div>
            <div className="text-3xl font-black text-main tracking-tighter tabular-nums">
              {Number(summary?.today_total || 0).toLocaleString()}{" "}
              <span className="text-[10px] text-muted font-bold mr-1">ج.م</span>
            </div>
            <div className="mt-1.5 text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />{" "}
              {summary?.today_count || 0} عملية معتمدة
            </div>
          </div>
        </Card>

        <Card className="rounded-premium border border-border/60 bg-card p-7 shadow-soft transition-all hover:border-accent/20 group">
          <div className="p-3 rounded-2xl bg-accent-soft/30 w-fit mb-5">
            <PieIcon className="w-6 h-6 text-accent" />
          </div>
          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 group-hover:text-accent transition-colors">
              مصروفات الشهر
            </div>
            <div className="text-3xl font-black text-main tracking-tighter tabular-nums">
              {Number(summary?.month_total || 0).toLocaleString()}{" "}
              <span className="text-[10px] text-muted font-bold mr-1">ج.م</span>
            </div>
            <div className="mt-1.5 text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />{" "}
              {summary?.month_count || 0} عملية خلال ٣٠ يوم
            </div>
          </div>
        </Card>

        <Card className="rounded-premium border border-border/60 bg-card p-7 shadow-soft transition-all hover:border-accent/20 group">
          <div className="p-3 rounded-2xl bg-success-soft/30 w-fit mb-5">
            <Tag className="w-6 h-6 text-success" />
          </div>
          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 group-hover:text-accent transition-colors">
              أعلى استهلاك (فئوي)
            </div>
            <div className="text-2xl font-black text-main tracking-tight truncate">
              {summary?.top_category || "---"}
            </div>
            <div className="mt-1.5 text-[10px] font-bold text-muted uppercase tracking-widest">
              التصنيف الأكثر إنفاقاً
            </div>
          </div>
        </Card>

        <Card className="rounded-premium border border-border/60 bg-card p-7 shadow-soft transition-all hover:border-accent/20 group">
          <div className="p-3 rounded-2xl bg-soft w-fit mb-5">
            <History className="w-6 h-6 text-muted" />
          </div>
          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 group-hover:text-accent transition-colors">
              آخر تدفق خارج
            </div>
            <div className="text-2xl font-black text-main tracking-tight truncate leading-none">
              {summary?.latest_expense?.title || "لا يوجد سجل"}
            </div>
            <div className="mt-2 text-[10px] font-black text-accent tabular-nums uppercase tracking-widest">
              {summary?.latest_expense?.amount
                ? `${Number(summary.latest_expense.amount).toLocaleString()} ج.م`
                : "—"}
            </div>
          </div>
        </Card>
      </div>

      {/* Main List Area */}
      <Card className="rounded-[32px] p-8 border border-border/60 bg-card shadow-soft transition-all hover:shadow-premium">
        <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-main uppercase tracking-tight leading-none">
              سجل الحركات المالية
            </h2>
            <p className="text-sm font-medium text-muted">
              عرض {expenses.length} من أصل {totalCount} سجل مالي
            </p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72 group">
              <Search
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors"
              />
              <Input
                value={searchTerm || ""}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="بحث سريع في السجلات..."
                className="h-11 pr-11 rounded-xl bg-soft border-border text-xs font-bold shadow-none focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {expenses.map((exp) => (
            <motion.div
              layout
              key={exp.id}
              className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-soft/30 rounded-2xl border border-border/60 hover:border-accent/40 hover:bg-white transition-all duration-300"
            >
              <div className="flex items-start gap-6 flex-1 w-full">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-border/40 shadow-sm group-hover:scale-105 transition-transform ${exp.status === "approved" ? "bg-success-soft/30 text-success" : "bg-card text-muted"}`}
                >
                  <Tag size={24} strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-black text-main truncate max-w-[280px] leading-none group-hover:text-accent transition-colors">
                      {exp.title}
                    </h3>
                    <Badge
                      variant="outline"
                      className="h-5 px-3 font-black text-[8px] uppercase tracking-widest border-border bg-card text-muted rounded-lg"
                    >
                      {exp.category}
                    </Badge>
                    {exp.status === "cancelled" && (
                      <Badge
                        variant="danger"
                        className="h-5 px-3 text-[8px] font-black uppercase tracking-widest border-none rounded-lg"
                      >
                        ملغي إدارياً
                      </Badge>
                    )}
                    {exp.invoice_image_url && (
                      <a 
                        href={exp.invoice_image_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-accent hover:underline flex items-center gap-1 text-[10px] font-bold"
                      >
                        <ImageIcon size={12} /> عرض الفاتورة
                      </a>
                    )}
                  </div>
                  <p className="text-xs font-medium text-muted line-clamp-1">
                    {exp.description || "لا يوجد توصيف إداري إضافي"}
                  </p>
                  <div className="flex flex-wrap items-center gap-5 mt-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase">
                      <Calendar size={13} className="text-accent" />{" "}
                      {new Date(exp.expense_date).toLocaleDateString("ar-EG")}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase">
                      <CreditCard size={13} className="text-accent" />{" "}
                      {PAYMENT_METHODS.find(
                        (m) => m.value === exp.payment_method,
                      )?.label || exp.payment_method}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase">
                      <User size={13} className="text-accent" />{" "}
                      {exp.created_by_user_id
                        ? `المسؤول #${exp.created_by_user_id}`
                        : "نظام آلي"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-8 mt-6 sm:mt-0 pt-6 sm:pt-0 border-t sm:border-none border-border/40">
                <div className="text-left">
                  <div
                    className={`text-2xl font-black tracking-tighter tabular-nums ${exp.status === "cancelled" ? "line-through opacity-30 text-muted" : "text-danger"}`}
                  >
                    {Number(exp.amount).toLocaleString()}{" "}
                    <span className="text-[10px] font-bold text-muted mr-1.5 uppercase">
                      ج.م
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    title="تعديل بيانات العملية"
                    disabled={loading}
                    onClick={() => handleEdit(exp)}
                    className="h-11 w-11 rounded-xl border border-border group-hover:border-accent/20 transition-all shadow-sm"
                  >
                    <Pencil size={18} strokeWidth={2} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="حذف القيد المالي"
                    disabled={loading}
                    onClick={() => setDeleteId(exp.id)}
                    className="h-11 w-11 rounded-xl text-danger/40 hover:text-danger hover:bg-danger-soft transition-all"
                  >
                    <Trash2 size={18} strokeWidth={2} />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
          {expenses.length === 0 && (
            <div className="py-24 text-center border-2 border-dashed border-border/60 rounded-[32px] bg-soft/20 opacity-40">
              <div className="w-20 h-20 bg-soft rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                <FileText size={40} className="text-muted" />
              </div>
              <h4 className="text-lg font-black text-main uppercase tracking-tight">
                السجل خالي حالياً
              </h4>
              <p className="text-sm font-medium mt-2">
                لا توجد نتائج تطابق بحثك أو السجل فارغ
              </p>
            </div>
          )}
        </div>

        {totalCount > pageSize && (
          <div className="flex items-center justify-between mt-10 pt-8 border-t border-border/40">
            <div className="text-xs font-bold text-muted uppercase tracking-widest">
              صفحة {currentPage} من {Math.ceil(totalCount / pageSize)}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1 || loading}
                onClick={() => setCurrentPage(p => p - 1)}
                className="h-10 w-10 rounded-xl"
              >
                <ChevronRight size={18} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-10 w-10 rounded-xl"
              >
                <ChevronLeft size={18} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Redesigned Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="rounded-[32px] p-0 bg-card border border-border shadow-premium max-w-2xl overflow-hidden"
          dir="rtl"
        >
          <DialogHeader className="p-10 pb-6 bg-[#1B1714] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -mr-32 -mt-32" />
            <div className="relative z-10 space-y-2">
              <DialogTitle className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-4 leading-none">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Wallet size={24} />
                </div>
                {isEditing ? "تحديث السجل المالي" : "قيد مصروفات جديد"}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/50 uppercase tracking-widest">
                إدارة التدفقات النقدية بدقة لضمان الامتثال والنزاهة المحاسبية
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                وصف العملية (العنوان)
              </label>
              <Input
                className="h-14 rounded-xl px-5 font-bold bg-soft border-border text-main focus:bg-white transition-all text-base"
                value={formData.title || ""}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="مثال: صيانة التكييف، فاتورة الكهرباء..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  تصنيف المصروف
                </label>
                <Select
                  value={formData.category || ""}
                  onValueChange={(val) =>
                    setFormData({ ...formData, category: val })
                  }
                >
                  <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-bold px-5">
                    <SelectValue placeholder="تحديد الفئة..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border shadow-premium">
                    {CATEGORIES.map((cat) => (
                      <SelectItem
                        key={cat}
                        value={cat || ""}
                        className="font-bold"
                      >
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  القيمة الإجمالية (ج.م)
                </label>
                <div className="relative group">
                  <DollarSign
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-danger opacity-50 group-focus-within:opacity-100 transition-opacity"
                    size={20}
                  />
                  <Input
                    type="number"
                    className="h-14 rounded-xl pr-12 font-black bg-soft border-border text-main focus:bg-white text-lg tracking-tighter"
                    value={formData.amount || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  طريقة السداد
                </label>
                <Select
                  value={formData.payment_method || ""}
                  onValueChange={(val) =>
                    setFormData({ ...formData, payment_method: val })
                  }
                >
                  <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-bold px-5">
                    <SelectValue placeholder="اختيار القناة..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-premium">
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem
                        key={m.value}
                        value={m.value || ""}
                        className="font-bold"
                      >
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  تاريخ الاستحقاق
                </label>
                <Input
                  type="date"
                  className="h-14 rounded-xl px-5 font-black bg-soft border-border text-main focus:bg-white transition-all uppercase"
                  value={formData.expense_date || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, expense_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                ملاحظات التدقيق الإضافية
              </label>
              <textarea
                className="w-full h-28 p-5 rounded-2xl border border-border bg-soft text-sm font-medium focus:bg-white focus:border-accent outline-none transition-all resize-none"
                placeholder="تفاصيل فنية أو أرقام فواتير ورقية..."
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                صورة فاتورة الشراء (اختياري)
              </label>
              <input
                type="file"
                ref={invoiceInputRef}
                onChange={handleInvoiceUpload}
                className="hidden"
                accept="image/*"
              />
              <div 
                onClick={() => invoiceInputRef.current?.click()}
                className="flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-2xl p-6 cursor-pointer hover:bg-soft/50 transition-all"
              >
                {formData.invoice_image_url ? (
                  <img src={formData.invoice_image_url} alt="Invoice" className="h-32 w-auto rounded-lg mb-2" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted/30 mb-2" />
                )}
                <span className="text-xs font-bold text-muted">
                  {uploading ? "جارِ الرفع..." : formData.invoice_image_url ? "تم الرفع - اضغط للتغيير" : "اضغط لرفع صورة الفاتورة"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-10 pt-6 border-t border-border bg-soft/10 flex gap-4">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setIsModalOpen(false)}
              className="flex-1 rounded-xl font-black uppercase tracking-widest h-14"
            >
              إلغاء الأمر
            </Button>
            <Button
              disabled={loading || uploading}
              onClick={handleSubmit}
              variant="primary"
              className="flex-[2] rounded-xl font-black text-lg h-14 shadow-lg shadow-accent/20"
            >
              <Save size={20} className="ml-2" />
              {isSubmitting
                ? "جاري الحفظ..."
                : isEditing
                  ? "حفظ التعديلات"
                  : "اعتماد القيد المالي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
