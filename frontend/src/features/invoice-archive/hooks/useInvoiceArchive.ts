import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { formatCurrency } from "@/lib/core/utils";

const PAYMENT_LABELS = {
  cash: "نقدي",
  card: "شبكة",
  visa: "فيزا",
  mada: "مدى",
  wallet: "محفظة",
  instapay: "انستا باي",
};

function fmtLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(value: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    return "";
  }
}

function daysInMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function useInvoiceArchive() {
  const [months, setMonths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [closingMonth, setClosingMonth] = useState<any>(null);

  const [confirmClose, setConfirmClose] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [expandedKey, setExpandedKey] = useState<any>(null);

  const [monthInvoices, setMonthInvoices] = useState<Record<string, any>>({});
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [loadingMoreKey, setLoadingMoreKey] = useState<any>(null);

  const [confirmReopen, setConfirmReopen] = useState<any>(null);

  const [reopeningMonth, setReopeningMonth] = useState<any>(null);

  const buildMonthRange = useCallback((key: string) => {
    const [y, m] = key.split("-").map(Number);
    return {
      from_date: fmtLocalDate(new Date(y, m - 1, 1)),
      to_date: fmtLocalDate(new Date(y, m, 0)),
    };
  }, []);

  const loadArchive = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/invoices/archive/monthly");
      setMonths(res.data || []);
    } catch (err) {
      console.error("Load archive error");
      toast.error("فشل تحميل الأرشيف");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  const fetchMonthInvoices = useCallback(async (key: string, skip = 0) => {
    const params: Record<string, unknown> = { ...buildMonthRange(key), limit: 200 };
    if (skip) params.skip = skip;
    const res = await api.get("/invoices", { params });
    const raw = res.data || {};
    const items = Array.isArray(raw) ? raw : raw.items || [];
    return {
      items,
      total: typeof raw.total === "number" ? raw.total : items.length,
    };
  }, [buildMonthRange]);

  const toggleExpand = useCallback(async (month: any) => {
    const key = month.key;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (monthInvoices[key]) return;
    try {
      setInvoicesLoading(true);
      const data = await fetchMonthInvoices(key);
      setMonthInvoices((prev) => ({ ...prev, [key]: data }));
    } catch (err) {
      console.error("Load month invoices error");
      toast.error("فشل تحميل فواتير الشهر");
      setExpandedKey(null);
    } finally {
      setInvoicesLoading(false);
    }
  }, [expandedKey, monthInvoices, fetchMonthInvoices]);

  const loadMoreInvoices = useCallback(async (month: any) => {
    const key = month.key;
    const existing = monthInvoices[key];
    if (!existing) return;
    try {
      setLoadingMoreKey(key);
      const data = await fetchMonthInvoices(key, existing.items.length);
      setMonthInvoices((prev) => ({
        ...prev,
        [key]: {
          items: [...existing.items, ...data.items],
          total: data.total,
        },
      }));
    } catch (err) {
      toast.error("فشل تحميل المزيد من الفواتير");
    } finally {
      setLoadingMoreKey(null);
    }
  }, [monthInvoices, fetchMonthInvoices]);

  const handleReopenMonth = useCallback(async (yearMonth: string) => {
    try {
      setReopeningMonth(yearMonth);
      await api.post(`/invoices/archive/monthly/${yearMonth}/reopen`);
      toast.success(`تم إعادة فتح شهر ${yearMonth} للمراجعة`);
      setConfirmReopen(null);
      setMonthInvoices((prev) => {
        const next = { ...prev };
        delete next[yearMonth];
        return next;
      });
      loadArchive();
    } catch (err) {
      toast.error("فشل إعادة فتح الشهر");
    } finally {
      setReopeningMonth(null);
    }
  }, [loadArchive]);

  const summary = useMemo(() => {
    if (!months.length) return null;
    const totalRevenue = months.reduce((s, m) => s + (m.total_amount || 0), 0);
    const totalInvoices = months.reduce(
      (s, m) => s + (m.invoice_count || 0),
      0,
    );
    const totalPaid = months.reduce((s, m) => s + (m.paid_count || 0), 0);
    const closedCount = months.filter((m) => m.is_closed).length;
    const avg = totalRevenue / Math.max(1, months.length);
    const best = [...months].sort(
      (a, b) => (b.total_amount || 0) - (a.total_amount || 0),
    )[0];
    return {
      totalRevenue,
      totalInvoices,
      totalPaid,
      closedCount,
      avg,
      best,
    };
  }, [months]);

  const maxRevenue = useMemo(
    () => Math.max(...months.map((m) => m.total_amount || 0), 1),
    [months],
  );

  const comparison = useMemo(() => {
    if (months.length < 2) return null;
    const current = months[0];
    const previous = months[1];
    const diff = (current.total_amount || 0) - (previous.total_amount || 0);
    const pct =
      previous.total_amount > 0
        ? ((diff / previous.total_amount) * 100).toFixed(1)
        : 0;
    const invDiff =
      (current.invoice_count || 0) - (previous.invoice_count || 0);
    return { current, previous, diff, pct, invDiff };
  }, [months]);

  const filteredMonths = useMemo(() => {
    let list = months;
    if (statusFilter === "closed") list = list.filter((m) => m.is_closed);
    if (statusFilter === "open") list = list.filter((m) => !m.is_closed);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          (m.label_ar || "").toLowerCase().includes(q) ||
          (m.key || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [months, search, statusFilter]);

  const handleExportPDF = useCallback(async () => {
    if (!months.length) return toast.error("لا توجد بيانات للتصدير");
    try {
      toast.loading("جاري إنشاء التقرير...", { id: "pdf" });
      // Lazy-load the heavy PDF libs only when the user actually exports (~430KB saved).
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      doc.setFillColor(28, 25, 23);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 90, "F");
      doc.setTextColor(212, 175, 55);
      doc.setFontSize(20);
      doc.text("تقرير الأرشيف الشهري للفواتير", 40, 45);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(
        `تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}`,
        40,
        65,
      );
      doc.text(`عدد الأشهر: ${months.length}`, 40, 80);

      const totalRevenue = months.reduce((s, m) => s + m.total_amount, 0);
      const totalInvoices = months.reduce((s, m) => s + m.invoice_count, 0);
      const totalPaid = months.reduce((s, m) => s + m.paid_count, 0);
      const closed = months.filter((m) => m.is_closed).length;

      doc.setFontSize(9);
      doc.text(`إجمالي المبيعات: ${formatCurrency(totalRevenue)}`, 220, 65);
      doc.text(`إجمالي الفواتير: ${totalInvoices}`, 220, 80);
      doc.text(`مدفوعة: ${totalPaid}`, 380, 65);
      doc.text(`أشهر مغلقة: ${closed}`, 380, 80);

      const tableData = months.map((m) => [
        m.label_ar,
        m.invoice_count.toString(),
        formatCurrency(m.total_amount),
        m.paid_count.toString(),
        m.is_closed ? "مغلق" : "مفتوح",
        m.change_percent !== undefined && m.change_percent !== 0
          ? `${m.change_percent > 0 ? "+" : ""}${m.change_percent}%`
          : "—",
      ]);

      autoTable(doc, {
        startY: 105,
        head: [
          ["الشهر", "الفواتير", "المبيعات", "مدفوعة", "الحالة", "التغيير"],
        ],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 6, halign: "right" },
        headStyles: {
          fillColor: [41, 37, 36],
          textColor: [212, 175, 55],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 243, 240] },
      });

      doc.save(`invoice-archive-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("تم تصدير التقرير بنجاح", { id: "pdf" });
    } catch (err) {
      toast.error("فشل تصدير التقرير", { id: "pdf" });
    }
  }, [months]);

  const handleCloseMonth = useCallback(async (yearMonth: string) => {
    try {
      setClosingMonth(yearMonth);
      await api.post(`/invoices/archive/monthly/${yearMonth}/close`);
      toast.success(`تم إغلاق شهر ${yearMonth} بنجاح`);
      setConfirmClose(null);
      loadArchive();
    } catch (err) {
      toast.error("فشل إغلاق الشهر");
    } finally {
      setClosingMonth(null);
    }
  }, [loadArchive]);

  return {
    months,
    loading,
    closingMonth,
    confirmClose,
    setConfirmClose,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    expandedKey,
    monthInvoices,
    invoicesLoading,
    loadingMoreKey,
    confirmReopen,
    setConfirmReopen,
    reopeningMonth,
    toggleExpand,
    loadMoreInvoices,
    handleReopenMonth,
    summary,
    maxRevenue,
    comparison,
    filteredMonths,
    handleExportPDF,
    handleCloseMonth,
    daysInMonth,
    PAYMENT_LABELS,
    fmtTime,
  };
}
