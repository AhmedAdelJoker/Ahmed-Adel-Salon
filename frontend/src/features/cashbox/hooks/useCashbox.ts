import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import cashboxService from "@/services/cashboxService";
import { adaptList, adaptObject } from "@/services/apiAdapter";
import { getApiErrorMessage } from "@/lib/core/utils";
import type {
  CashboxSummary,
  Transaction,
  CashboxTrendPoint,
  CashboxTypeBreakdown,
  PaymentMethodBreakdown,
  CashboxListParams,
  CreateCashTransactionPayload,
} from "@/types/cashbox";
import { emptySummary, toLocalDateKey, isVoided, type VaultPeriod } from "@/features/cashbox/utils/cashboxHelpers";

export type CashDirectionTab = "all" | "in" | "out" | "voided";

interface UseCashboxOptions {
  pageSize?: number;
}

function normalizeSummary(raw: unknown): CashboxSummary {
  const base = adaptObject<CashboxSummary>(raw, emptySummary()) ?? emptySummary();
  const empty = emptySummary();
  const rec = base as unknown as Record<string, unknown>;
  return {
    total_in: Number(base.total_in ?? 0),
    total_out: Number(base.total_out ?? 0),
    cash_balance: Number(base.cash_balance ?? 0),
    today_sales: Number(base.today_sales ?? 0),
    today_expenses: Number(base.today_expenses ?? 0),
    today_net: Number(base.today_net ?? 0),
    cash_in: Number(rec.cash_in ?? empty.cash_in),
    cash_out: Number(rec.cash_out ?? empty.cash_out),
    cash_balance_detail: Number(rec.cash_balance_detail ?? empty.cash_balance_detail),
    non_cash_in: Number(rec.non_cash_in ?? empty.non_cash_in),
    non_cash_out: Number(rec.non_cash_out ?? empty.non_cash_out),
    non_cash_balance: Number(rec.non_cash_balance ?? empty.non_cash_balance),
    cash_today_sales: Number(rec.cash_today_sales ?? empty.cash_today_sales),
    cash_today_expenses: Number(rec.cash_today_expenses ?? empty.cash_today_expenses),
    cash_today_net: Number(rec.cash_today_net ?? empty.cash_today_net),
    non_cash_today_sales: Number(rec.non_cash_today_sales ?? empty.non_cash_today_sales),
    non_cash_today_expenses: Number(rec.non_cash_today_expenses ?? empty.non_cash_today_expenses),
    non_cash_today_net: Number(rec.non_cash_today_net ?? empty.non_cash_today_net),
    drawer_balance: Number(rec.drawer_balance ?? empty.drawer_balance),
    drawer_open_shifts: Number(rec.drawer_open_shifts ?? 0),
    by_payment_method: (rec.by_payment_method as Record<string, number>) ?? {},
    period_label: String(rec.period_label ?? empty.period_label),
    period_start: (rec.period_start as string | null) ?? null,
    period_end: (rec.period_end as string | null) ?? null,
    period_in: Number(rec.period_in ?? 0),
    period_out: Number(rec.period_out ?? 0),
    period_net: Number(rec.period_net ?? 0),
    period_cash_in: Number(rec.period_cash_in ?? 0),
    period_cash_out: Number(rec.period_cash_out ?? 0),
    period_cash_net: Number(rec.period_cash_net ?? 0),
    period_non_cash_in: Number(rec.period_non_cash_in ?? 0),
    period_non_cash_out: Number(rec.period_non_cash_out ?? 0),
    period_non_cash_net: Number(rec.period_non_cash_net ?? 0),
  };
}

