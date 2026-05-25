import QRCode from "qrcode";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  FileText,
  Filter,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  ShieldCheck,
  ChevronRight,
  Eye,
  FileDown,
  Activity,
  CreditCard,
  User,
  Zap,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useSalon } from "../../context/SalonContext";
import { printThermalReceipt } from "../../utils/receiptPrinter";
import api from "../../services/api";
import { adaptList } from "../../services/apiAdapter";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
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
import { cn } from "../../lib/utils";

const paymentLabels = {
  cash: "نقدي",
  card: "شبكة",
  visa: "فيزا",
  mada: "مدى",
  wallet: "محفظة",
  instapay: "انستا باي",
};

const statusLabels = {
  paid: "مدفوعة",
  completed: "مكتملة",
  pending: "معلقة",
  cancelled: "ملغاة",
  voided: "ملغاة",
  refunded: "مرتجعة",
};

const adjustmentStatusLabels = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
};

function apiErrorMessage(error, fallback = "حدث خطأ غير متوقع") {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail))
    return detail
      .map((item) => item?.msg || item?.message || String(item))
      .join(" - ");
  if (detail && typeof detail === "object")
    return detail.msg || detail.message || JSON.stringify(detail);
  return detail || error?.response?.data?.message || error?.message || fallback;
}

function asNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(asNumber(value));
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ar-EG", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function invoiceId(invoice) {
  return invoice?.id || invoice?.invoice_id || invoice?.invoiceId;
}

function invoiceNo(invoice) {
  return (
    invoice?.invoice_no ||
    invoice?.invoiceNo ||
    invoice?.number ||
    invoiceId(invoice) ||
    "-"
  );
}

function invoiceCustomer(invoice) {
  return (
    invoice?.customer_name ||
    invoice?.customerName ||
    invoice?.customer?.name ||
    invoice?.client_name ||
    "عميل نقدي"
  );
}

function invoicePayment(invoice) {
  return String(
    invoice?.payment_method || invoice?.paymentMethod || invoice?.payment || "",
  ).toLowerCase();
}

function invoiceStatus(invoice) {
  return String(
    invoice?.status ||
      invoice?.invoice_status ||
      invoice?.invoiceStatus ||
      "paid",
  ).toLowerCase();
}

function invoiceTotal(invoice) {
  return asNumber(
    invoice?.total_amount ??
      invoice?.totalAmount ??
      invoice?.total ??
      invoice?.net_total ??
      invoice?.netTotal,
  );
}

function invoiceCreatedAt(invoice) {
  return (
    invoice?.created_at ||
    invoice?.createdAt ||
    invoice?.date ||
    invoice?.invoice_date ||
    invoice?.invoiceDate
  );
}

function rowsFromInvoice(invoice) {
  return Array.isArray(invoice?.items)
    ? invoice.items
    : Array.isArray(invoice?.invoice_items)
      ? invoice.invoice_items
      : Array.isArray(invoice?.lines)
        ? invoice.lines
        : [];
}

function itemName(item) {
  return (
    item?.service_name ||
    item?.serviceName ||
    item?.product_name ||
    item?.productName ||
    item?.name ||
    item?.description ||
    "بند"
  );
}

function itemQty(item) {
  return asNumber(item?.quantity ?? item?.qty ?? 1) || 1;
}

function itemTotal(item) {
  const unit = asNumber(
    item?.unit_price ??
      item?.unitPrice ??
      item?.price ??
      item?.total_price ??
      item?.totalPrice,
  );
  return asNumber(
    item?.total_price ?? item?.totalPrice ?? unit * itemQty(item),
  );
}

function invoiceBarber(invoice) {
  const items = rowsFromInvoice(invoice);
  if (!items.length) return "-";
  const names = [
    ...new Set(
      items
        .map(
          (i) =>
            i.barber_name ||
            i.barberName ||
            i.employee_name ||
            i.employeeName ||
            i.employee?.full_name ||
            i.employee?.fullName,
        )
        .filter(Boolean),
    ),
  ];
  if (names.length === 0) return "-";
  if (names.length === 1) return names[0];
  return "متعدد";
}

