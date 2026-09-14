import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  BarChart3,
  BellRing,
  Calculator,
  Calendar,
  CalendarRange,
  CreditCard,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  LayoutGrid,
  MousePointer2,
  PieChart as PieChartIcon,
  Play,
  Printer,
  Receipt,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "react-hot-toast";
import api, { staticURL } from "@/services/api";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { aiService } from "@/services/aiService";
import { exportService } from "@/services/exportService";
import { businessSettingsService } from "@/services/businessSettingsService";
import { useAuth } from "@/context/AuthContext";
import AIInsights from "@/components/AIInsights";
import { cn, formatCurrency, formatDateTime } from "@/lib/core/utils";
import { PageHeader, SkeletonCard } from "@/components/shared/PremiumUI";
import {
  CurrencyStatCard,
  StatCard as StatCardDisplay,
} from "@/components/shared/DisplayComponents";

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

type PresetId = "today" | "week" | "month" | "quarter";

const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "7 أيام" },
  { id: "month", label: "الشهر" },
  { id: "quarter", label: "90 يوم" },
];

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
function formatSignedPct(v: number): string {
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

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { name?: string; fill?: string };
}

function FinanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const title = label || payload[0]?.name || payload[0]?.payload?.name || "تفاصيل";
  return (
    <div className="min-w-[180px] rounded-2xl border border-border bg-card/95 p-4 shadow-premium backdrop-blur-md">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted">{title}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color || entry.payload?.fill || "#6366F1" }}
              />
              <span className="truncate text-xs font-bold text-muted">{entry.name}</span>
            </div>
            <span className="shrink-0 text-sm font-black tabular-nums text-main">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function compactTick(v: number): string {
  const n = safeNum(v);
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
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

export default function FinancialReports() {
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

  interface ReportSchedule {
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

      // Previous period daily trends for chart overlay
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

        // Bucket if too many points (same logic as current)
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

      // Merge by canonical Arabic label so legacy English values
      // (e.g. "salaries") roll up into their Arabic bucket ("رواتب").
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

  /** Six-month revenue/expense comparison, fetched on demand (single range query, bucketed client-side). */
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

  /** Auto-refresh every 60s while enabled (polling fallback — WS covers notifications only). */
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

  // Monthly revenue target (EGP) — loaded from backend business settings
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

  // Drill-down state
  const [selectedDay, setSelectedDay] = useState<TrendPoint | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<ExpenseSlice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<{ name: string; value: number } | null>(null);

  // Drill-down detail: filter invoices/expenses for the selected day
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

  // Anomaly detection over the visible daily series
  const anomalies = useMemo(
    () => (hasData ? detectAnomalies(financials.dailyTrends) : []),
    [hasData, financials.dailyTrends],
  );
  const anomalyDates = useMemo(() => new Set(anomalies.map((a) => a.date)), [anomalies]);

  // Payment-method drill-down: invoices paid with the selected method
  const paymentInvoices = useMemo(() => {
    if (!selectedPayment) return [];
    return financials.invoiceRows.filter(
      (inv) => String(inv.payment_method || "cash") === selectedPayment.name,
    );
  }, [selectedPayment, financials.invoiceRows]);

  // Category movements: expense rows composing the selected category (canonical Arabic label match)
  const categoryMovements = useMemo(() => {
    if (!selectedExpenseCategory) return [];
    return financials.expenseRows
      .filter((e) => expenseCategoryLabel(String(e.category ?? "عام")) === selectedExpenseCategory.name)
      .sort((a, b) => String(b.expense_date ?? b.created_at ?? "").localeCompare(String(a.expense_date ?? a.created_at ?? "")));
  }, [selectedExpenseCategory, financials.expenseRows]);

  // 30-day cash-flow projection from recent daily averages
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

  /** Client-side export of the selected day (invoices + expenses) as Excel-ready CSV. */
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

  /** Client-side export of the selected expense category movements as CSV. */
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

  /** Client-side export of the selected payment method invoices as CSV. */
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

  const handlePrint = () => {
    window.print();
  };

  if (loading && !hasLoaded) {
    return (
      <div className="erp-page-container space-y-6 pb-16" dir="rtl">
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Sparkles className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted">
            جاري معالجة البيانات المالية...
          </p>
        </div>
        <div data-stats-grid="true">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SkeletonCard variant="chart" className="lg:col-span-2" height={320} />
          <SkeletonCard variant="chart" height={320} />
        </div>
      </div>
    );
  }

  if (loadError && !hasData && hasLoaded) {
    return (
      <div className="erp-page-container space-y-6 pb-16" dir="rtl">
        <PageHeader
          title="التحليلات المالية الاستراتيجية"
          subtitle="مراقبة الأرباح والتدفقات النقدية ومؤشرات الأداء."
          badge="الرقابة المالية"
          icon={Banknote}
        />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-lg font-black text-main">تعذر تحميل البيانات المالية</p>
            <p className="max-w-md text-sm font-bold text-muted">
              تحقق من الاتصال بالخادم ثم أعد المحاولة. النطاق الحالي: {fromDate} إلى {toDate}.
            </p>
            <Button onClick={fetchFinancials} loading={refreshing}>
              <RefreshCw size={16} /> إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reports = [
    {
      title: "التدقيق الاستراتيجي للنمو",
      desc: "تقرير شامل يجمع الأداء المالي والخدمات الأكثر ربحية وإنتاجية الفريق بنظرة استراتيجية.",
      details: "يتضمن: ملخص KPIs، قائمة Top 5 خدمات، ترتيب أداء الموظفين.",
      icon: Sparkles,
      color: "text-purple-600 bg-purple-500/10",
      format: "PREMIUM PDF",
      endpoint: "/exports/reports/strategic-growth/pdf",
      type: "pdf" as const,
      file: "strategic_growth_report",
    },
    {
      title: "تقرير الإيرادات التفصيلي",
      desc: "كشف محاسبي بالمبيعات والتحصيلات مفصلاً حسب طريقة الدفع لمطابقة الخزينة.",
      details: "يتضمن: التاريخ، رقم الفاتورة، العميل، طريقة الدفع، القيمة الصافية.",
      icon: FileSpreadsheet,
      color: "text-indigo-600 bg-indigo-500/10",
      format: "EXCEL SHEET",
      endpoint: "/exports/reports/revenue/excel",
      type: "excel" as const,
      file: "revenue_report",
    },
    {
      title: "كشف ميزان العمليات اليومي",
      desc: "سجل زمني دقيق للحركات النقدية اليومية خلال الفترة المختارة لضمان دقة الأرشفة.",
      details: "يتضمن: تفصيل الحركات اليومية وإجمالي الوارد والصادر لكل يوم.",
      icon: History,
      color: "text-amber-600 bg-amber-500/10",
      format: "ACCOUNTING PDF",
      endpoint: "/exports/reports/daily/pdf",
      type: "pdf" as const,
      file: "daily_operations_report",
    },
  ];

  return (
    <div className="erp-page-container space-y-6 pb-16" dir="rtl">
      <PageHeader
        title="التحليلات المالية الاستراتيجية"
        subtitle="مراقبة الأرباح والتدفقات النقدية ومؤشرات الأداء بدقة عالية."
        badge="الرقابة المالية"
        icon={Banknote}
        actions={
          <div className="flex w-full flex-col gap-3 print:hidden xl:w-auto">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="نطاقات زمنية سريعة">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  aria-pressed={preset === p.id}
                  className={cn(
                    "h-9 rounded-xl border px-4 text-[11px] font-black transition-all",
                    preset === p.id
                      ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                      : "border-border bg-card text-muted hover:border-primary/40 hover:text-main",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm xl:flex-none">
                <label className="flex items-center gap-2 px-2">
                  <Calendar size={14} className="shrink-0 text-muted" />
                  <span className="sr-only">من تاريخ</span>
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setPreset("month");
                    }}
                    aria-label="من تاريخ"
                    className="w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
                  />
                </label>
                <span className="h-5 w-px bg-border" aria-hidden="true" />
                <label className="flex items-center gap-2 px-2">
                  <Calendar size={14} className="shrink-0 text-muted" />
                  <span className="sr-only">إلى تاريخ</span>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setPreset("month");
                    }}
                    aria-label="إلى تاريخ"
                    className="w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
                  />
                </label>
              </div>
              <Button
                onClick={fetchFinancials}
                loading={refreshing}
                className="h-11 gap-2 px-6 text-xs font-black"
              >
                <RefreshCw size={15} /> تحديث
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="h-11 gap-2 px-5 text-xs font-black print:hidden"
                title="طباعة التقرير أو حفظه PDF"
              >
                <Printer size={15} /> طباعة / PDF
              </Button>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-[11px] font-black text-muted print:hidden">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="تحديث تلقائي" />
                تحديث تلقائي
              </label>
            </div>
          </div>
        }
      />

      <div data-stats-grid="true">
        <CurrencyStatCard
          label="إجمالي الإيرادات"
          value={financials.revenue}
          icon={TrendingUp}
          variant="success"
          trend={
            financials.growth.revenue === null
              ? undefined
              : financials.growth.revenue >= 0
                ? "positive"
                : "negative"
          }
          trendValue={
            financials.growth.revenue === null
              ? undefined
              : formatSignedPct(financials.growth.revenue)
          }
          hint={`${financials.invoiceCount} فاتورة • متوسط ${formatCurrency(financials.avgTicket)}`}
        />
        <CurrencyStatCard
          label="إجمالي المصروفات"
          value={financials.expenses}
          icon={TrendingDown}
          variant="danger"
          trend={
            financials.growth.expenses === null
              ? undefined
              : financials.growth.expenses > 0
                ? "negative"
                : "positive"
          }
          trendValue={
            financials.growth.expenses === null
              ? undefined
              : formatSignedPct(financials.growth.expenses)
          }
          hint={`${financials.expenseCount} بند • ${financials.expenseRatio.toFixed(1)}% من الإيراد`}
        />
        <CurrencyStatCard
          label="صافي الربح"
          value={financials.netProfit}
          icon={Wallet}
          trend={
            financials.growth.net === null
              ? financials.netProfit >= 0
                ? "positive"
                : "negative"
              : financials.growth.net >= 0
                ? "positive"
                : "negative"
          }
          trendValue={
            financials.growth.net === null ? undefined : formatSignedPct(financials.growth.net)
          }
          variant="primary"
          hint={`هامش ${financials.margin.toFixed(1)}%`}
        />
        <StatCardDisplay
          label="هامش الربح"
          value={`${financials.margin.toFixed(1)}%`}
          icon={Target}
          variant="warning"
          hint={
            financials.growth.marginDelta === null
              ? financials.netProfit >= 0
                ? "أداء موجب"
                : "يحتاج مراجعة"
              : `Δ ${formatSignedPct(financials.growth.marginDelta)} نقطة عن الفترة السابقة`
          }
        />
      </div>

      {/* Monthly Revenue Target Progress */}
      {isCurrentMonth && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Target size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                    الهدف الشهري للإيرادات
                  </p>
                  {editingTarget ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={targetDraft}
                        onChange={(e) => setTargetDraft(e.target.value)}
                        className="h-9 w-36 rounded-xl border border-border bg-card px-3 text-sm font-black tabular-nums text-main outline-none focus:border-primary"
                        aria-label="الهدف الشهري"
                      />
                      <Button size="sm" onClick={handleSaveTarget} loading={savingTarget} className="h-9 text-[11px] font-black">
                        حفظ
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingTarget(false);
                          setTargetDraft(String(Math.round(monthlyTarget)));
                        }}
                        className="h-9 text-[11px] font-black"
                      >
                        إلغاء
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-black text-main tabular-nums">
                        {formatCurrency(monthlyTarget)}
                      </p>
                      {canEditTarget && (
                        <button
                          type="button"
                          onClick={() => setEditingTarget(true)}
                          className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-black text-muted hover:text-primary print:hidden"
                        >
                          تعديل
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 sm:w-72">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm font-black text-main">
                    {formatCurrency(currentMonthRevenue)} / {formatCurrency(monthlyTarget)}
                  </span>
                  <span className="text-sm font-black text-primary">{targetProgress.toFixed(1)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${targetProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-bold text-muted">
                  {targetProgress >= 100
                    ? "🎉 تم تحقيق الهدف! تجاوز بنسبة " + (targetProgress - 100).toFixed(1) + "%"
                    : "متبقي " + formatCurrency(Math.max(0, monthlyTarget - currentMonthRevenue)) + " للوصول للهدف"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-muted">
                <Calendar size={12} />
                <span>منذ {monthStart.slice(5).replace("-", "/")} حتى {toDate.slice(5).replace("-", "/")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:p-5 lg:grid-cols-4">
          {[
            { icon: Receipt, label: "عدد الفواتير", value: String(financials.invoiceCount) },
            { icon: Calculator, label: "متوسط الفاتورة", value: formatCurrency(financials.avgTicket) },
            { icon: CreditCard, label: "أعلى وسيلة تحصيل", value: topPayment ? topPayment.label : "—" },
            {
              icon: Activity,
              label: "أفضل يوم (صافي)",
              value: financials.bestDay ? formatCurrency(financials.bestDay.net) : "—",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-soft/60 p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                <m.icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-widest text-muted">
                  {m.label}
                </p>
                <p className="truncate text-sm font-black tabular-nums text-main" title={m.value}>
                  {m.value}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
        </Card>

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-amber-500/15 p-2 text-amber-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <CardTitle>تنبيهات الشذوذ الإحصائي</CardTitle>
                <CardDescription>
                  أيام خارج النمط المعتاد (انحراف ±2σ أو قفزة 3 أضعاف الوسيط) — راجعها قبل اعتماد التقرير
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 p-4 sm:p-6">
            {anomalies.slice(0, 4).map((a) => (
              <div
                key={`${a.date}-${a.kind}`}
                className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-card p-3"
              >
                <AlertTriangle
                  size={16}
                  className={cn("mt-0.5 shrink-0", a.severity === "high" ? "text-rose-600" : "text-amber-600")}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-main">{a.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">
                      {a.kind === "rev_spike" ? "قفزة إيرادات" : a.kind === "exp_spike" ? "قفزة مصروفات" : "هبوط الصافي"}
                    </Badge>
                    {a.severity === "high" && (
                      <Badge className="bg-rose-600 text-[9px] text-white">حرج</Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const t = financials.dailyTrends.find((d) => d.date === a.date);
                        if (t) {
                          setSelectedExpenseCategory(null);
                          setSelectedPayment(null);
                          setSelectedDay(t);
                        }
                      }}
                      className="text-[10px] font-black text-primary hover:underline"
                    >
                      فحص اليوم ←
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Drill-down Detail Panel */}
      {(selectedDay || selectedExpenseCategory || selectedPayment) && (
        <Card className="overflow-hidden border-primary/30 bg-primary/5 animate-in slide-in-from-bottom-4">
          <CardHeader className="flex items-center justify-between border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <MousePointer2 size={18} />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {selectedDay
                    ? `تفاصيل ${selectedDay.date} — ${shortLabel(selectedDay.date)}`
                    : selectedExpenseCategory
                      ? `تفاصيل البند: ${selectedExpenseCategory.name}`
                      : `تحصيلات: ${selectedPayment ? paymentLabel(selectedPayment.name) : ""}`}
                </CardTitle>
                <CardDescription className="text-[10px]">
                  {selectedDay
                    ? "تفاصيل الإيرادات والمصروفات والفواتير لهذا اليوم"
                    : selectedExpenseCategory
                      ? "تحليل مفصل لهذا البند من المصروفات"
                      : "الفواتير المحصلة بهذه الوسيلة خلال الفترة"}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setSelectedDay(null);
                setSelectedExpenseCategory(null);
                setSelectedPayment(null);
              }}
              aria-label="إغلاق التفاصيل"
            >
              <X size={18} />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {selectedDay ? (
              <div className="space-y-5">
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">
                      إيرادات اليوم
                    </p>
                    <p className="text-2xl font-black text-emerald-600 tabular-nums">
                      {formatCurrency(selectedDay.rev)}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-muted">{dayInvoices.length} فاتورة</p>
                  </div>
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">
                      مصروفات اليوم
                    </p>
                    <p className="text-2xl font-black text-rose-600 tabular-nums">
                      {formatCurrency(selectedDay.exp)}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-muted">{dayExpenses.length} مصروف</p>
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl p-4 text-center",
                      selectedDay.net >= 0
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-rose-500/20 bg-rose-500/5",
                    )}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1">
                      {selectedDay.net >= 0 ? "صافي ربح" : "صافي خسارة"}
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-black tabular-nums",
                        selectedDay.net >= 0 ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {formatCurrency(selectedDay.net)}
                    </p>
                  </div>
                </div>

                {/* Invoices list */}
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <Button
                    onClick={handleExportDay}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-[11px] font-black"
                    disabled={dayInvoices.length === 0 && dayExpenses.length === 0}
                  >
                    <FileDown size={14} /> تصدير اليوم Excel
                  </Button>
                  <Button
                    onClick={handlePrint}
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-[11px] font-black"
                  >
                    <Printer size={14} /> طباعة التفاصيل
                  </Button>
                </div>
                {dayInvoices.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-black text-main flex items-center gap-2">
                      <FileText size={14} className="text-emerald-600" />
                      فواتير اليوم ({dayInvoices.length})
                    </h4>
                    <div className="max-h-[220px] space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-card p-2">
                      {dayInvoices.map((inv, idx) => (
                        <div
                          key={inv.id ?? idx}
                          className="flex items-center justify-between rounded-lg border border-border/40 bg-background px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted">
                              #{inv.id ?? idx + 1}
                            </span>
                            <span className="font-bold text-main">
                              {inv.client_name || inv.client_name_ar || "عميل"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted">
                              {paymentLabel(inv.payment_method)}
                            </span>
                            <span className="font-black text-emerald-600 tabular-nums">
                              {formatCurrency(inv.total_amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expenses list */}
                {dayExpenses.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-black text-main flex items-center gap-2">
                      <Receipt size={14} className="text-rose-600" />
                      مصروفات اليوم ({dayExpenses.length})
                    </h4>
                    <div className="max-h-[220px] space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-card p-2">
                      {dayExpenses.map((exp, idx) => (
                        <div
                          key={exp.id ?? idx}
                          className="flex items-center justify-between rounded-lg border border-border/40 bg-background px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted">
                              {expenseCategoryLabel(exp.category ?? "عام")}
                            </span>
                            <span className="font-bold text-main truncate max-w-[160px]">
                              {exp.title || exp.description || "مصروف"}
                            </span>
                          </div>
                          <span className="font-black text-rose-600 tabular-nums">
                            {formatCurrency(exp.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {dayInvoices.length === 0 && dayExpenses.length === 0 && (
                  <p className="text-center text-xs font-bold text-muted py-4">
                    لا توجد فواتير أو مصروفات مسجلة لهذا اليوم
                  </p>
                )}
              </div>
            ) : selectedExpenseCategory ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-main">{selectedExpenseCategory.name}</span>
                      <span className="text-lg font-black tabular-nums text-main">
                        {formatCurrency(selectedExpenseCategory.value)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-bold text-muted">
                      <span>نسبة من إجمالي المصروفات</span>
                      <span>
                        {financials.expenses > 0
                          ? ((selectedExpenseCategory.value / financials.expenses) * 100).toFixed(1) + "%"
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${financials.expenses > 0 ? Math.min(100, (selectedExpenseCategory.value / financials.expenses) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-muted">
                    عدد الحركات: {selectedExpenseCategory.count ?? categoryMovements.length}
                  </p>
                  {categoryMovements.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-black text-main flex items-center gap-2">
                          <Receipt size={14} className="text-rose-600" />
                          الحركات المكونة للبند ({categoryMovements.length})
                        </h4>
                        <Button
                          onClick={handleExportCategory}
                          variant="outline"
                          size="sm"
                          className="gap-2 text-[11px] font-black print:hidden"
                        >
                          <FileDown size={14} /> تصدير Excel
                        </Button>
                      </div>
                      <div className="max-h-[240px] space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-card p-2">
                        {categoryMovements.map((e, idx) => (
                          <div
                            key={e.id ?? idx}
                            className="flex items-center justify-between rounded-lg border border-border/40 bg-background px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] tabular-nums text-muted">
                                {dayKeyOf(e.expense_date ?? e.created_at)}
                              </span>
                              <span className="font-bold text-main truncate max-w-[200px]">
                                {e.title || e.description || "مصروف"}
                              </span>
                            </div>
                            <span className="font-black text-rose-600 tabular-nums">
                              {formatCurrency(e.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedPayment ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-main">
                        {paymentLabel(selectedPayment.name)}
                      </span>
                      <span className="text-lg font-black tabular-nums text-main">
                        {formatCurrency(selectedPayment.value)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-bold text-muted">
                      <span>نسبة من إجمالي الإيرادات</span>
                      <span>
                        {financials.revenue > 0
                          ? ((selectedPayment.value / financials.revenue) * 100).toFixed(1) + "%"
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${financials.revenue > 0 ? Math.min(100, (selectedPayment.value / financials.revenue) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-black text-main flex items-center gap-2">
                      <FileText size={14} className="text-emerald-600" />
                      فواتير {paymentLabel(selectedPayment.name)} ({paymentInvoices.length})
                    </h4>
                    <Button
                      onClick={handleExportPayment}
                      variant="outline"
                      size="sm"
                      className="gap-2 text-[11px] font-black print:hidden"
                      disabled={paymentInvoices.length === 0}
                    >
                      <FileDown size={14} /> تصدير Excel
                    </Button>
                  </div>
                  {paymentInvoices.length > 0 ? (
                    <div className="max-h-[240px] space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-card p-2">
                      {paymentInvoices.map((inv, idx) => (
                        <div
                          key={inv.id ?? idx}
                          className="flex items-center justify-between rounded-lg border border-border/40 bg-background px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] tabular-nums text-muted">
                              {dayKeyOf(inv.created_at)}
                            </span>
                            <span className="font-bold text-main truncate max-w-[200px]">
                              {inv.client_name || inv.client_name_ar || "عميل"}
                            </span>
                          </div>
                          <span className="font-black text-emerald-600 tabular-nums">
                            {formatCurrency(inv.total_amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-xs font-bold text-muted py-4">
                      لا توجد فواتير مسجلة بهذه الوسيلة
                    </p>
                  )}
                </div>
              ) : null
            }
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Activity size={18} />
                </div>
                <CardTitle>تحليل التدفقات النقدية</CardTitle>
              </div>
              <CardDescription>
                مقارنة الإيرادات بالمصروفات • {financials.dailyTrends.length} نقطة زمنية حقيقية من
                الفواتير والمصروفات
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> الإيرادات
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> المصروفات
              </Badge>
              {financials.prevDailyTrends.length > 0 && (
                <>
                  <Badge variant="outline" className="gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 opacity-60" style={{ borderBottom: "2px dashed" }} /> الفترة السابقة (إيراد)
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 opacity-60" style={{ borderBottom: "2px dashed" }} /> الفترة السابقة (مصروف)
                  </Badge>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {!hasData ? (
              <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
                <Activity size={28} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد حركات في هذه الفترة</p>
                <p className="max-w-sm text-xs font-bold text-muted">
                  جرّب توسيع النطاق الزمني أو اختيار preset مختلف لعرض التدفقات النقدية.
                </p>
              </div>
            ) : (
              <div className="h-[300px] w-full sm:h-[340px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={financials.dailyTrends}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="finRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="finExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="finRevPrev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="finExpPrev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                      tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={compactTick}
                      tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                    />
                    <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />
                    {/* Previous period - Revenue (dashed line) */}
                    {financials.prevDailyTrends.length > 0 && (
                      <>
                        <Line
                          type="monotone"
                          data={financials.prevDailyTrends}
                          dataKey="rev"
                          name="إيرادات الفترة السابقة"
                          stroke="#10B981"
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                          strokeOpacity={0.6}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2, stroke: "#10B981", fill: "#fff", strokeOpacity: 0.6 }}
                        />
                        {/* Previous period - Expenses (dashed line) */}
                        <Line
                          type="monotone"
                          data={financials.prevDailyTrends}
                          dataKey="exp"
                          name="مصروفات الفترة السابقة"
                          stroke="#F43F5E"
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                          strokeOpacity={0.6}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2, stroke: "#F43F5E", fill: "#fff", strokeOpacity: 0.6 }}
                        />
                      </>
                    )}
                    {/* Current period - Revenue */}
                    <Area
                      type="monotone"
                      dataKey="rev"
                      name="الإيرادات"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fill="url(#finRev)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#10B981", fill: "#fff" }}
                    />
                    {/* Current period - Expenses */}
                    <Area
                      type="monotone"
                      dataKey="exp"
                      name="المصروفات"
                      stroke="#F43F5E"
                      strokeWidth={2.5}
                      fill="url(#finExp)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#F43F5E", fill: "#fff" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                <PieChartIcon size={18} />
              </div>
              <CardTitle>طرق التحصيل</CardTitle>
            </div>
            <CardDescription>توزيع المبيعات حسب وسيلة الدفع — اضغط أي وسيلة لعرض فواتيرها</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {!paymentsWithPct.length ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
                <CreditCard size={28} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد مدفوعات مسجلة</p>
                <p className="text-xs font-bold text-muted">ستظهر وسائل الدفع فور تسجيل الفواتير.</p>
              </div>
            ) : (
              <>
                <div className="relative mx-auto h-[220px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentsWithPct}
                        innerRadius={68}
                        outerRadius={96}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="label"
                        strokeWidth={0}
                      >
                        {paymentsWithPct.map((p) => (
                          <Cell
                            key={p.name}
                            fill={p.color}
                            onClick={() => {
                              setSelectedDay(null);
                              setSelectedExpenseCategory(null);
                              setSelectedPayment({ name: p.name, value: p.value });
                            }}
                            style={{ cursor: "pointer", outline: "none" }}
                            opacity={selectedPayment && selectedPayment.name !== p.name ? 0.45 : 1}
                          />
                        ))}
                      </Pie>
                      <ReTooltip content={<FinanceTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      الإجمالي
                    </span>
                    <span className="max-w-[160px] truncate text-lg font-black tabular-nums text-main">
                      {formatCurrency(financials.revenue)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto">
                  {paymentsWithPct.map((p) => (
                    <div
                      key={p.name}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                        selectedPayment?.name === p.name
                          ? "border-primary bg-primary/5"
                          : "border-border/50 bg-soft/60 hover:bg-soft",
                      )}
                      onClick={() => {
                        setSelectedDay(null);
                        setSelectedExpenseCategory(null);
                        setSelectedPayment(
                          selectedPayment?.name === p.name ? null : { name: p.name, value: p.value },
                        );
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setSelectedDay(null);
                          setSelectedExpenseCategory(null);
                          setSelectedPayment(
                            selectedPayment?.name === p.name ? null : { name: p.name, value: p.value },
                          );
                        }
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="truncate text-xs font-black text-main">{p.label}</span>
                        <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                          {p.pct.toFixed(0)}%
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-black tabular-nums text-main">
                        {formatCurrency(p.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>هيكل المصروفات</CardTitle>
                <CardDescription>أكبر بنود التكلفة في الفترة المحددة</CardDescription>
              </div>
              {topExpense && (
                <Badge className="shrink-0">{formatCurrency(topExpense.value)}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            {!financials.expenseCategories.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Wallet size={26} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد مصروفات مصنفة</p>
                <p className="text-xs font-bold text-muted">سجّل المصروفات لتظهر هنا بالتفصيل.</p>
              </div>
            ) : (
              financials.expenseCategories.slice(0, 6).map((c, i) => {
                const pct = financials.expenses > 0 ? (c.value / financials.expenses) * 100 : 0;
                return (
                  <div
                    key={`${c.name}-${i}`}
                    className="space-y-1.5 cursor-pointer hover:bg-soft/50 rounded-xl p-2 transition-colors"
                    onClick={() => {
                      setSelectedDay(null);
                      setSelectedPayment(null);
                      setSelectedExpenseCategory(c);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSelectedDay(null);
                        setSelectedPayment(null);
                        setSelectedExpenseCategory(c);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-black text-main">{c.name}</span>
                      <span className="shrink-0 text-xs font-black tabular-nums text-main">
                        {formatCurrency(c.value)} • {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(4, Math.min(100, pct))}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Calendar size={18} />
              </div>
              <div>
                <CardTitle>أفضل الأيام صافياً</CardTitle>
                <CardDescription>أعلى 5 أيام ربحية من البيانات اليومية الحقيقية</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            {!topDays.length || !hasData ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Calendar size={26} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد أيام للعرض بعد</p>
                <p className="text-xs font-bold text-muted">ستُبنى القائمة تلقائياً من الفواتير.</p>
              </div>
            ) : (
              topDays.map((d, i) => (
                <div
                  key={d.date}
                  className="flex items-center gap-3 rounded-2xl border border-border/50 bg-soft/50 p-3 cursor-pointer hover:bg-soft transition-colors"
                  onClick={() => {
                    setSelectedExpenseCategory(null);
                    setSelectedPayment(null);
                    setSelectedDay(d);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSelectedExpenseCategory(null);
                      setSelectedPayment(null);
                      setSelectedDay(d);
                    }
                  }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-sm font-black text-main shadow-sm">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-black tabular-nums text-main">
                        {d.date}
                        {anomalyDates.has(d.date) && (
                          <span title="يوم شاذ إحصائياً">
                            <AlertTriangle size={12} className="text-amber-600" />
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-black tabular-nums",
                          d.net >= 0 ? "text-emerald-600" : "text-rose-600",
                        )}
                      >
                        {formatCurrency(d.net)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/60">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          d.net >= 0 ? "bg-emerald-500" : "bg-rose-500",
                        )}
                        style={{ width: `${Math.max(4, (Math.abs(d.net) / Math.abs(maxDayNet)) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 truncate text-[10px] font-bold tabular-nums text-muted">
                      إيراد {formatCurrency(d.rev)} • مصروف {formatCurrency(d.exp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600">
                  <CalendarRange size={18} />
                </div>
                <div>
                  <CardTitle>مقارنة آخر 6 شهور</CardTitle>
                  <CardDescription>الإيرادات مقابل المصروفات شهرياً من البيانات الحقيقية</CardDescription>
                </div>
              </div>
              {!monthlyLoaded && (
                <Button
                  onClick={fetchSixMonths}
                  loading={monthlyLoading}
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 text-[11px] font-black"
                >
                  <BarChart3 size={14} /> تحميل المقارنة
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {!monthlyLoaded ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CalendarRange size={26} className="text-muted" />
                <p className="text-sm font-black text-main">المقارنة الشهرية جاهزة عند الطلب</p>
                <p className="text-xs font-bold text-muted">اضغط تحميل لجلب 6 شهور وتجميعها شهرياً.</p>
              </div>
            ) : (
              <div className="h-[260px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={compactTick}
                      tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                    />
                    <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />
                    <Bar dataKey="rev" name="الإيرادات" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="exp" name="المصروفات" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="الصافي"
                      stroke="#6366F1"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#6366F1" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-violet-500/10 p-2 text-violet-600">
                <Zap size={18} />
              </div>
              <div>
                <CardTitle>إسقاط التدفق النقدي — 30 يوم</CardTitle>
                <CardDescription>
                  {forecast
                    ? `بناءً على متوسط آخر ${forecast.basisDays} يوم من الفترة الحالية`
                    : "توقع تلقائي من الترند الحالي"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            {!forecast ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Zap size={26} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد بيانات كافية للإسقاط</p>
                <p className="text-xs font-bold text-muted">اختر نطاقاً زمنياً فيه حركات مالية.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">إيراد متوقع</p>
                    <p className="mt-1 text-sm font-black tabular-nums text-emerald-600">
                      {formatCurrency(forecast.projRev)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-600">مصروف متوقع</p>
                    <p className="mt-1 text-sm font-black tabular-nums text-rose-600">
                      {formatCurrency(forecast.projExp)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl border p-3",
                      forecast.projNet >= 0
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-rose-500/20 bg-rose-500/5",
                    )}
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted">صافي متوقع</p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-black tabular-nums",
                        forecast.projNet >= 0 ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {formatCurrency(forecast.projNet)}
                    </p>
                  </div>
                </div>
                <div className="h-[150px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={forecast.cumulative} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="finForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tickFormatter={compactTick}
                        tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                      />
                      <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />
                      <Area
                        type="monotone"
                        dataKey="net"
                        name="الصافي التراكمي المتوقع"
                        stroke="#8B5CF6"
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        fill="url(#finForecast)"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] font-bold text-muted">
                  متوسط يومي: إيراد {formatCurrency(forecast.avgRev)} • مصروف {formatCurrency(forecast.avgExp)} — الإسقاط خطي ويفترض استمرار نفس الوتيرة.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {canEditTarget && (
        <Card className="overflow-hidden print:hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-teal-500/10 p-2 text-teal-600">
                <BellRing size={18} />
              </div>
              <div>
                <CardTitle>التقارير المالية المجدولة</CardTitle>
                <CardDescription>
                  إرسال تلقائي لملخص الإيرادات والمصروفات والصافي — إشعار داخل النظام و/أو واتساب
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-border bg-soft/60 p-3">
              <label className="flex flex-col gap-1 text-[11px] font-black text-muted">
                التكرار
                <select
                  value={schedFreq}
                  onChange={(e) => setSchedFreq(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-black text-main outline-none"
                >
                  <option value="daily">يومي</option>
                  <option value="weekly">أسبوعي</option>
                  <option value="monthly">شهري</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black text-muted">
                القناة
                <select
                  value={schedChannel}
                  onChange={(e) => setSchedChannel(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-black text-main outline-none"
                >
                  <option value="notification">إشعار داخلي</option>
                  <option value="whatsapp">واتساب</option>
                  <option value="both">الاثنان معاً</option>
                </select>
              </label>
              {(schedChannel === "whatsapp" || schedChannel === "both") && (
                <label className="flex flex-col gap-1 text-[11px] font-black text-muted">
                  رقم الواتساب (اختياري — وإلا رقم المحل)
                  <input
                    value={schedPhone}
                    onChange={(e) => setSchedPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    className="h-10 w-40 rounded-xl border border-border bg-card px-3 text-xs font-black tabular-nums text-main outline-none"
                  />
                </label>
              )}
              <Button
                onClick={handleCreateSchedule}
                loading={schedBusyId === "new"}
                disabled={schedBusyId !== null}
                className="h-10 gap-2 text-xs font-black"
              >
                <BellRing size={15} /> إنشاء جدولة
              </Button>
            </div>

            {schedLoading ? (
              <p className="py-6 text-center text-xs font-bold text-muted">جاري تحميل الجداول...</p>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <BellRing size={24} className="text-muted" />
                <p className="text-sm font-black text-main">لا توجد جداول بعد</p>
                <p className="text-xs font-bold text-muted">أنشئ أول جدولة ليصلك الملخص المالي تلقائياً.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {schedules.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                      s.is_active ? "border-border/60 bg-card" : "border-border/40 bg-soft/40 opacity-70",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-main">
                        {s.name} • {s.frequency === "daily" ? "يومي" : s.frequency === "weekly" ? "أسبوعي" : "شهري"} •{" "}
                        {s.channel === "notification" ? "إشعار داخلي" : s.channel === "whatsapp" ? "واتساب" : "إشعار + واتساب"}
                      </p>
                      <p className="mt-1 text-[10px] font-bold tabular-nums text-muted">
                        {s.last_run_at
                          ? `آخر تشغيل: ${s.last_run_at.slice(0, 16).replace("T", " ")} (${s.last_status === "ok" ? "ناجح" : "فشل"})`
                          : "لم يُشغَّل بعد"}
                        {s.next_run_at ? ` • التالي: ${s.next_run_at.slice(0, 16).replace("T", " ")}` : ""}
                      </p>
                      {s.last_summary && (
                        <p className="mt-1 line-clamp-2 text-[10px] font-bold leading-relaxed text-muted">
                          {s.last_summary}
                        </p>
                      )}
                      {s.last_pdf_url && (
                        <a
                          href={`${staticURL}${s.last_pdf_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-soft/60 px-2.5 py-1 text-[10px] font-black text-primary hover:underline"
                        >
                          <FileDown size={12} /> تحميل آخر PDF
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <label className="flex items-center gap-2 text-[10px] font-black text-muted">
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={() => handleToggleSchedule(s)}
                          aria-label="تفعيل الجدولة"
                        />
                        {s.is_active ? "مفعّلة" : "متوقفة"}
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRunScheduleNow(s)}
                        loading={schedBusyId === s.id}
                        disabled={schedBusyId !== null}
                        className="gap-1.5 text-[11px] font-black"
                        title="تشغيل فوري"
                      >
                        <Play size={13} /> الآن
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSchedule(s)}
                        disabled={schedBusyId !== null}
                        className="gap-1.5 text-[11px] font-black text-rose-600"
                        aria-label="حذف الجدولة"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden bg-slate-950 text-white">
        <div className="relative z-10 space-y-6 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-xl">
                <Sparkles size={26} className="animate-pulse text-amber-300" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                  المستشار المالي الذكي
                </h3>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/60">
                  تحليل فعلي للبيانات الحالية وتوصيات نمو قابلة للتنفيذ
                </p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit border-white/20 text-[10px] font-black text-white/80">
              AI POWERED
            </Badge>
          </div>
          <AIInsights data={aiInsights} isSidebar />
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-500/10 blur-[100px]" />
      </Card>

      <div className="space-y-5 print:hidden">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary p-2.5 text-white shadow-lg shadow-primary/20">
            <LayoutGrid size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-main sm:text-2xl">
              مركز التقارير التنفيذية
            </h2>
            <p className="text-xs font-bold text-muted sm:text-sm">
              تصدير مستندات محاسبية معتمدة للفترة {fromDate} إلى {toDate}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((item) => (
            <Card key={item.endpoint} className="group overflow-hidden transition-all hover:-translate-y-1">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105",
                      item.color,
                    )}
                  >
                    <item.icon size={26} />
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest opacity-70">
                    {item.format}
                  </Badge>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-black text-main">{item.title}</h3>
                  <p className="mb-3 text-xs font-bold leading-relaxed text-muted">{item.desc}</p>
                  <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-soft/60 p-3">
                    <Info size={14} className="mt-0.5 shrink-0 text-primary" />
                    <p className="text-[11px] font-bold leading-relaxed text-muted">{item.details}</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleExport(item.endpoint, item.file, item.type)}
                  loading={exporting === item.endpoint}
                  disabled={exporting !== null || !hasData}
                  className="h-12 w-full gap-2 rounded-2xl text-xs font-black"
                >
                  <Download size={16} /> إصدار التقرير الآن
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-1 border-t border-border/60 py-5 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          آخر تدقيق مالي: {formatDateTime(lastUpdated)} • النطاق {fromDate} إلى {toDate}
          {financials.prevRange && (
            <> • مقارنة بالفترة {financials.prevRange.from} إلى {financials.prevRange.to}</>
          )}
        </span>
        {financials.truncated && (
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
            عرض أحدث {financials.invoiceCount} من أصل {financials.totalInvoices} فاتورة (حد العرض
            5000 سجل)
          </span>
        )}
        {refreshing && (
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            جاري التحديث...
          </span>
        )}
        {autoRefresh && (
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
            التحديث التلقائي مفعّل (كل 60 ثانية)
          </span>
        )}
      </div>
    </div>
  );
}