function resolvePeriodDates(period: VaultPeriod, from: string, to: string): { from: string | null; to: string | null } {
  if (period === "all") return { from: null, to: null };
  if (period === "custom") return { from: from || null, to: to || null };
  // للباقي الباك يحسب المدة، لكن للجدول نحسب محلياً لنفس المدة لضمان التطابق
  const today = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (period === "day") {
    const s = fmt(today);
    return { from: s, to: s };
  }
  if (period === "week") {
    const wd = today.getDay() === 0 ? 6 : today.getDay() - 1; // الاثنين بداية
    const start = new Date(today);
    start.setDate(today.getDate() - wd);
    return { from: fmt(start), to: fmt(today) };
  }
  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(start), to: fmt(today) };
  }
  if (period === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { from: fmt(start), to: fmt(today) };
  }
  return { from: null, to: null };
}

export function useCashbox(options: UseCashboxOptions = {}) {
  const pageSize = options.pageSize ?? 20;

  const [summary, setSummary] = useState<CashboxSummary>(emptySummary());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  const [trend, setTrend] = useState<CashboxTrendPoint[]>([]);
  const [breakdown, setBreakdown] = useState<CashboxTypeBreakdown[]>([]);
  const [byMethod, setByMethod] = useState<PaymentMethodBreakdown[]>([]);
  const [drawer, setDrawer] = useState<{ balance: number; open_shifts: number }>({ balance: 0, open_shifts: 0 });

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [direction, setDirection] = useState<CashDirectionTab>("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [period, setPeriod] = useState<VaultPeriod>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [direction, paymentMethod, typeFilter, startDate, endDate, period]);

  const fetchSummaryAndStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const pd = period === "custom" ? { from_date: startDate || undefined, to_date: endDate || undefined } : {};
      const stats = await cashboxService.getStats({ period, ...pd });
      const sumRaw = stats?.summary ?? (await cashboxService.getSummary({ period, ...pd }));
      setSummary(normalizeSummary(sumRaw));
      if (Array.isArray(stats?.trend) && stats.trend.length) {
        const normalized: CashboxTrendPoint[] = (stats.trend as unknown[]).map((p) => {
          const obj = p as Record<string, unknown>;
          return {
            date: String(obj.date ?? obj.name ?? ""),
            label: String(obj.label ?? obj.name ?? ""),
            in: Number(obj.in ?? 0),
            out: Number(obj.out ?? 0),
            net: Number(obj.net ?? 0),
            cash_in: Number(obj.cash_in ?? 0),
            non_cash_in: Number(obj.non_cash_in ?? 0),
          };
        });
        setTrend(normalized);
      } else {
        setTrend([]);
      }
      if (Array.isArray(stats?.breakdown)) {
        setBreakdown(stats.breakdown as CashboxTypeBreakdown[]);
      } else {
        setBreakdown([]);
      }
      if (Array.isArray((stats as unknown as Record<string, unknown>)?.by_method)) {
        setByMethod((stats as unknown as Record<string, unknown>).by_method as PaymentMethodBreakdown[]);
      } else {
        setByMethod([]);
      }
      const d = (stats as unknown as Record<string, unknown>)?.drawer as Record<string, unknown> | undefined;
      if (d) {
        setDrawer({ balance: Number(d.balance ?? 0), open_shifts: Number(d.open_shifts ?? 0) });
      } else {
        setDrawer({ balance: Number((sumRaw as unknown as Record<string, unknown>)?.drawer_balance ?? 0), open_shifts: Number((sumRaw as unknown as Record<string, unknown>)?.drawer_open_shifts ?? 0) });
      }
    } catch {
      // silent
    } finally {
      setStatsLoading(false);
    }
  }, [period, startDate, endDate]);

  const fetchTransactions = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      try {
        if (opts.silent) setRefreshing(true);
        else setLoading(true);

        const pd = resolvePeriodDates(period, startDate, endDate);
        const params: CashboxListParams = {
          limit: pageSize,
          page: currentPage,
        };
        if (debouncedSearch) params.q = debouncedSearch;
        if (direction !== "all") {
          if (direction === "voided") params.is_voided = true;
          else params.direction = direction as "in" | "out";
        }
        if (paymentMethod !== "all") params.payment_method = paymentMethod;
        if (typeFilter !== "all") params.type = typeFilter;
        // فلترة المدة ديناميكية — لو period محدد نستخدم تواريخه، وإلا custom dates
        const from = pd.from ?? (startDate || undefined);
        const to = pd.to ?? (endDate || undefined);
        if (from) params.from_date = from;
        if (to) params.to_date = to;

        const raw = await cashboxService.listTransactions(params);
        const items = adaptList<Transaction>(raw);
        setTransactions(items);
        if (items.length < pageSize) {
          setTotalCount((currentPage - 1) * pageSize + items.length);
        } else {
          setTotalCount((prev) => Math.max(prev, currentPage * pageSize + 1));
        }
        if (currentPage === 1 && items.length < pageSize) {
          setTotalCount(items.length);
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "فشل تحميل حركات الخزنة"));
        setTransactions([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pageSize, currentPage, debouncedSearch, direction, paymentMethod, typeFilter, startDate, endDate, period],
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchSummaryAndStats();
  }, [fetchSummaryAndStats]);

  const fallbackTrend = useMemo(() => {
    if (trend.length) return trend;
    const days: CashboxTrendPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      const label = d.toLocaleDateString("ar-EG", { weekday: "short" });
      const dayTx = transactions.filter((r) => {
        if (isVoided(r)) return false;
        const rd = r.transaction_date ?? r.created_at;
        if (!rd) return false;
        const rdKey = String(rd).slice(0, 10);
        const normalizedKey = rdKey.includes("-") ? rdKey : toLocalDateKey(new Date(String(rd)));
        return normalizedKey === key;
      });
      const inSum = dayTx.filter((r) => r.direction === "in").reduce((a, b) => a + Number(b.amount || 0), 0);
      const outSum = dayTx.filter((r) => r.direction === "out").reduce((a, b) => a + Number(b.amount || 0), 0);
      days.push({ date: key, label, in: inSum, out: outSum, net: inSum - outSum });
    }
    return days;
  }, [trend, transactions]);

  const fallbackBreakdown = useMemo(() => {
    if (breakdown.length) return breakdown;
    const map: Record<string, number> = {};
    transactions
      .filter((r) => !isVoided(r))
      .forEach((r) => {
        const k = String(r.type ?? "غير محدد");
        map[k] = (map[k] || 0) + Number(r.amount || 0);
      });
    return Object.entries(map).map(([type, value]) => ({ type, value }));
  }, [breakdown, transactions]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchTransactions({ silent: true }), fetchSummaryAndStats()]);
  }, [fetchTransactions, fetchSummaryAndStats]);

  const createTransaction = useCallback(
    async (payload: CreateCashTransactionPayload) => {
      try {
        await cashboxService.createTransaction(payload);
        toast.success("تم تسجيل حركة الخزنة");
        await refresh();
        return true;
      } catch (err) {
        toast.error(getApiErrorMessage(err, "فشل تسجيل الحركة"));
        return false;
      }
    },
    [refresh],
  );

  const downloadReceipt = useCallback(async (id: number | string) => {
    const toastId = "cash-receipt";
    try {
      toast.loading("جاري تجهيز الإيصال...", { id: toastId });
      const blob = await cashboxService.downloadReceiptPdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt_TX_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("تم تحميل الإيصال", { id: toastId });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "فشل توليد الإيصال"), { id: toastId });
    }
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearch("");
    setDirection("all");
    setPaymentMethod("all");
    setTypeFilter("all");
    setPeriod("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = Boolean(
    debouncedSearch || startDate || endDate || direction !== "all" || paymentMethod !== "all" || typeFilter !== "all" || period !== "all",
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    summary,
    transactions,
    totalCount,
    totalPages,
    currentPage,
    setCurrentPage,
    pageSize,
    loading,
    refreshing,
    statsLoading,
    trend: fallbackTrend,
    breakdown: fallbackBreakdown,
    byMethod,
    drawer,
    searchTerm,
    setSearchTerm,
    debouncedSearch,
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
  };
}
