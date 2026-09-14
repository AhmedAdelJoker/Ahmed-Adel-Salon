import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList, adaptObject, adaptTotal } from "@/services/apiAdapter";
import { expenseCategoryLabel } from "@/lib/money/expenseCategories";
import {
  detectAnomalies,
  downloadCsvFile,
  lastNMonthKeys,
  type MonthlyBucket,
  monthKeyOf,
  monthLabelAr,
  pctGrowth,
} from "@/lib/money/financialAnalytics";
import type { FinancialsState, RawRow, TrendPoint, ExpenseSlice } from "@/types/reports";
import { aiService } from "@/lib/aiService";
import { exportService } from "@/services/exportService";
import { businessSettingsService } from "@/services/businessSettingsService";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/core/utils";

const CHART_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

type PresetId = "today" | "week" | "month" | "quarter";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetRange(id: PresetId): { from: string; to: string } {
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

function eachDayISO(from: string, to: string, cap = 92): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
  const cursor = new Date(start);
  while (cursor <= end && out.length < cap) {
    out.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function shortLabel(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

function paymentLabel(key: string): string {
  const PAYMENT_LABELS: Record<string, string> = {
    cash: "نقدي",
    credit_card: "بطاقة ائتمان",
    card: "بطاقة",
    visa: "فيزا",
    mastercard: "ماستركارد",
    wallet: "محفظة إلكترونية",
    instapay: "انستاباي",
    bank_transfer: "تحويل بنكي",
    vodafone_cash: "فودافون كاش",
    orange_money: "أورانج موني",
  };
  if (!key) return "غير محدد";
  const k = String(key).trim().toLowerCase();
  return PAYMENT_LABELS[k] ?? String(key);
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

const CANCELLED = new Set(["cancelled", "canceled", "voided", "ملغية", "ملغي"]);

const INV_PAGE_SIZE = 1000;
const INV_MAX_PAGES = 5;
const EXP_PAGE_SIZE = 200;
const EXP_MAX_PAGES = 5;

function prevRangeOf(from: string, to: string): { from: string; to: string } | null {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  const lenDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (lenDays - 1));
  return { from: toISODate(prevStart), to: toISODate(prevEnd) };
}

/** Signed number for the trend chip (the chip appends the % sign itself). */
export function formatSignedPct(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "+";
  return `${sign}${Math.abs(v).toFixed(1)}`;
}

function filterValidInvoices(rows: RawRow[], from: string, to: string): RawRow[] {
  return rows.filter((inv) => {
    const status = String(inv.status ?? "").toLowerCase();
    if (CANCELLED.has(status) || CANCELLED.has(String(inv.status ?? ""))) return false;
    if (inv.is_draft === true || status === "draft") return false;
    const d = dayKeyOf(inv.created_at);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

async function fetchAllInvoices(
  from: string,
  to: string,
): Promise<{ rows: RawRow[]; total: number; truncated: boolean }> {
  const rows: RawRow[] = [];
  let total = 0;
  let truncated = false;
  for (let page = 0; page < INV_MAX_PAGES; page += 1) {
    const res = await api.get("/invoices", {
      params: { from_date: from, to_date: to, limit: INV_PAGE_SIZE, skip: page * INV_PAGE_SIZE },
    });
    const items = adaptList<RawRow>(res);
    if (page === 0) total = adaptTotal(res);
    rows.push(...items);
    if (items.length < INV_PAGE_SIZE) break;
    if (rows.length >= total && total > 0) break;
    if (page === INV_MAX_PAGES - 1) truncated = rows.length < total;
  }
  if (total > 0 && rows.length < total) truncated = true;
  return { rows, total: total || rows.length, truncated };
}

async function fetchAllExpenses(from: string, to: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let page = 0; page < EXP_MAX_PAGES; page += 1) {
    const res = await api.get("/expenses", {
      params: { date_from: from, date_to: to, limit: EXP_PAGE_SIZE, skip: page * EXP_PAGE_SIZE },
    });
    const items = adaptList<RawRow>(res);
    rows.push(...items);
    if (items.length < EXP_PAGE_SIZE) break;
  }
  return rows;
}

const EMPTY_FINANCIALS: FinancialsState = {
  revenue: 0,
  expenses: 0,
  netProfit: 0,
  margin: 0,
  payments: [],
  expenseCategories: [],
  dailyTrends: [],
  prevDailyTrends: [],
  invoiceCount: 0,
  expenseCount: 0,
  avgTicket: 0,
  expenseRatio: 0,
  bestDay: null,
  growth: { revenue: null, expenses: null, net: null, marginDelta: null },
  prevRange: null,
  totalInvoices: 0,
  truncated: false,
  invoiceRows: [],
  expenseRows: [],
};

export interface ReportSchedule {
  id: number;
  name: string;
  frequency: string;
  channel: string;
  target_phone?: string | null;
  is_active: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_status?: string;
  last_summary?: string | null;
  last_pdf_url?: string | null;
}

export function useFinancialReports() {
  const initial = useMemo(() => presetRange("month"), []);
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [preset, setPreset] = useState<PresetId>("month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [financials, setFinancials] = useState<FinancialsState>(EMPTY_FINANCIALS);
  const [monthly, setMonthly] = useState<MonthlyBucket[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyLoaded, setMonthlyLoaded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState(500000);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("500000");
  const [savingTarget, setSavingTarget] = useState(false);

  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedBusyId, setSchedBusyId] = useState<number | string | null>(null);
  const [schedFreq, setSchedFreq] = useState("daily");
  const [schedChannel, setSchedChannel] = useState("notification");
  const [schedPhone, setSchedPhone] = useState("");

  const fetchSchedules = useCallback(async () => {
    setSchedLoading(true);
    try {
      const res = await api.get("/report-schedules");
      const items = adaptList<ReportSchedule>(res);
      setSchedules(items);
    } catch (error) {
      toast.error("فشل تحميل التقارير المجدولة");
    } finally {
      setSchedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLoaded) fetchSchedules();
  }, [hasLoaded, fetchSchedules]);

  const handleCreateSchedule = async () => {
    if (schedBusyId) return;
    setSchedBusyId("new");
    try {
      await api.post("/report-schedules", {
        frequency: schedFreq,
        channel: schedChannel,
        target_phone: schedPhone.trim() || null,
      });
      setSchedPhone("");
      toast.success("تم إنشاء الجدولة");
      await fetchSchedules();
    } catch (error) {
      toast.error("فشل إنشاء الجدولة");
    } finally {
      setSchedBusyId(null);
    }
  };

  const handleToggleSchedule = async (s: ReportSchedule) => {
    setSchedBusyId(s.id);
    try {
      await api.put(`/report-schedules/${s.id}`, { is_active: !s.is_active });
      await fetchSchedules();
    } catch (error) {
      toast.error("فشل تحديث الجدولة");
    } finally {
      setSchedBusyId(null);
    }
  };

  const handleDeleteSchedule = async (s: ReportSchedule) => {
    setSchedBusyId(s.id);
    try {
      await api.delete(`/report-schedules/${s.id}`);
      toast.success("تم حذف الجدولة");
      await fetchSchedules();
    } catch (error) {
      toast.error("فشل حذف الجدولة");
    } finally {
      setSchedBusyId(null);
    }
  };

  const handleRunScheduleNow = async (s: ReportSchedule) => {
    setSchedBusyId(s.id);
    try {
      const res = await api.post(`/report-schedules/${s.id}/run-now`);
      const status = res?.data?.status;
      if (status === "ok") toast.success("تم إرسال التقرير");
      else toast.error(res?.data?.errors?.join("؛ ") || "تعذر إرسال التقرير");
      await fetchSchedules();
    } catch (error) {
      toast.error("فشل تشغيل الجدولة");
    } finally {
      setSchedBusyId(null);
    }
  };

  const { user, currentUser } = useAuth();
  const activeRole = String((currentUser || user)?.role || "").toLowerCase();
  const canEditTarget = ["owner", "admin", "manager", "accountant"].includes(activeRole);

  const hasLoadedRef = useRef(false);

  const fetchFinancials = useCallback(async () => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const prev = prevRangeOf(fromDate, toDate);
      const [invPage, expSumRes, expenseRows, prevInvPage, prevExpSumRes, prevExpRows, settingsRes] = await Promise.all([
        fetchAllInvoices(fromDate, toDate),
        api.get("/expenses/summary", { params: { from_date: fromDate, to_date: toDate } }),
        fetchAllExpenses(fromDate, toDate),
        prev ? fetchAllInvoices(prev.from, prev.to) : Promise.resolve({ rows: [], total: 0, truncated: false }),
        prev
          ? api.get("/expenses/summary", { params: { from_date: prev.from, to_date: prev.to } })
          : Promise.resolve(null),
        prev ? fetchAllExpenses(prev.from, prev.to) : Promise.resolve([]),
        businessSettingsService.get().catch(() => null),
      ]);

      const settingsTarget = safeNum(
        (settingsRes as Record<string, unknown> | null)?.monthlyRevenueTarget ??
          (settingsRes as Record<string, unknown> | null)?.monthly_revenue_target ??
          500000,
      );
      if (settingsTarget > 0) {
        setMonthlyTarget(settingsTarget);
        setTargetDraft(String(Math.round(settingsTarget)));
      }

      const invoices = filterValidInvoices(invPage.rows, fromDate, toDate);
      const prevInvoices = prev ? filterValidInvoices(prevInvPage.rows, prev.from, prev.to) : [];

      const summary = adaptObject<Record<string, any>>(expSumRes, {}) ?? {};
      const prevSummary = prevExpSumRes ? (adaptObject<Record<string, any>>(prevExpSumRes, {}) ?? {}) : {};

      const totalRevenue = invoices.reduce((s, inv) => s + safeNum(inv.total_amount), 0);
      const invoiceCount = invoices.length;
      const totalExpenses = safeNum(summary.total_amount);
      const expenseCount = safeNum(summary.count ?? expenseRows.length);
      const netProfit = totalRevenue - totalExpenses;
      const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      const prevRevenue = prevInvoices.reduce((s, inv) => s + safeNum(inv.total_amount), 0);
      const prevExpenses = safeNum(prevSummary.total_amount);
      const prevNet = prevRevenue - prevExpenses;
      const prevMargin = prevRevenue > 0 ? (prevNet / prevRevenue) * 100 : 0;
      const growth = {
        revenue: pctGrowth(totalRevenue, prevRevenue),
        expenses: pctGrowth(totalExpenses, prevExpenses),
        net: pctGrowth(netProfit, prevNet),
        marginDelta: prevRevenue > 0 ? margin - prevMargin : null,
      };

      const payMap = new Map<string, number>();
      invoices.forEach((inv) => {
        const method = String(inv.payment_method || "cash");
        payMap.set(method, (payMap.get(method) || 0) + safeNum(inv.total_amount));
      });

      const days = eachDayISO(fromDate, toDate);
      const revByDay = new Map<string, number>();
      const expByDay = new Map<string, number>();
      invoices.forEach((inv) => {
        const d = dayKeyOf(inv.created_at);
        if (!d) return;
        revByDay.set(d, (revByDay.get(d) || 0) + safeNum(inv.total_amount));
      });
      expenseRows.forEach((e) => {
        const d = dayKeyOf(e.expense_date ?? e.created_at);
        if (!d) return;
        expByDay.set(d, (expByDay.get(d) || 0) + safeNum(e.amount));
      });

      let dailyTrends: TrendPoint[] = days.map((d) => {
        const rev = revByDay.get(d) || 0;
        const exp = expByDay.get(d) || 0;
        return { name: shortLabel(d), date: d, label: shortLabel(d), rev, exp, net: rev - exp };
      });

      let prevDailyTrends: TrendPoint[] = [];
      if (prev) {
        const prevDays = eachDayISO(prev.from, prev.to);
        const prevRevByDay = new Map<string, number>();
        const prevExpByDay = new Map<string, number>();
        prevInvoices.forEach((inv) => {
          const d = dayKeyOf(inv.created_at);
          if (!d) return;
          prevRevByDay.set(d, (prevRevByDay.get(d) || 0) + safeNum(inv.total_amount));
        });
        prevExpRows.forEach((e) => {
          const d = dayKeyOf(e.expense_date ?? e.created_at);
          if (!d) return;
          prevExpByDay.set(d, (prevExpByDay.get(d) || 0) + safeNum(e.amount));
        });
        prevDailyTrends = prevDays.map((d) => {
          const rev = prevRevByDay.get(d) || 0;
          const exp = prevExpByDay.get(d) || 0;
          return { name: shortLabel(d), date: d, label: shortLabel(d), rev, exp, net: rev - exp };
        });

        if (prevDailyTrends.length > 45) {
          const buckets: TrendPoint[] = [];
          for (let i = 0; i < prevDailyTrends.length; i += 7) {
            const chunk = prevDailyTrends.slice(i, i + 7);
            const rev = chunk.reduce((s, p) => s + p.rev, 0);
            const exp = chunk.reduce((s, p) => s + p.exp, 0);
            const first = chunk[0];
            const last = chunk[chunk.length - 1];
            buckets.push({
              name: `${first.label}-${last.label}`,
              date: first.date,
              label: `${first.label}-${last.label}`,
              rev,
              exp,
              net: rev - exp,
            });
          }
          prevDailyTrends = buckets;
        }
      }

      if (dailyTrends.length > 45) {
        const buckets: TrendPoint[] = [];
        for (let i = 0; i < dailyTrends.length; i += 7) {
          const chunk = dailyTrends.slice(i, i + 7);
          const rev = chunk.reduce((s, p) => s + p.rev, 0);
          const exp = chunk.reduce((s, p) => s + p.exp, 0);
          const first = chunk[0];
          const last = chunk[chunk.length - 1];
          buckets.push({
            name: `${first.label}-${last.label}`,
            date: first.date,
            label: `${first.label}-${last.label}`,
            rev,
            exp,
            net: rev - exp,
          });
        }
        dailyTrends = buckets;
      }

      const catAcc = new Map<string, { name: string; value: number; count: number }>();
      if (Array.isArray(summary.categories)) {
        (summary.categories as Array<Record<string, any>>).forEach((c) => {
          const rawName = String(c.name ?? c.category ?? "عام");
          const label = String(c.label_ar ?? "").trim() || expenseCategoryLabel(rawName);
          const value = safeNum(c.value ?? c.total ?? c.total_amount);
          if (value <= 0) return;
          const prev = catAcc.get(label);
          if (prev) {
            prev.value += value;
            prev.count += safeNum(c.count ?? c.cnt);
          } else {
            catAcc.set(label, { name: label, value, count: safeNum(c.count ?? c.cnt) });
          }
        });
      }
      const categories = [...catAcc.values()].sort((a, b) => b.value - a.value);

      const bestDay = dailyTrends.length
        ? dailyTrends.reduce((a, b) => (b.net > a.net ? b : a), dailyTrends[0])
        : null;

      setFinancials({
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        margin,
        payments: [...payMap.entries()]
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value),
        expenseCategories: categories,
        dailyTrends,
        invoiceCount,
        expenseCount,
        avgTicket: invoiceCount > 0 ? totalRevenue / invoiceCount : 0,
        expenseRatio: totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0,
        bestDay,
        growth,
        prevRange: prev,
        prevDailyTrends,
        totalInvoices: invPage.total,
        truncated: invPage.truncated,
        invoiceRows: invoices,
        expenseRows: expenseRows,
      });
      setLastUpdated(new Date());
    } catch (error) {
      setLoadError("فشل تحميل البيانات المالية");
      toast.error("فشل تحميل البيانات المالية");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
      hasLoadedRef.current = true;
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchFinancials();
    }, hasLoadedRef.current ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchFinancials]);

  const fetchSixMonths = useCallback(async () => {
    if (monthlyLoading) return;
    setMonthlyLoading(true);
    try {
      const keys = lastNMonthKeys(6);
      const from = `${keys[0]}-01`;
      const now = new Date();
      const to = toISODate(now);
      const [invPage, expRows] = await Promise.all([
        fetchAllInvoices(from, to),
        fetchAllExpenses(from, to),
      ]);
      const invoices = filterValidInvoices(invPage.rows, from, to);
      const byKey = new Map<string, MonthlyBucket>();
      keys.forEach((k) => byKey.set(k, { key: k, label: monthLabelAr(k), rev: 0, exp: 0, net: 0 }));
      invoices.forEach((inv) => {
        const k = monthKeyOf(dayKeyOf(inv.created_at));
        const b = byKey.get(k);
        if (b) b.rev += safeNum(inv.total_amount);
      });
      expRows.forEach((e) => {
        const k = monthKeyOf(dayKeyOf(e.expense_date ?? e.created_at));
        const b = byKey.get(k);
        if (b) b.exp += safeNum(e.amount);
      });
      const buckets = keys.map((k) => {
        const b = byKey.get(k)!;
        return { ...b, net: b.rev - b.exp };
      });
      setMonthly(buckets);
      setMonthlyLoaded(true);
    } catch (error) {
      toast.error("فشل تحميل مقارنة الشهور");
    } finally {
      setMonthlyLoading(false);
    }
  }, [monthlyLoading]);

  useEffect(() => {
    if (!autoRefresh || !hasLoaded) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !document.hidden) {
        fetchFinancials();
      }
    }, 60000);
    return () => clearInterval(id);
  }, [autoRefresh, hasLoaded, fetchFinancials]);

  const applyPreset = (id: PresetId) => {
    const r = presetRange(id);
    setPreset(id);
    setFromDate(r.from);
    setToDate(r.to);
  };

  const hasData =
    financials.revenue > 0 ||
    financials.expenses > 0 ||
    financials.invoiceCount > 0 ||
    financials.expenseCount > 0;

  const paymentsWithPct = useMemo(() => {
    const total = financials.payments.reduce((s, p) => s + p.value, 0) || 1;
    return financials.payments.map((p, i) => ({
      ...p,
      pct: (p.value / total) * 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: paymentLabel(p.name),
    }));
  }, [financials.payments]);

  const topPayment = paymentsWithPct[0];
  const topExpense = financials.expenseCategories[0];
  const topDays = useMemo(
    () => [...financials.dailyTrends].sort((a, b) => b.net - a.net).slice(0, 5),
    [financials.dailyTrends],
  );
  const maxDayNet = topDays[0]?.net || 1;

  const monthStart = useMemo(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    [],
  );
  const isCurrentMonth = fromDate <= monthStart && toDate >= monthStart;
  const currentMonthRevenue = isCurrentMonth ? financials.revenue : 0;
  const targetProgress =
    monthlyTarget > 0 ? Math.min(100, (currentMonthRevenue / monthlyTarget) * 100) : 0;

  const handleSaveTarget = async () => {
    const value = Math.round(Number(targetDraft));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("أدخل هدفاً شهرياً صحيحاً أكبر من صفر");
      return;
    }
    setSavingTarget(true);
    try {
      const updated = await businessSettingsService.update({ monthlyRevenueTarget: value });
      const next = safeNum(
        (updated as Record<string, unknown>)?.monthlyRevenueTarget ??
          (updated as Record<string, unknown>)?.monthly_revenue_target ??
          value,
      );
      setMonthlyTarget(next > 0 ? next : value);
      setTargetDraft(String(value));
      setEditingTarget(false);
      toast.success("تم حفظ الهدف الشهري");
    } catch (error) {
      toast.error("فشل حفظ الهدف الشهري");
    } finally {
      setSavingTarget(false);
    }
  };

  const [selectedDay, setSelectedDay] = useState<TrendPoint | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<ExpenseSlice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<{ name: string; value: number } | null>(null);

  const dayInvoices = useMemo(() => {
    if (!selectedDay) return [];
    return financials.invoiceRows.filter((inv) => {
      const d = dayKeyOf(inv.created_at);
      return d === selectedDay.date;
    });
  }, [selectedDay, financials.invoiceRows]);

  const dayExpenses = useMemo(() => {
    if (!selectedDay) return [];
    return financials.expenseRows.filter((e) => {
      const d = dayKeyOf(e.expense_date ?? e.created_at);
      return d === selectedDay.date;
    });
  }, [selectedDay, financials.expenseRows]);

  const anomalies = useMemo(
    () => (hasData ? detectAnomalies(financials.dailyTrends) : []),
    [hasData, financials.dailyTrends],
  );
  const anomalyDates = useMemo(() => new Set(anomalies.map((a) => a.date)), [anomalies]);

  const paymentInvoices = useMemo(() => {
    if (!selectedPayment) return [];
    return financials.invoiceRows.filter(
      (inv) => String(inv.payment_method || "cash") === selectedPayment.name,
    );
  }, [selectedPayment, financials.invoiceRows]);

  const categoryMovements = useMemo(() => {
    if (!selectedExpenseCategory) return [];
    return financials.expenseRows
      .filter((e) => expenseCategoryLabel(String(e.category ?? "عام")) === selectedExpenseCategory.name)
      .sort((a, b) => String(b.expense_date ?? b.created_at ?? "").localeCompare(String(a.expense_date ?? a.created_at ?? "")));
  }, [selectedExpenseCategory, financials.expenseRows]);

  const forecast = useMemo(() => {
    const trends = financials.dailyTrends;
    if (!hasData || trends.length === 0) return null;
    const window = trends.slice(-14);
    const n = window.length || 1;
    const avgRev = window.reduce((s, t) => s + t.rev, 0) / n;
    const avgExp = window.reduce((s, t) => s + t.exp, 0) / n;
    const projRev = avgRev * 30;
    const projExp = avgExp * 30;
    const projNet = projRev - projExp;
    const cumulative: Array<{ name: string; net: number }> = [];
    let acc = 0;
    for (let i = 1; i <= 30; i += 1) {
      acc += avgRev - avgExp;
      if (i % 3 === 0 || i === 30) cumulative.push({ name: `يوم ${i}`, net: Math.round(acc) });
    }
    return { avgRev, avgExp, projRev, projExp, projNet, basisDays: n, cumulative };
  }, [hasData, financials.dailyTrends]);

  const aiInsights = useMemo(() => {
    const base = aiService.generateInsights([
      { amount: financials.revenue, direction: "in" },
      { amount: financials.expenses, direction: "out" },
    ]);
    const extra: string[] = [];
    if (!hasData) {
      extra.push("لا توجد حركات مالية في الفترة المحددة — وسّع النطاق الزمني أو راجع فلاتر التاريخ.");
      return { ...base, insights: extra };
    }
    if (financials.margin < 0) {
      extra.push(
        `صافي الخسارة ${formatCurrency(financials.netProfit)} بهامش ${financials.margin.toFixed(1)}% — راجع أكبر بنود المصروفات وأوقف التسرب النقدي أولاً.`,
      );
    } else if (financials.margin >= 20) {
      extra.push(
        `هامش ربح صحي ${financials.margin.toFixed(1)}% مع صافي ${formatCurrency(financials.netProfit)} — حافظ على الانضباط التشغيلي ووجّه الفائض للنمو.`,
      );
    } else {
      extra.push(
        `هامش الربح ${financials.margin.toFixed(1)}% وصافي ${formatCurrency(financials.netProfit)} — مساحة جيدة للتحسين عبر رفع متوسط الفاتورة وخفض الهدر.`,
      );
    }
    if (financials.growth.revenue !== null && financials.prevRange) {
      const g = financials.growth.revenue;
      extra.push(
        g >= 0
          ? `الإيراد نما ${formatSignedPct(g)}% عن الفترة السابقة (${financials.prevRange.from} إلى ${financials.prevRange.to}) — عزز القنوات الرابحة بنفس الوتيرة.`
          : `الإيراد تراجع ${formatSignedPct(g)}% عن الفترة السابقة (${financials.prevRange.from} إلى ${financials.prevRange.to}) — راجع أسباب الانخفاض قبل نهاية الفترة.`,
      );
    }
    if (financials.expenseRatio > 70) {
      extra.push(
        `المصروفات تمثل ${financials.expenseRatio.toFixed(1)}% من الإيراد — مستوى مرتفع يستدعي مراجعة فورية للتكاليف الثابتة والمتغيرة.`,
      );
    }
    if (financials.invoiceCount > 0) {
      extra.push(
        `متوسط الفاتورة ${formatCurrency(financials.avgTicket)} عبر ${financials.invoiceCount} فاتورة — ارفعها بالبيع الإضافي والباقات المجمعة.`,
      );
    }
    if (financials.bestDay && financials.bestDay.net !== 0) {
      extra.push(
        `أفضل يوم ${financials.bestDay.date} بصافي ${formatCurrency(financials.bestDay.net)} — كرر ظروف التشغيل الناجحة فيه (طاقم، عروض، مواعيد).`,
      );
    }
    if (topPayment && topPayment.pct > 70) {
      extra.push(
        `تركز التحصيل على ${topPayment.label} بنسبة ${topPayment.pct.toFixed(0)}% — نوّع وسائل الدفع لتقليل المخاطر التشغيلية.`,
      );
    }
    if (topExpense) {
      const share =
        financials.expenses > 0 ? (topExpense.value / financials.expenses) * 100 : 0;
      extra.push(
        `أكبر بند مصروفات: ${topExpense.name} بقيمة ${formatCurrency(topExpense.value)} (${share.toFixed(0)}% من المصروفات) — ابدأ التفاوض والترشيد من هنا.`,
      );
    }
    if (anomalies.length > 0) {
      extra.push(
        `رُصد ${anomalies.length} شذوذ إحصائي في الفترة — أبرزها: ${anomalies[0].message}.`,
      );
    }
    const merged = [...extra, ...base.insights].filter(Boolean).slice(0, 5);
    return { ...base, insights: merged.length ? merged : base.insights };
  }, [
    financials.revenue,
    financials.expenses,
    financials.netProfit,
    financials.margin,
    financials.invoiceCount,
    financials.avgTicket,
    financials.expenseRatio,
    financials.bestDay,
    financials.expenseCategories,
    financials.expenses,
    financials.growth,
    financials.prevRange,
    hasData,
    topPayment,
    topExpense,
    anomalies,
  ]);

  const handleExport = async (endpoint: string, baseName: string, type: "pdf" | "excel") => {
    if (exporting) return;
    setExporting(endpoint);
    try {
      const filename = `${baseName}_${fromDate}_${toDate}`;
      if (type === "excel") {
        await exportService.downloadExcel(endpoint, filename, {
          start_date: fromDate,
          end_date: toDate,
        });
      } else {
        await exportService.downloadPdf(endpoint, filename, {
          start_date: fromDate,
          end_date: toDate,
        });
      }
    } finally {
      setExporting(null);
    }
  };

  const handleExportDay = () => {
    if (!selectedDay) return;
    const rows: Array<Array<string | number>> = [];
    dayInvoices.forEach((inv) => {
      rows.push([
        selectedDay.date,
        "فاتورة",
        String(inv.id ?? ""),
        String(inv.client_name || inv.client_name_ar || "عميل"),
        paymentLabel(String(inv.payment_method ?? "")),
        safeNum(inv.total_amount),
      ]);
    });
    dayExpenses.forEach((e) => {
      rows.push([
        selectedDay.date,
        "مصروف",
        String(e.id ?? ""),
        String(e.title || e.description || "مصروف"),
        expenseCategoryLabel(String(e.category ?? "عام")),
        -Math.abs(safeNum(e.amount)),
      ]);
    });
    if (!rows.length) {
      toast.error("لا توجد حركات لهذا اليوم للتصدير");
      return;
    }
    downloadCsvFile(`day_detail_${selectedDay.date}`, ["التاريخ", "النوع", "الرقم", "البيان", "التصنيف", "المبلغ"], rows);
    toast.success("تم تصدير تفاصيل اليوم بنجاح");
  };

  const handleExportCategory = () => {
    if (!selectedExpenseCategory || !categoryMovements.length) {
      toast.error("لا توجد حركات لهذا البند للتصدير");
      return;
    }
    const rows = categoryMovements.map((e) => [
      dayKeyOf(e.expense_date ?? e.created_at),
      String(e.title || e.description || "مصروف"),
      expenseCategoryLabel(String(e.category ?? "عام")),
      safeNum(e.amount),
    ]);
    downloadCsvFile(`category_${selectedExpenseCategory.name}`, ["التاريخ", "البيان", "الفئة", "المبلغ"], rows);
    toast.success("تم تصدير حركات البند بنجاح");
  };

  const handleExportPayment = () => {
    if (!selectedPayment || !paymentInvoices.length) {
      toast.error("لا توجد فواتير لهذه الوسيلة للتصدير");
      return;
    }
    const rows = paymentInvoices.map((inv) => [
      dayKeyOf(inv.created_at),
      String(inv.id ?? ""),
      String(inv.client_name || inv.client_name_ar || "عميل"),
      paymentLabel(String(inv.payment_method ?? "")),
      safeNum(inv.total_amount),
    ]);
    downloadCsvFile(
      `payment_${selectedPayment.name}_${fromDate}_${toDate}`,
      ["التاريخ", "رقم الفاتورة", "العميل", "وسيلة الدفع", "المبلغ"],
      rows,
    );
    toast.success("تم تصدير فواتير الوسيلة بنجاح");
  };

  return {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    preset,
    setPreset,
    loading,
    refreshing,
    hasLoaded,
    loadError,
    exporting,
    lastUpdated,
    financials,
    monthly,
    monthlyLoading,
    monthlyLoaded,
    autoRefresh,
    setAutoRefresh,
    monthlyTarget,
    editingTarget,
    setEditingTarget,
    targetDraft,
    setTargetDraft,
    savingTarget,
    schedules,
    schedLoading,
    schedBusyId,
    schedFreq,
    setSchedFreq,
    schedChannel,
    setSchedChannel,
    schedPhone,
    setSchedPhone,
    canEditTarget,
    hasData,
    paymentsWithPct,
    topPayment,
    topExpense,
    topDays,
    maxDayNet,
    monthStart,
    isCurrentMonth,
    currentMonthRevenue,
    targetProgress,
    selectedDay,
    setSelectedDay,
    selectedExpenseCategory,
    setSelectedExpenseCategory,
    selectedPayment,
    setSelectedPayment,
    dayInvoices,
    dayExpenses,
    anomalies,
    anomalyDates,
    paymentInvoices,
    categoryMovements,
    forecast,
    aiInsights,
    fetchFinancials,
    fetchSixMonths,
    applyPreset,
    handleCreateSchedule,
    handleToggleSchedule,
    handleDeleteSchedule,
    handleRunScheduleNow,
    handleSaveTarget,
    handleExport,
    handleExportDay,
    handleExportCategory,
    handleExportPayment,
  };
}
