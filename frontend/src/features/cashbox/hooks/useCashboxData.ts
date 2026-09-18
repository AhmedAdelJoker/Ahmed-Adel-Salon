import { useState } from "react";
import { toast } from "react-hot-toast";
import { formatCurrency } from "@/lib/core/utils";
import { useCashbox } from "@/features/cashbox/hooks/useCashbox";
import { buildCashboxCsv } from "@/features/cashbox/utils/cashboxHelpers";
import cashboxService from "@/services/cashboxService";
import type { Transaction } from "@/types/cashbox";

export function useCashboxData() {
  const {
    summary,
    transactions,
    totalCount,
    totalPages,
    currentPage,
    setCurrentPage,
    loading,
    refreshing,
    trend,
    breakdown,
    byMethod,
    searchTerm,
    setSearchTerm,
    direction,
    setDirection,
    paymentMethod,
    setPaymentMethod,
    typeFilter,
    setTypeFilter,
    period,
    setPeriod,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    hasActiveFilters,
    clearFilters,
    refresh,
    createTransaction,
    downloadReceipt,
  } = useCashbox({ pageSize: 20 });

  const [showCashModal, setShowCashModal] = useState(false);
  const [cashType, setCashType] = useState<"in" | "out">("in");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashMethod, setCashMethod] = useState("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewTx, setViewTx] = useState<Transaction | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const openView = (row: Transaction) => {
    setViewTx(row);
    setIsViewOpen(true);
  };

  const handleCreateCash = async () => {
    if (!cashAmount || Number(cashAmount) <= 0) return toast.error("أدخل مبلغ صحيح");
    if (!cashReason.trim() || cashReason.trim().length < 3) return toast.error("أدخل سبب واضح");
    try {
      setIsSubmitting(true);
      const ok = await createTransaction({ direction: cashType, amount: Number(cashAmount), notes: cashReason.trim(), payment_method: cashMethod });
      if (ok) {
        setShowCashModal(false);
        setCashAmount("");
        setCashReason("");
        setCashMethod("cash");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!transactions.length) return toast.error("لا توجد بيانات");
    try {
      let rows = transactions;
      if (hasActiveFilters || totalCount > transactions.length) {
        toast.loading("جاري التجهيز...", { id: "export-csv" });
        const params: Record<string, unknown> = { limit: 500 };
        if (searchTerm.trim()) params.q = searchTerm.trim();
        if (direction !== "all") {
          if (direction === "voided") params.is_voided = true;
          else params.direction = direction;
        }
        if (paymentMethod !== "all") params.payment_method = paymentMethod;
        if (typeFilter !== "all") params.type = typeFilter;
        if (period !== "all") {
          const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const today = new Date();
          if (period === "day") {
            const s = fmt(today);
            params.from_date = s;
            params.to_date = s;
          } else if (period === "week") {
            const wd = today.getDay() === 0 ? 6 : today.getDay() - 1;
            const start = new Date(today);
            start.setDate(today.getDate() - wd);
            params.from_date = fmt(start);
            params.to_date = fmt(today);
          } else if (period === "month") {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            params.from_date = fmt(start);
            params.to_date = fmt(today);
          } else if (period === "year") {
            const start = new Date(today.getFullYear(), 0, 1);
            params.from_date = fmt(start);
            params.to_date = fmt(today);
          } else if (period === "custom") {
            if (startDate) params.from_date = startDate;
            if (endDate) params.to_date = endDate;
          }
        } else {
          if (startDate) params.from_date = startDate;
          if (endDate) params.to_date = endDate;
        }
        const raw = await cashboxService.listTransactions(params as never);
        const { adaptList } = await import("@/services/apiAdapter");
        rows = adaptList<Transaction>(raw);
        toast.dismiss("export-csv");
      }
      if (!rows.length) return toast.error("لا توجد بيانات");
      const csv = buildCashboxCsv(rows as Transaction[]);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `الخزنة_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`تم تصدير ${rows.length} سجل`);
    } catch {
      toast.dismiss("export-csv");
      toast.error("فشل التصدير");
    }
  };

  const isPeriod = period !== "all";
  const cashMain = isPeriod ? summary.period_cash_net : summary.cash_balance_detail;
  const cashSub = isPeriod ? `${summary.period_label} • ${formatCurrency(summary.period_cash_in)} → ${formatCurrency(summary.period_cash_out)}` : `وارد ${formatCurrency(summary.cash_in)} • صادر ${formatCurrency(summary.cash_out)}`;
  const digitalMain = isPeriod ? summary.period_non_cash_net : summary.non_cash_balance;
  const totalMain = isPeriod ? summary.period_net : summary.cash_balance;

  return {
    summary,
    transactions,
    totalCount,
    totalPages,
    currentPage,
    setCurrentPage,
    loading,
    refreshing,
    trend,
    breakdown,
    byMethod,
    searchTerm,
    setSearchTerm,
    direction,
    setDirection,
    paymentMethod,
    setPaymentMethod,
    typeFilter,
    setTypeFilter,
    period,
    setPeriod,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    hasActiveFilters,
    clearFilters,
    refresh,
    createTransaction,
    downloadReceipt,
    showCashModal,
    setShowCashModal,
    cashType,
    setCashType,
    cashAmount,
    setCashAmount,
    cashReason,
    setCashReason,
    cashMethod,
    setCashMethod,
    isSubmitting,
    viewTx,
    setViewTx,
    isViewOpen,
    setIsViewOpen,
    openView,
    handleCreateCash,
    handleExportCsv,
    isPeriod,
    cashMain,
    cashSub,
    digitalMain,
    totalMain,
  };
}