export default function Invoices() {
  const { settings } = useSalon();
  const { user } = useAuth();

  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [busyPdfId, setBusyPdfId] = useState(null);

  // Adjustment State
  const [adjustmentDialog, setAdjustmentDialog] = useState({
    open: false,
    invoice: null,
    type: "discount",
    reason: "",
    new_value: "",
    notes: "",
    manager_pin: "",
  });
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);

  async function fetchInvoices() {
    try {
      setLoading(true);
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (paymentFilter !== "all") params.payment_method = paymentFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      const [invoiceResponse, adjustmentResponse] = await Promise.allSettled([
        api.get("/invoices", { params }),
        api.get("/invoice-adjustment-requests"),
      ]);
      if (invoiceResponse.status === "fulfilled")
        setInvoices(adaptList(invoiceResponse.value));
      else throw invoiceResponse.reason;
      if (adjustmentResponse.status === "fulfilled")
        setAdjustments(adaptList(adjustmentResponse.value));
      else setAdjustments([]);
    } catch (error) {
      console.error("Invoices load error:", error?.response?.data || error);
      toast.error(apiErrorMessage(error, "فشل تحميل أرشيف الفواتير"));
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
  }, [fromDate, toDate, paymentFilter, statusFilter]);

  const adjustmentByInvoice = useMemo(() => {
    const map = new Map();
    adjustments.forEach((request) => {
      const key = String(
        request.invoice_id || request.invoiceId || request.invoice?.id || "",
      );
      if (!key) return;
      const list = map.get(key) || [];
      list.push(request);
      map.set(key, list);
    });
    return map;
  }, [adjustments]);

  const filteredInvoices = useMemo(() => {
    const text = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (!text) return true;
      return [invoiceNo(invoice), invoiceCustomer(invoice)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [invoices, query]);

  const summary = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, invoice) => {
        acc.count += 1;
        acc.total += invoiceTotal(invoice);
        return acc;
      },
      { count: 0, total: 0 },
    );
  }, [filteredInvoices]);

  async function openInvoicePdf(invoice, retried = false) {
    const id = invoiceId(invoice);
    if (!id) return toast.error("لا يمكن تحديد رقم الفاتورة");
    try {
      setBusyPdfId(id);
      const response = await api.get(`/invoices/${id}/pdf`, {
        params: { inline: true },
        responseType: "blob",
      });
      const file = new Blob([response.data], {
        type: response?.headers?.["content-type"] || "application/pdf",
      });
      const fileUrl = URL.createObjectURL(file);
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    } catch (error) {
      toast.error("تعذر فتح ملف PDF");
    } finally {
      setBusyPdfId(null);
    }
  }

  async function submitAdjustmentRequest() {
    if (!adjustmentDialog.reason) return toast.error("يرجى ذكر سبب التعديل");
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
    } catch (error) {
      toast.error("فشل إرسال الطلب");
    } finally {
      setAdjustmentSubmitting(false);
    }
  }

  return (
    <div className="erp-page-container space-y-8" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
            أرشيف الفواتير
          </h1>
          <p className="text-base font-bold text-slate-500">
            تتبع المبيعات والتدفقات النقدية والرقابة المالية
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {["OWNER", "ADMIN", "MANAGER"].includes(user?.role) && (
            <Button
              variant="outline"
              onClick={() => navigate("/owner/adjustment-requests")}
              className="h-12 rounded-xl border-slate-200"
            >
              <ShieldCheck size={18} className="ml-2" /> طلبات التعديل
            </Button>
          )}
          <Button
            onClick={fetchInvoices}
            disabled={loading}
            className="h-12 px-8 rounded-xl font-black shadow-indigo-500/20"
          >
            <RefreshCw
              size={18}
              className={cn("ml-2", loading && "animate-spin")}
            />{" "}
            تحديث السجلات
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200/60 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-sky-400">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                إجمالي الفواتير
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {summary.count}
              </p>
            </div>
          </div>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200/60 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Zap size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                الصافي النقدي
              </p>
              <p className="text-2xl font-black text-emerald-600">
                {formatCurrency(summary.total)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200/60 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Filter size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                معدل الفلترة
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {filteredInvoices.length} نتيجة
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-visible">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="relative xl:col-span-1">
            <Search
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث برقم الفاتورة..."
              className="h-12 pr-11 bg-slate-50 border-none font-bold"
            />
          </div>
          <div className="flex gap-2 items-center xl:col-span-2">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-12 bg-slate-50 border-none font-black text-xs"
            />
            <span className="text-slate-400 font-bold">إلى</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-12 bg-slate-50 border-none font-black text-xs"
            />
          </div>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-12 bg-slate-50 border-none font-black text-xs rounded-xl">
              <SelectValue placeholder="طريقة الدفع" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 shadow-premium">
              <SelectItem value="all">كل طرق الدفع</SelectItem>
              <SelectItem value="cash">نقدي</SelectItem>
              <SelectItem value="card">شبكة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-12 bg-slate-50 border-none font-black text-xs rounded-xl">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 shadow-premium">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="paid">مدفوعة</SelectItem>
              <SelectItem value="cancelled">ملغاة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Main List - Adaptive View */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4 opacity-50">
            <RefreshCw size={40} className="animate-spin text-indigo-600" />
            <p className="font-black text-slate-500">جاري مراجعة السجلات...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-40">
            <FileText size={64} className="mb-4" />
            <p className="font-black text-lg">لم يتم العثور على أي فواتير</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-right">
                <thead className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      رقم الفاتورة
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      العميل والخبير
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      تاريخ الإصدار
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      وسيلة الدفع
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      الحالة
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                      القيمة النهائية
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-left">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoiceId(invoice)}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                        #{invoiceNo(invoice)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-800 dark:text-slate-200">
                          {invoiceCustomer(invoice)}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                          الخبير: {invoiceBarber(invoice)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">
                        {formatDate(invoiceCreatedAt(invoice))}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className="rounded-lg bg-slate-50 dark:bg-white/5 border-slate-200 text-slate-600 dark:text-slate-400"
                        >
                          {paymentLabels[invoicePayment(invoice)] ||
                            invoicePayment(invoice)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            invoiceStatus(invoice) === "cancelled"
                              ? "danger"
                              : "success"
                          }
                          className="rounded-full px-4"
                        >
                          {statusLabels[invoiceStatus(invoice)] ||
                            invoiceStatus(invoice)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tighter tabular-nums">
                          {formatCurrency(invoiceTotal(invoice))}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl hover:text-indigo-600"
                            onClick={() => setSelectedInvoice(invoice)}
                          >
                            <Eye size={18} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl hover:text-emerald-600"
                            onClick={() =>
                              printThermalReceipt(invoice, settings)
                            }
                          >
                            <Printer size={18} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl hover:text-amber-600"
                            onClick={() =>
                              setAdjustmentDialog({
                                ...adjustmentDialog,
                                open: true,
                                invoice,
                              })
                            }
                          >
                            <ShieldCheck size={18} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {filteredInvoices.map((invoice) => (
                <Card
                  key={invoiceId(invoice)}
                  className="p-5 space-y-4 border-slate-200/60 shadow-sm"
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        فاتورة #{invoiceNo(invoice)}
                      </div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {invoiceCustomer(invoice)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        invoiceStatus(invoice) === "cancelled"
                          ? "danger"
                          : "success"
                      }
                      className="rounded-full"
                    >
                      {statusLabels[invoiceStatus(invoice)]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase">
                        التاريخ
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {formatDate(invoiceCreatedAt(invoice))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase">
                        وسيلة الدفع
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {paymentLabels[invoicePayment(invoice)] ||
                          invoicePayment(invoice)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-black text-emerald-600 tracking-tighter">
                      {formatCurrency(invoiceTotal(invoice))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-10 w-10 rounded-xl hover:text-amber-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAdjustmentDialog({
                            ...adjustmentDialog,
                            open: true,
                            invoice,
                          });
                        }}
                      >
                        <ShieldCheck size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-10 w-10 rounded-xl"
                        onClick={(e) => {
                          e.stopPropagation();
                          printThermalReceipt(invoice, settings);
                        }}
                      >
                        <Printer size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-10 w-10 rounded-xl"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInvoicePdf(invoice);
                        }}
                      >
                        <FileDown size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Invoice Detail Dialog - Now Mobile Friendly & Viewport Locked */}
      <Dialog
        open={Boolean(selectedInvoice)}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
      >
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-sky-400/10 flex items-center justify-center text-indigo-600 dark:text-sky-400">
                <Eye size={20} />
              </div>
              تفاصيل الفاتورة #{selectedInvoice && invoiceNo(selectedInvoice)}
            </DialogTitle>
            <DialogDescription>
              مراجعة بنود الفاتورة والبيانات الضريبية المرتبطة بها
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
            {selectedInvoice && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800">
                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1">
                      العميل
                    </div>
                    <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <User size={14} className="text-indigo-600" />{" "}
                      {invoiceCustomer(selectedInvoice)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800">
                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1">
                      وسيلة السداد
                    </div>
                    <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard size={14} className="text-indigo-600" />{" "}
                      {paymentLabels[invoicePayment(selectedInvoice)] ||
                        invoicePayment(selectedInvoice)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800">
                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1">
                      القيمة الإجمالية
                    </div>
                    <div className="text-xl font-black text-emerald-600 tracking-tighter">
                      {formatCurrency(invoiceTotal(selectedInvoice))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <Activity size={12} /> بنود الخدمة والمنتجات
                  </h4>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    {rowsFromInvoice(selectedInvoice).map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 flex items-center justify-between border-b last:border-0 border-slate-50 dark:border-slate-800"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                            {itemName(item)}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400">
                            الخبير:{" "}
                            {item.barber_name || item.employee_name || "-"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                            {formatCurrency(itemTotal(item))}
                          </div>
                          <div className="text-[9px] font-bold text-slate-400">
                            الكمية: {itemQty(item)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl font-black h-12"
              onClick={() => setSelectedInvoice(null)}
            >
              إغلاق النافذة
            </Button>
            <Button
              className="rounded-xl font-black h-12 px-8 bg-indigo-600 shadow-indigo-500/20"
              onClick={() => printThermalReceipt(selectedInvoice, settings)}
            >
              <Printer size={18} className="ml-2" /> طباعة إيصال حراري
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Request Dialog - Refined */}
      <Dialog
        open={adjustmentDialog.open}
        onOpenChange={(open) => setAdjustmentDialog((p) => ({ ...p, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <ShieldCheck size={20} />
              </div>
              تعديل مالي رقابي
            </DialogTitle>
            <DialogDescription>
              سيتم تسجيل هذا الإجراء في سجلات الرقابة وتنبيه الإدارة
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">
                نوع التعديل
              </label>
              <Select
                value={adjustmentDialog.type}
                onValueChange={(v) =>
                  setAdjustmentDialog((p) => ({ ...p, type: v }))
                }
              >
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-premium">
                  <SelectItem value="discount">تعديل الخصم</SelectItem>
                  <SelectItem value="payment_method">طريقة الدفع</SelectItem>
                  <SelectItem value="void">إلغاء الفاتورة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">
                السبب الفني
              </label>
              <textarea
                className="w-full h-24 rounded-xl bg-slate-50 p-4 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="لماذا يجب تعديل هذه الفاتورة؟"
                value={adjustmentDialog.reason}
                onChange={(e) =>
                  setAdjustmentDialog((p) => ({ ...p, reason: e.target.value }))
                }
              />
            </div>

            {adjustmentDialog.type !== "void" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500">
                  {adjustmentDialog.type === "discount"
                    ? "قيمة الخصم الجديدة"
                    : "القيمة الجديدة"}
                </label>
                <Input
                  placeholder="أدخل القيمة المطلوبة..."
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                  value={adjustmentDialog.new_value}
                  onChange={(e) =>
                    setAdjustmentDialog((p) => ({
                      ...p,
                      new_value: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">
                كود المدير (للاعتماد الفوري)
              </label>
              <Input
                type="password"
                placeholder="****"
                className="h-12 rounded-xl bg-slate-50 border-none font-black text-center tracking-[0.5em]"
                value={adjustmentDialog.manager_pin}
                onChange={(e) =>
                  setAdjustmentDialog((p) => ({
                    ...p,
                    manager_pin: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="h-12 rounded-xl font-black text-slate-400"
              onClick={() =>
                setAdjustmentDialog((p) => ({ ...p, open: false }))
              }
            >
              تراجع
            </Button>
            <Button
              className="h-12 rounded-xl font-black px-8 bg-amber-600 shadow-amber-500/20"
              loading={adjustmentSubmitting}
              onClick={submitAdjustmentRequest}
            >
              تأكيد الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
