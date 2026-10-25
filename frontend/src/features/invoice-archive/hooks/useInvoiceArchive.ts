import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import {
  formatCurrency,
  getApiErrorMessage,
} from "@/lib/core/utils";
import {
  invoiceId,
  paymentLabels,
} from "@/features/invoices";
import type {
  ArchiveComparison,
  ArchiveMonth,
  ArchiveSummary,
  MonthInvoice,
  MonthInvoicePage,
} from "@/features/invoice-archive/types";

const MONTH_PAGE_SIZE = 200;

function fmtLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusLabel(month: ArchiveMonth) {
  if (month.status === "locked") return "مقفل";
  if (month.status === "partial") return "جزئي";
  return "مفتوح";
}

function changeLabel(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function useInvoiceArchive() {
  const [months, setMonths] = useState<ArchiveMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [monthInvoices, setMonthInvoices] = useState<
    Record<string, MonthInvoicePage>
  >({});
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<ArchiveMonth | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<ArchiveMonth | null>(null);
  const [closingMonth, setClosingMonth] = useState<string | null>(null);
  const [reopeningMonth, setReopeningMonth] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<MonthInvoice | null>(
    null,
  );
  const [monthDrafts, setMonthDrafts] = useState<Record<string, MonthInvoice[]>>(
    {},
  );
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<string | number | null>(null);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState<{
    monthKey: string;
    draft: MonthInvoice;
  } | null>(null);
  const [busyPdfId, setBusyPdfId] = useState<string | number | null>(null);
  const archiveRequest = useRef(0);

  const buildMonthRange = useCallback((key: string) => {
    const [year, month] = key.split("-").map(Number);
    return {
      from_date: fmtLocalDate(new Date(year, month - 1, 1)),
      to_date: fmtLocalDate(new Date(year, month, 0)),
    };
  }, []);

  const loadArchive = useCallback(async (silent = false) => {
    const requestId = ++archiveRequest.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await api.get("/invoices/archive/monthly");
      if (requestId !== archiveRequest.current) return;
      setMonths(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      if (requestId !== archiveRequest.current) return;
      const message = getApiErrorMessage(err, "تعذر تحميل الأرشيف");
      setError(message);
      toast.error(message);
    } finally {
      if (requestId === archiveRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  const fetchMonthInvoices = useCallback(
    async (key: string, skip = 0): Promise<MonthInvoicePage> => {
      const response = await api.get("/invoices", {
        params: {
          ...buildMonthRange(key),
          skip,
          limit: MONTH_PAGE_SIZE,
          sort: "created_at",
          order: "desc",
        },
      });
      const raw = response.data;
      const items: MonthInvoice[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : [];
      const total = Array.isArray(raw)
        ? items.length
        : Number(raw?.total ?? items.length);
      return { items, total };
    },
    [buildMonthRange],
  );

  const fetchMonthDrafts = useCallback(async (key: string) => {
    setDraftsLoading(true);
    try {
      const response = await api.get(`/invoices/archive/${key}/drafts`);
      const raw = response.data;
      return Array.isArray(raw) ? (raw as MonthInvoice[]) : [];
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const toggleExpand = useCallback(
    async (month: ArchiveMonth) => {
      if (expandedKey === month.key) {
        setExpandedKey(null);
        return;
      }
      setExpandedKey(month.key);
      if (monthInvoices[month.key]) return;
      try {
        setInvoicesLoading(true);
        const data = await fetchMonthInvoices(month.key);
        setMonthInvoices((previous) => ({ ...previous, [month.key]: data }));
        if (month.draft_count > 0 && !monthDrafts[month.key]) {
          const drafts = await fetchMonthDrafts(month.key);
          setMonthDrafts((previous) => ({ ...previous, [month.key]: drafts }));
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "تعذر تحميل فواتير الشهر"));
        setExpandedKey(null);
      } finally {
        setInvoicesLoading(false);
      }
    },
    [expandedKey, monthInvoices, monthDrafts, fetchMonthInvoices, fetchMonthDrafts],
  );

  const loadMoreInvoices = useCallback(
    async (month: ArchiveMonth) => {
      const existing = monthInvoices[month.key];
      if (!existing) return;
      try {
        setLoadingMoreKey(month.key);
        const data = await fetchMonthInvoices(month.key, existing.items.length);
        setMonthInvoices((previous) => ({
          ...previous,
          [month.key]: {
            items: [...existing.items, ...data.items],
            total: data.total,
          },
        }));
      } catch (err) {
        toast.error(getApiErrorMessage(err, "تعذر تحميل بقية الفواتير"));
      } finally {
        setLoadingMoreKey(null);
      }
    },
    [monthInvoices, fetchMonthInvoices],
  );

  const refreshExpandedMonth = useCallback(
    async (key: string) => {
      if (expandedKey !== key) return;
      try {
        const data = await fetchMonthInvoices(key);
        setMonthInvoices((previous) => ({ ...previous, [key]: data }));
      } catch {
        setMonthInvoices((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
      }
    },
    [expandedKey, fetchMonthInvoices],
  );

  const handleCloseMonth = useCallback(
    async (yearMonth: string) => {
      try {
        setClosingMonth(yearMonth);
        const response = await api.post(
          `/invoices/archive/monthly/${yearMonth}/close`,
        );
        toast.success(response.data?.message || "تم إغلاق الشهر");
        setConfirmClose(null);
        await loadArchive(true);
        await refreshExpandedMonth(yearMonth);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "تعذر إغلاق الشهر"));
      } finally {
        setClosingMonth(null);
      }
    },
    [loadArchive, refreshExpandedMonth],
  );

  const handleReopenMonth = useCallback(
    async (yearMonth: string) => {
      try {
        setReopeningMonth(yearMonth);
        const response = await api.post(
          `/invoices/archive/monthly/${yearMonth}/reopen`,
        );
        toast.success(response.data?.message || "تم إعادة فتح الشهر");
        setConfirmReopen(null);
        await loadArchive(true);
        await refreshExpandedMonth(yearMonth);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "تعذر إعادة فتح الشهر"));
      } finally {
        setReopeningMonth(null);
      }
    },
    [loadArchive, refreshExpandedMonth],
  );

  const refreshMonthDrafts = useCallback(
    async (key: string) => {
      try {
        const drafts = await fetchMonthDrafts(key);
        setMonthDrafts((previous) => ({ ...previous, [key]: drafts }));
      } catch {
        setMonthDrafts((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
      }
    },
    [fetchMonthDrafts],
  );

  const handleFinalizeDraft = useCallback(
    async (monthKey: string, draft: MonthInvoice) => {
      const id = invoiceId(draft);
      if (!id) {
        toast.error("لا يمكن تحديد المسودة");
        return;
      }
      try {
        setBusyDraftId(id);
        const response = await api.post(`/invoices/drafts/${id}/finalize`);
        toast.success(
          response.data?.invoice_no
            ? `تم إتمام المسودة وتحويلها إلى فاتورة ${response.data.invoice_no}`
            : "تم إتمام المسودة",
        );
        await loadArchive(true);
        await refreshExpandedMonth(monthKey);
        await refreshMonthDrafts(monthKey);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "تعذر إتمام المسودة"));
      } finally {
        setBusyDraftId(null);
      }
    },
    [loadArchive, refreshExpandedMonth, refreshMonthDrafts],
  );

  const handleDeleteDraft = useCallback(
    async (monthKey: string, draft: MonthInvoice) => {
      const id = invoiceId(draft);
      if (!id) {
        toast.error("لا يمكن تحديد المسودة");
        return;
      }
      try {
        setBusyDraftId(id);
        await api.delete(`/invoices/drafts/${id}`);
        toast.success("تم حذف المسودة");
        setConfirmDeleteDraft(null);
        await loadArchive(true);
        await refreshMonthDrafts(monthKey);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "تعذر حذف المسودة"));
      } finally {
        setBusyDraftId(null);
      }
    },
    [loadArchive, refreshMonthDrafts],
  );

  const summary = useMemo<ArchiveSummary | null>(() => {
    if (!months.length) return null;
    const totalRevenue = months.reduce(
      (sum, month) => sum + (month.total_amount || 0),
      0,
    );
    const totalInvoices = months.reduce(
      (sum, month) => sum + (month.invoice_count || 0),
      0,
    );
    const totalDrafts = months.reduce(
      (sum, month) => sum + (month.draft_count || 0),
      0,
    );
    const totalVoidedInvoices = months.reduce(
      (sum, month) => sum + (month.voided_count || 0),
      0,
    );
    const lockedMonths = months.filter(
      (month) => month.status === "locked",
    ).length;
    const partialMonths = months.filter(
      (month) => month.status === "partial",
    ).length;
    const best = [...months].sort(
      (a, b) => (b.total_amount || 0) - (a.total_amount || 0),
    )[0];
    return {
      totalRevenue,
      totalInvoices,
      totalDrafts,
      totalVoidedInvoices,
      lockedMonths,
      partialMonths,
      avg: totalRevenue / Math.max(1, months.length),
      avgInvoice: totalRevenue / Math.max(1, totalInvoices),
      voidRate: totalInvoices
        ? Math.round((totalVoidedInvoices / totalInvoices) * 100)
        : 0,
      best,
    };
  }, [months]);

  const maxRevenue = useMemo(
    () => Math.max(...months.map((month) => month.total_amount || 0), 1),
    [months],
  );

  const comparison = useMemo<ArchiveComparison | null>(() => {
    if (months.length < 2) return null;
    const current = months[0];
    const previous = months[1];
    const diff = (current.total_amount || 0) - (previous.total_amount || 0);
    const pct =
      previous.total_amount > 0
        ? (diff / previous.total_amount) * 100
        : null;
    return {
      current,
      previous,
      diff,
      pct,
      invDiff: (current.invoice_count || 0) - (previous.invoice_count || 0),
    };
  }, [months]);

  const filteredMonths = useMemo(() => {
    let list = months;
    if (statusFilter !== "all") {
      list = list.filter((month) => month.status === statusFilter);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (month) =>
          (month.label_ar || "").toLowerCase().includes(query) ||
          (month.key || "").toLowerCase().includes(query),
      );
    }
    return list;
  }, [months, search, statusFilter]);

  const handleExportPDF = useCallback(() => {
    const rows = filteredMonths;
    if (!rows.length) {
      toast.error("لا توجد أشهر في النتائج الحالية للطباعة");
      return;
    }

    const totalRevenue = rows.reduce(
      (sum, month) => sum + (month.total_amount || 0),
      0,
    );
    const totalInvoices = rows.reduce(
      (sum, month) => sum + (month.invoice_count || 0),
      0,
    );
    const totalVoided = rows.reduce(
      (sum, month) => sum + (month.voided_count || 0),
      0,
    );
    const generatedAt = new Date().toLocaleString("ar-EG-u-nu-latn", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const tableRows = rows
      .map(
        (month) => `
          <tr>
            <td><strong>${escapeHtml(month.label_ar)}</strong><span class="muted">${escapeHtml(month.key)}</span></td>
            <td>${escapeHtml(statusLabel(month))}</td>
            <td class="num" dir="ltr">${month.invoice_count}</td>
            <td class="num" dir="ltr">${formatCurrency(month.total_amount)}</td>
            <td class="num" dir="ltr">${month.voided_count}</td>
            <td class="num" dir="ltr">${month.draft_count}</td>
            <td class="num" dir="ltr">${escapeHtml(changeLabel(month.change_percent))}</td>
          </tr>`,
      )
      .join("");

    const printWindow = window.open(
      "",
      "archive_report",
      "width=1180,height=820",
    );
    if (!printWindow) {
      toast.error("اسمح بالنوافذ المنبثقة لطباعة التقرير");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>تقرير أرشيف الفواتير</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 28px; color: rgb(28, 25, 23); font-family: "Segoe UI", Tahoma, Arial, sans-serif; background: white; }
            .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid rgb(212, 175, 55); padding-bottom: 18px; }
            h1 { margin: 0 0 6px; font-size: 26px; }
            .muted { display: block; margin-top: 4px; color: rgb(120, 113, 108); font-size: 11px; }
            .date { color: rgb(87, 83, 78); font-size: 12px; text-align: left; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
            .card { border: 1px solid rgb(231, 229, 228); border-radius: 12px; padding: 12px 14px; background: rgb(250, 250, 249); }
            .card span { display: block; color: rgb(120, 113, 108); font-size: 10px; font-weight: 700; }
            .card strong { display: block; margin-top: 6px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: rgb(28, 25, 23); color: rgb(245, 215, 110); padding: 9px 8px; text-align: right; font-size: 11px; }
            td { border-bottom: 1px solid rgb(231, 229, 228); padding: 9px 8px; text-align: right; }
            tr:nth-child(even) td { background: rgb(250, 250, 249); }
            .num { text-align: left; font-variant-numeric: tabular-nums; }
            .footer { margin-top: 18px; color: rgb(120, 113, 108); font-size: 10px; }
            @media print { body { padding: 0; } .card { break-inside: avoid; } tr { break-inside: avoid; } }
            @page { size: A4 landscape; margin: 12mm; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>أرشيف الفواتير</h1>
              <div class="muted">${rows.length} شهر في التقرير — كل الأرقام تستثني المسودات</div>
            </div>
            <div class="date">تم الإنشاء: ${escapeHtml(generatedAt)}</div>
          </div>
          <div class="summary">
            <div class="card"><span>إجمالي المبيعات</span><strong dir="ltr">${formatCurrency(totalRevenue)}</strong></div>
            <div class="card"><span>الفواتير النهائية</span><strong dir="ltr">${totalInvoices}</strong></div>
            <div class="card"><span>الفواتير الملغاة</span><strong dir="ltr">${totalVoided}</strong></div>
            <div class="card"><span>الأشهر المقفلة</span><strong dir="ltr">${rows.filter((month) => month.is_locked).length} / ${rows.length}</strong></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>الشهر</th><th>الحالة</th><th>الفواتير</th><th>المبيعات</th>
                <th>ملغاة</th><th>مسودات</th><th>التغير</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div class="footer">تقرير آلي من نظام إدارة الصالون. «مقفل» تعني قفل الشهر فلا تعديل على فواتيره، و«ملغاة» تعني فاتورة أُلغيت منفردة. استخدم خيار «حفظ كـ PDF» من نافذة الطباعة.</div>
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onafterprint = () => printWindow.close();
    window.setTimeout(() => printWindow.print(), 350);
    toast.success("اختر «حفظ كـ PDF» من نافذة الطباعة");
  }, [filteredMonths]);

  const openInvoicePdf = useCallback(async (invoice: MonthInvoice) => {
    const id = invoiceId(invoice);
    if (!id) {
      toast.error("لا يمكن تحديد رقم الفاتورة");
      return;
    }
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
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    } catch {
      toast.error("تعذر فتح ملف PDF");
    } finally {
      setBusyPdfId(null);
    }
  }, []);

  return {
    months,
    loading,
    error,
    refresh: loadArchive,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    expandedKey,
    monthInvoices,
    monthDrafts,
    draftsLoading,
    busyDraftId,
    confirmDeleteDraft,
    setConfirmDeleteDraft,
    invoicesLoading,
    loadingMoreKey,
    confirmClose,
    setConfirmClose,
    confirmReopen,
    setConfirmReopen,
    closingMonth,
    reopeningMonth,
    toggleExpand,
    loadMoreInvoices,
    handleReopenMonth,
    handleCloseMonth,
    handleFinalizeDraft,
    handleDeleteDraft,
    summary,
    maxRevenue,
    comparison,
    filteredMonths,
    handleExportPDF,
    daysInMonth,
    paymentLabels,
    selectedInvoice,
    setSelectedInvoice,
    busyPdfId,
    openInvoicePdf,
  };
}
