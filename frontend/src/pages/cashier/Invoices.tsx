import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Filter,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Eye,
  FileDown,
  Activity,
  CreditCard,
  Zap,
  Receipt,
  Archive,
  ChevronUp,
  ChevronDown,
  Download,
  Columns,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useSalon } from "@/context/SalonContext";
import { printThermalReceipt } from "@/lib/print/receipt";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, getApiErrorMessage, formatCurrency as formatCurrencyShared } from "@/lib/core/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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

function asNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value) {
  return formatCurrencyShared(value);
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
  } catch (err) {
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
  if (invoice?.barber_name) return invoice.barber_name;
  if (invoice?.barberName) return invoice.barberName;
  if (invoice?.employee_name) return invoice?.employee_name;

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

function isInvoiceEditable(invoice) {
  if (!invoice) return false;
  const createdAt = invoice.created_at || invoice.createdAt || invoice.date;
  if (!createdAt) return true;

  const createdTime = new Date(createdAt).getTime();
  const now = new Date().getTime();
  const oneHourInMs = 60 * 60 * 1000;

  return now - createdTime <= oneHourInMs;
}

export default function Invoices() {
  const { settings } = useSalon();
  const { user } = useAuth();

  const navigate = useNavigate();
   
  const [invoices, setInvoices] = useState<any[]>([]);
   
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
   
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
   
  const [busyPdfId, setBusyPdfId] = useState<any>(null);
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

  async function fetchInvoices() {
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
        toast.error(getApiErrorMessage(apiErr, "فشل تحميل أرشيف الفواتير"));
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
  }

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
     
  }, [fromDate, toDate, paymentFilter, statusFilter, currentPage]);

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
    const getValue = (invoice) => {
      switch (key) {
        case "invoiceNo":
          return invoiceNo(invoice);
        case "customer":
          return invoiceCustomer(invoice);
        case "date":
          return new Date(invoiceCreatedAt(invoice) || 0).getTime();
        case "payment":
          return invoicePayment(invoice);
        case "status":
          return invoiceStatus(invoice);
        case "amount":
          return invoiceTotal(invoice);
        case "created_at":
        default:
          return new Date(invoiceCreatedAt(invoice) || 0).getTime();
      }
    };

    filtered.sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [invoices, query, sortConfig]);

  const summary = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, invoice) => {
        acc.count += 1;
        acc.total += invoiceTotal(invoice);
        if (invoiceStatus(invoice) === "paid") acc.paid += 1;
        return acc;
      },
      { count: 0, total: 0, paid: 0 },
    );
  }, [filteredInvoices]);

  const averageInvoice = summary.count ? summary.total / summary.count : 0;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const pendingAdjustments = adjustments.filter(
    (request) =>
      String(request.status || request.request_status || "").toLowerCase() ===
      "pending",
  ).length;

  async function openInvoicePdf(invoice) {
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
  }

  async function submitAdjustmentRequest() {
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
  }

  const exportToCSV = useCallback(() => {
    if (!filteredInvoices.length) return toast.error("لا توجد بيانات للتصدير");

    const headers = [
      { key: "invoiceNo", label: "رقم الفاتورة" },
      { key: "customer", label: "العميل" },
      { key: "barber", label: "الخبير" },
      { key: "date", label: "التاريخ" },
      { key: "payment", label: "وسيلة الدفع" },
      { key: "status", label: "الحالة" },
      { key: "amount", label: "القيمة" },
    ];

    const rows = filteredInvoices.map((inv) => ({
      invoiceNo: `#${invoiceNo(inv)}`,
      customer: invoiceCustomer(inv),
      barber: invoiceBarber(inv),
      date: formatDate(invoiceCreatedAt(inv)),
      payment: paymentLabels[invoicePayment(inv)] || invoicePayment(inv),
      status: statusLabels[invoiceStatus(inv)] || invoiceStatus(inv),
      amount: formatCurrency(invoiceTotal(inv)),
    }));

    const csvContent = [
      headers.map((h) => h.label).join(","),
      ...rows.map((r) => headers.map((h) => `"${r[h.key]}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("تم تصدير البيانات بنجاح");
  }, [filteredInvoices]);

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5 px-3 pt-4 sm:px-4 lg:px-6 lg:space-y-6">
        <PageHeader className={undefined}
          title="الفواتير"
          subtitle="تتبع المبيعات وإدارة الفواتير والمدفوعات"
          badge="العمليات المالية"
          icon={Receipt}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {["OWNER", "ADMIN", "MANAGER"].includes(user?.role ?? "") && (
                <Button
                  variant="outline"
                  className="h-10 rounded-xl px-3"
                  onClick={() => navigate("/owner/adjustment-requests")}
                >
                  <ShieldCheck size={14} className="ml-1.5" />
                  <span className="hidden sm:inline">طلبات التعديل</span>
                </Button>
              )}
              <Button
                variant="outline"
                className="h-10 rounded-xl px-3"
                onClick={() => navigate("/invoices/archive")}
              >
                <Archive size={14} className="ml-1.5" />
                <span className="hidden sm:inline">الأرشيف</span>
              </Button>
              <Button
                onClick={fetchInvoices}
                disabled={loading}
                className="h-10 rounded-xl px-3"
              >
                <RefreshCw
                  size={14}
                  className={cn("ml-1.5", loading && "animate-spin")}
                />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform group-hover:scale-105 sm:flex">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  إجمالي الفواتير
                </div>
                <div className="text-lg font-black tabular-nums text-main sm:text-xl">
                  {summary.count}
                </div>
              </div>
              <span className="shrink-0 text-[8px] font-black text-muted sm:text-[9px]">
                {filteredInvoices.length}
              </span>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success transition-transform group-hover:scale-105 sm:flex">
                <Zap size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  الصافي النقدي
                </div>
                <div className="truncate text-lg font-black tabular-nums text-main sm:text-xl">
                  {formatCurrency(summary.total)}
                </div>
              </div>
              <span className="hidden shrink-0 rounded-md bg-success-soft px-1.5 py-0.5 text-[8px] font-black text-success sm:inline-block">
                {summary.paid} مدفوعة
              </span>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info transition-transform group-hover:scale-105 sm:flex">
                <CreditCard size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  متوسط الفاتورة
                </div>
                <div className="truncate text-lg font-black tabular-nums text-main sm:text-xl">
                  {formatCurrency(averageInvoice)}
                </div>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning transition-transform group-hover:scale-105 sm:flex">
                <Filter size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  نتائج البحث
                </div>
                <div className="text-lg font-black tabular-nums text-main sm:text-xl">
                  {filteredInvoices.length}
                </div>
              </div>
              {pendingAdjustments > 0 && (
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-[8px] font-black text-danger">
                  <Activity size={8} /> {pendingAdjustments}
                </span>
              )}
            </div>
          </PremiumCard>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card shadow-soft">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/50 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "today", label: "اليوم" },
                { key: "week", label: "الأسبوع" },
                { key: "month", label: "الشهر" },
                { key: "last_month", label: "الشهر الماضي" },
              ].map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => {
                    const sp = new URLSearchParams(window.location.search);
                    if (sp.has("month")) {
                      sp.delete("month");
                      const q = sp.toString();
                      window.history.replaceState(
                        null,
                        "",
                        `${window.location.pathname}${q ? `?${q}` : ""}`,
                      );
                    }
                    setTimePreset(preset.key);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "h-8 whitespace-nowrap rounded-lg px-3 text-[10px] font-black transition-all sm:h-9 sm:rounded-xl sm:px-4",
                    timePreset === preset.key
                      ? "bg-primary text-white shadow-sm"
                      : "bg-soft text-muted hover:bg-card hover:text-main",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {(fromDate || toDate) && (
              <div className="ms-auto flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-soft px-2 py-1 text-[9px] font-bold text-primary">
                <span className="tabular-nums">{fromDate || "..."}</span>
                <span>←</span>
                <span className="tabular-nums">{toDate || "..."}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 p-3 sm:gap-3 sm:p-4 md:grid-cols-2 xl:grid-cols-12">
            <div className="relative xl:col-span-4">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
                size={14}
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث برقم الفاتورة أو اسم العميل..."
                className="h-10 w-full pr-9 text-sm sm:h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 xl:col-span-3">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 w-full min-w-0 text-xs font-bold sm:h-11"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 w-full min-w-0 text-xs font-bold sm:h-11"
              />
            </div>
            <div className="xl:col-span-2">
              <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-xl font-bold sm:h-11">
                  <SelectValue placeholder="طريقة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل طرق الدفع</SelectItem>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="card">شبكة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="xl:col-span-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-xl font-bold sm:h-11">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="paid">مدفوعة</SelectItem>
                  <SelectItem value="cancelled">ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-2 xl:col-span-1">
              <Popover
                open={showColumnPicker}
                onOpenChange={setShowColumnPicker}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
                    title="إظهار/إخفاء الأعمدة"
                  >
                    <Columns size={16} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" side="bottom" align="end">
                  <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                      الأعمدة
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => setShowColumnPicker(false)}
                    >
                      <X size={10} />
                    </Button>
                  </div>
                  <div className="space-y-0.5 py-1">
                    {[
                      { key: "invoiceNo", label: "رقم الفاتورة" },
                      { key: "customer", label: "العميل والخبير" },
                      { key: "date", label: "التاريخ" },
                      { key: "payment", label: "وسيلة الدفع" },
                      { key: "status", label: "الحالة" },
                      { key: "amount", label: "القيمة" },
                      { key: "actions", label: "الإجراءات" },
                    ].map((col) => (
                      <label
                        key={col.key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-soft"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.key]}
                          onChange={() => toggleColumn(col.key)}
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-bold text-main">
                          {col.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
                onClick={exportToCSV}
                title="تصدير CSV"
              >
                <Download size={16} />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          {loading ? (
            <div className="space-y-2 p-3 sm:p-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-border/30 bg-soft/30 p-3 sm:gap-4"
                >
                  <div className="h-8 w-14 shrink-0 rounded-lg bg-soft animate-pulse sm:w-16" />
                  <div className="hidden h-4 w-20 rounded-lg bg-soft animate-pulse sm:block" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-soft animate-pulse sm:w-1/2" />
                    <div className="h-2 w-1/3 rounded bg-soft animate-pulse" />
                  </div>
                  <div className="h-6 w-16 rounded-lg bg-soft animate-pulse" />
                  <div className="h-6 w-20 rounded-lg bg-soft animate-pulse" />
                  <div className="hidden h-8 w-32 rounded-xl bg-soft animate-pulse sm:block" />
                </div>
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:py-24">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-soft sm:h-20 sm:w-20">
                <FileText size={28} className="text-muted sm:hidden" />
                <FileText size={36} className="hidden text-muted sm:block" />
              </div>
              <div>
                <p className="text-base font-black text-main sm:text-lg">
                  لم يتم العثور على أي فواتير
                </p>
                <p className="mt-1 text-xs font-bold text-muted sm:text-sm">
                  جرّب تغيير نطاق التاريخ أو معايير البحث
                </p>
              </div>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => {
                  setQuery("");
                  setPaymentFilter("all");
                  setStatusFilter("all");
                  setTimePreset("month");
                }}
              >
                <RefreshCw size={14} className="ml-1.5" /> إعادة تعيين الفلاتر
              </Button>
            </div>
          ) : (
            <div className="table-wrapper overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    {visibleColumns.invoiceNo && (
                      <TableHead
                        className="cursor-pointer select-none hover:bg-soft/50 transition-colors"
                        onClick={() => handleSort("invoiceNo")}
                      >
                        <div className="flex items-center gap-1">
                          <span className="hidden xs:inline">رقم </span>الفاتورة
                          {sortConfig.key === "invoiceNo" &&
                            (sortConfig.direction === "asc" ? (
                              <ChevronUp size={11} className="text-primary" />
                            ) : (
                              <ChevronDown size={11} className="text-primary" />
                            ))}
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.customer && (
                      <TableHead
                        className="cursor-pointer select-none hover:bg-soft/50 transition-colors"
                        onClick={() => handleSort("customer")}
                      >
                        <div className="flex items-center gap-1">
                          العميل
                          {sortConfig.key === "customer" &&
                            (sortConfig.direction === "asc" ? (
                              <ChevronUp size={11} className="text-primary" />
                            ) : (
                              <ChevronDown size={11} className="text-primary" />
                            ))}
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.date && (
                      <TableHead
                        className="cursor-pointer select-none hover:bg-soft/50 transition-colors"
                        onClick={() => handleSort("date")}
                      >
                        <div className="flex items-center gap-1">
                          التاريخ
                          {sortConfig.key === "date" &&
                            (sortConfig.direction === "asc" ? (
                              <ChevronUp size={11} className="text-primary" />
                            ) : (
                              <ChevronDown size={11} className="text-primary" />
                            ))}
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.payment && <TableHead>الدفع</TableHead>}
                    {visibleColumns.status && <TableHead>الحالة</TableHead>}
                    {visibleColumns.amount && (
                      <TableHead
                        className="text-left cursor-pointer select-none hover:bg-soft/50 transition-colors"
                        onClick={() => handleSort("amount")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          القيمة
                          {sortConfig.key === "amount" &&
                            (sortConfig.direction === "asc" ? (
                              <ChevronUp size={11} className="text-primary" />
                            ) : (
                              <ChevronDown size={11} className="text-primary" />
                            ))}
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.actions && (
                      <TableHead className="text-center">إجراءات</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoiceId(invoice)}
                      className="group/row cursor-pointer transition-colors hover:bg-primary-soft/30"
                      onClick={() => setSelectedInvoice(invoice)}
                    >
                      {visibleColumns.invoiceNo && (
                        <TableCell className="w-[80px] font-black text-main tabular-nums">
                          #{invoiceNo(invoice)}
                        </TableCell>
                      )}
                      {visibleColumns.customer && (
                        <TableCell className="min-w-[140px]">
                          <div
                            className="max-w-[200px] truncate font-black text-main"
                            title={invoiceCustomer(invoice)}
                          >
                            {invoiceCustomer(invoice)}
                          </div>
                          <div className="text-[9px] font-bold text-primary">
                            الخبير: {invoiceBarber(invoice)}
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.date && (
                        <TableCell className="whitespace-nowrap text-[10px] font-bold text-muted">
                          {formatDate(invoiceCreatedAt(invoice))}
                        </TableCell>
                      )}
                      {visibleColumns.payment && (
                        <TableCell>
                          <Badge size="sm" className="h-5 font-bold uppercase">
                            {paymentLabels[invoicePayment(invoice)] ||
                              invoicePayment(invoice)}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.status && (
                        <TableCell>
                          <Badge
                            variant={
                              invoiceStatus(invoice) === "cancelled"
                                ? "danger"
                                : "success"
                            }
                            size="sm"
                            className="h-5 font-bold"
                          >
                            {statusLabels[invoiceStatus(invoice)] ||
                              invoiceStatus(invoice)}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.amount && (
                        <TableCell className="whitespace-nowrap text-left">
                          <span className="font-black tabular-nums text-primary">
                            {formatCurrency(invoiceTotal(invoice))}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.actions && (
                        <TableCell
                          className="w-[1%] whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-60 sm:opacity-40 transition-opacity hover:opacity-100 hover:text-primary group-hover/row:opacity-100 sm:group-hover/row:opacity-80 sm:h-8 sm:w-8"
                              onClick={() => setSelectedInvoice(invoice)}
                              title="تفاصيل"
                            >
                              <Eye size={13} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-60 sm:opacity-40 transition-opacity hover:opacity-100 hover:text-primary group-hover/row:opacity-100 sm:group-hover/row:opacity-80 sm:h-8 sm:w-8"
                              onClick={() =>
                                printThermalReceipt(invoice, settings)
                              }
                              title="طباعة"
                            >
                              <Printer size={13} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-60 sm:opacity-40 transition-opacity hover:opacity-100 hover:text-primary group-hover/row:opacity-100 sm:group-hover/row:opacity-80 sm:h-8 sm:w-8"
                              onClick={() => openInvoicePdf(invoice)}
                              disabled={busyPdfId === invoiceId(invoice)}
                              title="PDF"
                            >
                              <FileDown size={13} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-7 w-7 transition-all group-hover/row:opacity-80 sm:h-8 sm:w-8",
                                isInvoiceEditable(invoice)
                                  ? "opacity-40 text-warning hover:bg-warning-soft hover:opacity-100"
                                  : "cursor-not-allowed opacity-20 text-muted",
                              )}
                              onClick={() => {
                                if (!isInvoiceEditable(invoice)) {
                                  toast.error("انتهت فترة التعديل (ساعة)");
                                  return;
                                }
                                setAdjustmentDialog({
                                  ...adjustmentDialog,
                                  open: true,
                                  invoice,
                                });
                              }}
                              title={
                                !isInvoiceEditable(invoice)
                                  ? "انتهت فترة التعديل"
                                  : "طلب تعديل"
                              }
                            >
                              <ShieldCheck size={13} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && filteredInvoices.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
              <p className="text-[10px] font-bold text-muted sm:text-xs">
                عرض{" "}
                <span className="tabular-nums">
                  {filteredInvoices.length ? (currentPage - 1) * pageSize + 1 : 0}
                </span>{" "}
                -{" "}
                <span className="tabular-nums">
                  {Math.min(currentPage * pageSize, totalCount || filteredInvoices.length)}
                </span>{" "}
                من{" "}
                <span className="tabular-nums">{totalCount || filteredInvoices.length}</span>
                {totalCount > filteredInvoices.length ? <span className="text-[9px] text-muted/60"> (الصفحة الحالية {filteredInvoices.length})</span> : null}
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-[10px] sm:h-9 sm:px-3"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  السابق
                </Button>
                <PageNumbers
                  currentPage={currentPage}
                  total={totalCount || filteredInvoices.length}
                  pageSize={pageSize}
                  onNavigate={setCurrentPage}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-[10px] sm:h-9 sm:px-3"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage >= totalPages || invoices.length < pageSize}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>

        <Dialog
          open={Boolean(selectedInvoice)}
          onOpenChange={(open) => !open && setSelectedInvoice(null)}
        >
          <DialogContent className="max-w-lg sm:max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black sm:text-xl">
                تفاصيل الفاتورة #{selectedInvoice && invoiceNo(selectedInvoice)}
              </DialogTitle>
              {selectedInvoice && (
                <DialogDescription className="text-[10px] font-bold text-muted">
                  أُنشئت في {formatDate(invoiceCreatedAt(selectedInvoice))}
                </DialogDescription>
              )}
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-border bg-soft p-3 sm:p-4">
                    <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[9px]">
                      العميل
                    </p>
                    <p className="truncate font-black text-main sm:text-sm">
                      {invoiceCustomer(selectedInvoice)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-soft p-3 sm:p-4">
                    <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[9px]">
                      وسيلة الدفع
                    </p>
                    <p className="font-black text-main sm:text-sm">
                      {paymentLabels[invoicePayment(selectedInvoice)] ||
                        invoicePayment(selectedInvoice)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary-soft bg-primary-soft p-3 sm:p-4">
                    <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-primary sm:text-[9px]">
                      الإجمالي
                    </p>
                    <p className="text-base font-black tabular-nums text-primary sm:text-xl">
                      {formatCurrency(invoiceTotal(selectedInvoice))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-soft p-3 sm:p-4">
                    <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[9px]">
                      الخبير
                    </p>
                    <p className="truncate font-black text-main sm:text-sm">
                      {invoiceBarber(selectedInvoice)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 sm:px-4 sm:py-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                      بنود الفاتورة
                    </h4>
                    <Badge size="sm">
                      {rowsFromInvoice(selectedInvoice).length} بند
                    </Badge>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto sm:max-h-[400px]">
                    <Table>
                      <TableHeader className="bg-soft/30">
                        <TableRow>
                          <TableHead className="text-[10px]">البند</TableHead>
                          <TableHead className="text-center text-[10px]">
                            الكمية
                          </TableHead>
                          <TableHead className="text-left text-[10px]">
                            السعر
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rowsFromInvoice(selectedInvoice).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <p className="text-xs font-black text-main sm:text-sm">
                                {itemName(item)}
                              </p>
                              <p className="mt-0.5 text-[8px] font-bold uppercase text-primary sm:text-[9px]">
                                الخبير:{" "}
                                {item.barber_name ||
                                  item.barberName ||
                                  item.employee_name ||
                                  invoiceBarber(selectedInvoice)}
                              </p>
                            </TableCell>
                            <TableCell className="text-center font-black tabular-nums">
                              {itemQty(item)}
                            </TableCell>
                            <TableCell className="text-left font-black tabular-nums text-main">
                              {formatCurrency(itemTotal(item))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 pt-3 sm:pt-4">
              <Button
                variant="outline"
                onClick={() => setSelectedInvoice(null)}
                className="h-10 rounded-xl px-4 sm:h-11 sm:px-6"
              >
                إغلاق
              </Button>
              <Button
                onClick={() => printThermalReceipt(selectedInvoice, settings)}
                className="h-10 rounded-xl px-4 sm:h-11 sm:px-6 premium-button"
              >
                <Printer size={14} className="ml-2 sm:hidden" />
                <Printer size={16} className="ml-2 hidden sm:block" /> طباعة
                إيصال
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={adjustmentDialog.open}
          onOpenChange={(open) => setAdjustmentDialog((p) => ({ ...p, open }))}
        >
          <DialogContent className="max-w-sm sm:max-w-md" dir="rtl">
            <DialogHeader>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-soft text-warning sm:h-12 sm:w-12">
                <ShieldCheck size={20} />
              </div>
              <DialogTitle className="text-center text-lg font-black sm:text-xl">
                تعديل مالي رقابي
              </DialogTitle>
              <DialogDescription className="text-center text-[10px] font-bold text-muted sm:text-[11px]">
                طلبات التعديل تمر بمراجعة المدير قبل الاعتماد
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 p-0.5 sm:space-y-5 sm:p-1">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                  نوع التعديل
                </label>
                <Select
                  value={adjustmentDialog.type}
                  onValueChange={(v) =>
                    setAdjustmentDialog((p) => ({ ...p, type: v }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl font-black sm:h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount" className="font-bold">
                      تعديل الخصم
                    </SelectItem>
                    <SelectItem value="payment_method" className="font-bold">
                      طريقة الدفع
                    </SelectItem>
                    <SelectItem value="void" className="font-bold">
                      إلغاء الفاتورة
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                  السبب
                </label>
                <textarea
                  className="h-20 w-full rounded-xl border border-border bg-soft p-3 text-sm font-bold transition-all placeholder:text-muted/40 focus:outline-none focus:ring-4 focus:ring-primary/10 sm:h-24 sm:p-4"
                  placeholder="لماذا يجب التعديل؟ يرجى ذكر التفاصيل..."
                  value={adjustmentDialog.reason}
                  onChange={(e) =>
                    setAdjustmentDialog((p) => ({
                      ...p,
                      reason: e.target.value,
                    }))
                  }
                />
              </div>

              {adjustmentDialog.type !== "void" && (
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    القيمة الجديدة
                  </label>
                  <Input
                    value={adjustmentDialog.new_value}
                    onChange={(e) =>
                      setAdjustmentDialog((p) => ({
                        ...p,
                        new_value: e.target.value,
                      }))
                    }
                    placeholder="أدخل القيمة الجديدة..."
                    className="h-10 text-center font-black sm:h-11"
                  />
                </div>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                  كود المدير (للاعتماد)
                </label>
                <Input
                  type="password"
                  value={adjustmentDialog.manager_pin}
                  onChange={(e) =>
                    setAdjustmentDialog((p) => ({
                      ...p,
                      manager_pin: e.target.value,
                    }))
                  }
                  className="h-10 text-center font-black tracking-[1em] sm:h-11"
                  placeholder="••••"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4 sm:pt-6">
              <Button
                variant="ghost"
                onClick={() =>
                  setAdjustmentDialog((p) => ({ ...p, open: false }))
                }
                className="h-10 rounded-xl sm:h-11"
              >
                تراجع
              </Button>
              <Button
                variant="warning"
                loading={adjustmentSubmitting}
                onClick={submitAdjustmentRequest}
                className="h-10 rounded-xl px-6 font-black sm:h-11 sm:px-8"
              >
                تأكيد الطلب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

interface PageNumbersProps {
  currentPage: number;
  total: number;
  pageSize: number;
  onNavigate: (page: number) => void;
}

function PageNumbers({ currentPage, total, pageSize, onNavigate }: PageNumbersProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const items: (number | string)[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (pageCount > 7 && i > 3 && i < pageCount - 2) {
      if (!items.includes("…")) items.push("…");
      i = pageCount - 3;
      continue;
    }
    items.push(i);
  }
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {items.map((item, idx) =>
        item === "…" ? (
          <span
            key={`d-${idx}`}
            className="px-0.5 text-[10px] font-black text-muted sm:px-1 sm:text-xs"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onNavigate(item as number)}
            className={cn(
              "h-8 min-w-7 rounded-lg px-1.5 text-[10px] font-black transition-all sm:h-9 sm:min-w-9 sm:px-2 sm:text-[11px]",
              item === currentPage
                ? "bg-primary text-white shadow-sm"
                : "bg-soft text-muted hover:bg-card hover:text-main",
            )}
          >
            {item}
          </button>
        ),
      )}
    </div>
  );
}
