import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { reportService } from "@/services/reportService";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { aiService } from "@/lib/aiService";
import { pctGrowth, downloadCsvFile } from "@/lib/money/financialAnalytics";

export type OpPresetId = "today" | "week" | "month" | "quarter";
export type OpTabId = "finance" | "operations" | "history";

export const OP_HISTORY_PAGE_SIZE = 15;

const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

function presetRange(id: OpPresetId): { from: string; to: string } {
  const now = new Date();
  const to = toISODate(now);
  if (id === "today") return { from: to, to };
  if (id === "week") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { from: toISODate(s), to };
  }
  if (id === "quarter") {
    const s = new Date(now);
    s.setDate(s.getDate() - 89);
    return { from: toISODate(s), to };
  }
  return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to };
}

function prevRangeOf(from: string, to: string): { from: string; to: string } | null {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end)
    return null;
  const lenDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (lenDays - 1));
  return { from: toISODate(prevStart), to: toISODate(prevEnd) };
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dayKeyOf(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : "";
}

function shortLabel(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

function isVoided(t: any): boolean {
  if (t == null) return false;
  if (t.is_voided === true) return true;
  if (typeof t.is_voided === "string")
    return t.is_voided === "1" || t.is_voided.toLowerCase() === "true";
  if (Number(t.is_voided) === 1) return true;
  const status = String(t.status ?? "").toLowerCase();
  return status === "voided" || status === "cancelled" || status === "canceled";
}

function totalsOf(rows: any[]): { income: number; expenses: number } {
  let income = 0;
  let expenses = 0;
  rows.forEach((t) => {
    if (isVoided(t)) return;
    const amount = safeNum(t.amount);
    if (t.direction === "in") income += amount;
    else expenses += amount;
  });
  return { income, expenses };
}

async function fetchInvoicesRange(from: string, to: string): Promise<any[]> {
  const out: any[] = [];
  // Bounded paging: at most 3 pages of 1000 — enough for operational reports
  // without risking an unbounded dump.
  for (let page = 0; page < 3; page += 1) {
    const res = await api.get("/invoices", {
      params: { from_date: from, to_date: to, limit: 1000, skip: page * 1000 },
    });
    const items = adaptList<any>(res);
    out.push(...items);
    if (items.length < 1000) break;
  }
  return out;
}

export function useOperationalReports() {
  const initial = useMemo(() => presetRange("month"), []);
  const [activeTab, setActiveTab] = useState<OpTabId>("finance");
  const [preset, setPreset] = useState<OpPresetId>("month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [prevInvoices, setPrevInvoices] = useState<any[]>([]);
  const [prevRange, setPrevRange] = useState<{ from: string; to: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [startDate, setStartDate] = useState(initial.from);
  const [endDate, setEndDate] = useState(initial.to);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const prev = prevRangeOf(startDate, endDate);
      setPrevRange(prev);
      const [transRes, invRows, prevTransRes, prevInvRows] = await Promise.all([
        reportService.getCashTransactions({ from_date: startDate, to_date: endDate }),
        fetchInvoicesRange(startDate, endDate),
        prev
          ? reportService.getCashTransactions({ from_date: prev.from, to_date: prev.to })
          : Promise.resolve([]),
        prev ? fetchInvoicesRange(prev.from, prev.to) : Promise.resolve([]),
      ]);
      setTransactions(adaptList<any>(transRes));
      setInvoices(Array.isArray(invRows) ? invRows : []);
      setPrevTransactions(adaptList<any>(prevTransRes));
      setPrevInvoices(Array.isArray(prevInvRows) ? prevInvRows : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching operational data:", error);
      setLoadError("تعذر تحميل البيانات التشغيلية. تحقق من الاتصال ثم أعد المحاولة.");
      if (!hasLoadedRef.current) toast.error("فشل تحميل البيانات التشغيلية");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
      hasLoadedRef.current = true;
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60s when enabled (same convention as FinancialReports).
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      fetchData();
    }, 60000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchData]);

  // Reset history paging whenever the underlying filter changes.
  useEffect(() => {
    setHistoryPage(1);
  }, [searchQuery, startDate, endDate]);

  const applyPreset = useCallback((id: OpPresetId) => {
    const r = presetRange(id);
    setPreset(id);
    setStartDate(r.from);
    setEndDate(r.to);
  }, []);

  const financialMetrics = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const timeline: Record<string, { date: string; label: string; income: number; expenses: number }> = {};
    // Expense-only breakdown: income must NOT leak into the cost pie (H4 fix).
    const expenseCategories: Record<string, number> = {};
    transactions.forEach((t) => {
      if (isVoided(t)) return;
      const amount = safeNum(t.amount);
      const date = dayKeyOf(t.transaction_date || t.created_at);
      if (!date) return;
      const isIn = t.direction === "in";
      if (isIn) income += amount;
      else {
        expenses += amount;
        const cat = String(t.category || "عام").trim() || "عام";
        expenseCategories[cat] = (expenseCategories[cat] || 0) + amount;
      }
      if (!timeline[date])
        timeline[date] = { date, label: shortLabel(date), income: 0, expenses: 0 };
      if (isIn) timeline[date].income += amount;
      else timeline[date].expenses += amount;
    });
    const prev = totalsOf(prevTransactions);
    const net = income - expenses;
    const prevNet = prev.income - prev.expenses;
    return {
      income,
      expenses,
      net,
      prevIncome: prev.income,
      prevExpenses: prev.expenses,
      prevNet,
      growth: {
        income: pctGrowth(income, prev.income),
        expenses: pctGrowth(expenses, prev.expenses),
        net: pctGrowth(net, prevNet),
      },
      prevRange,
      timeline: Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date)),
      categories: Object.entries(expenseCategories)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      expenseTotal: expenses,
      hasData: income > 0 || expenses > 0 || transactions.length > 0,
    };
  }, [transactions, prevTransactions, prevRange]);

  const operationalMetrics = useMemo(() => {
    const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
    const barberMap = new Map<string, { name: string; count: number; revenue: number }>();
    const hourMap = new Map<number, number>();
    const customerIds = new Set<string | number>();
    let invoiceCount = 0;
    let invoiceRevenue = 0;

    invoices.forEach((inv) => {
      // H5 fix: ignore missing customer ids instead of counting `undefined` as a customer.
      const cid = inv.customer_id ?? inv.customerId ?? inv.customer?.id;
      if (cid !== null && cid !== undefined && String(cid).trim() !== "") {
        customerIds.add(cid as string | number);
      }
      invoiceCount += 1;
      invoiceRevenue += safeNum(inv.total_amount ?? inv.total ?? inv.net_total);
      const created = inv.created_at ? new Date(inv.created_at) : null;
      if (created && !Number.isNaN(created.getTime())) {
        const h = created.getHours();
        hourMap.set(h, (hourMap.get(h) || 0) + 1);
      }
      const items = Array.isArray(inv.items) ? inv.items : [];
      items.forEach((item: any) => {
        const sName = String(item.service_name || item.name || "خدمة أخرى").trim() || "خدمة أخرى";
        const price = safeNum(item.price ?? item.total ?? item.amount);
        const currentS = serviceMap.get(sName) || { name: sName, count: 0, revenue: 0 };
        serviceMap.set(sName, { ...currentS, count: currentS.count + 1, revenue: currentS.revenue + price });
        // H3 fix: no random rating — count + revenue only (deterministic).
        const bName =
          String(item.barber_name || item.employee_name || inv.barber_name || "غير محدد").trim() ||
          "غير محدد";
        const currentB = barberMap.get(bName) || { name: bName, count: 0, revenue: 0 };
        barberMap.set(bName, { ...currentB, count: currentB.count + 1, revenue: currentB.revenue + price });
      });
    });

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      count: hourMap.get(i) || 0,
    }));
    const peak = hourlyData.reduce(
      (best, h) => (h.count > best.count ? h : best),
      { hour: "--", count: 0 },
    );

    // Previous-period operational totals for real growth chips.
    let prevServices = 0;
    const prevCustomers = new Set<string | number>();
    prevInvoices.forEach((inv: any) => {
      const cid = inv.customer_id ?? inv.customerId ?? inv.customer?.id;
      if (cid !== null && cid !== undefined && String(cid).trim() !== "") {
        prevCustomers.add(cid as string | number);
      }
      const items = Array.isArray(inv.items) ? inv.items : [];
      prevServices += items.length;
    });

    const totalServices = Array.from(serviceMap.values()).reduce((acc, s) => acc + s.count, 0);
    const totalCustomers = customerIds.size;

    return {
      totalCustomers,
      totalServices,
      totalInvoices: invoiceCount,
      invoiceRevenue,
      avgTicket: invoiceCount > 0 ? invoiceRevenue / invoiceCount : 0,
      topServices: Array.from(serviceMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      topBarbers: Array.from(barberMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      hourlyData,
      peakHour: peak.count > 0 ? peak : null,
      growth: {
        services: pctGrowth(totalServices, prevServices),
        customers: pctGrowth(totalCustomers, prevCustomers.size),
      },
    };
  }, [invoices, prevInvoices]);

  const aiInsights = useMemo(() => aiService.generateInsights(transactions), [transactions]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = transactions.filter((t) => !isVoided(t));
    if (!q) return [...rows].reverse();
    return rows
      .filter((t) => {
        const hay = [
          String(t.note || ""),
          String(t.category || ""),
          String(t.amount ?? ""),
          dayKeyOf(t.transaction_date || t.created_at),
          t.direction === "in" ? "إيداع" : "مصروف",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .reverse();
  }, [transactions, searchQuery]);

  const historyTotal = filteredHistory.length;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / OP_HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(Math.max(1, historyPage), historyTotalPages);
  const pagedHistory = useMemo(
    () =>
      filteredHistory.slice(
        (safeHistoryPage - 1) * OP_HISTORY_PAGE_SIZE,
        safeHistoryPage * OP_HISTORY_PAGE_SIZE,
      ),
    [filteredHistory, safeHistoryPage],
  );

  const handleExportHistoryCsv = useCallback(() => {
    if (!filteredHistory.length) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    downloadCsvFile(
      `operational_history_${startDate}_${endDate}`,
      ["التاريخ", "البيان", "التصنيف", "النوع", "القيمة"],
      filteredHistory.map((t: any) => [
        dayKeyOf(t.transaction_date || t.created_at),
        String(t.note || "عملية تشغيلية"),
        String(t.category || "عام"),
        t.direction === "in" ? "إيداع" : "مصروف",
        safeNum(t.amount),
      ]),
    );
    toast.success("تم تصدير السجل بنجاح");
  }, [filteredHistory, startDate, endDate]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return {
    activeTab,
    setActiveTab,
    preset,
    setPreset,
    applyPreset,
    loading,
    refreshing,
    hasLoaded,
    loadError,
    autoRefresh,
    setAutoRefresh,
    lastUpdated,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    searchQuery,
    setSearchQuery,
    historyPage: safeHistoryPage,
    setHistoryPage,
    historyTotal,
    historyTotalPages,
    financialMetrics,
    operationalMetrics,
    aiInsights,
    filteredHistory,
    pagedHistory,
    transactions,
    invoices,
    fetchData,
    handleExportHistoryCsv,
    handlePrint,
  };
}
