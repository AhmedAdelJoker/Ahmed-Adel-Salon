import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  Download,
  ArrowRightLeft,
  Printer,
  Filter,
  TrendingUp,
  TrendingDown,
  Eye,
  X,
  CreditCard,
  Package,
  Users,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "react-hot-toast";
import cashboxService from "@/services/cashboxService";
import api from "@/services/api";
import { adaptList, adaptObject } from "@/services/apiAdapter";
import type { CashboxSummary, Transaction } from "@/types/cashbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/core/utils";
import {
  StatCard as StatCardDisplay,
  CurrencyStatCard,
  ChartCard,
} from "@/components/shared/DisplayComponents";
import { motion, AnimatePresence } from "framer-motion";
import {
  PageHeader,
  PremiumCard,
} from "@/components/shared/PremiumUI";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Clock } from "lucide-react";

const TYPE_LABELS = {
  invoice_payment: "تحصيل فاتورة",
  expense_payment: "دفع مصروف",
  manual_deposit: "إيداع يدوي",
  manual_withdraw: "سحب يدوي",
  opening_balance: "رصيد افتتاحي",
  closing_balance: "رصيد إغلاق",
  refund: "استرداد",
};

const TYPE_COLORS = {
  manual_deposit: "#10b981",
  invoice_payment: "#6366f1",
  manual_withdraw: "#ef4444",
  expense_payment: "#f59e0b",
  refund: "#06b6d4",
};

const SYSTEM_LINKS = [
  { label: "نقطة البيع", icon: Receipt, desc: "كل فاتورة تُنشئ حركة خزنة تلقائية", color: "bg-indigo-500", href: "/pos" },
  { label: "المصروفات", icon: TrendingDown, desc: "المصروف يسجل سحب من الخزنة", color: "bg-rose-500", href: "/expenses" },
  { label: "الرواتب", icon: Users, desc: "صرف الراتب يسحب من الرصيد", color: "bg-amber-500", href: "/owner/payroll" },
  { label: "المخزون", icon: Package, desc: "توريد المخزون يُنشئ مصروف وحركة", color: "bg-emerald-500", href: "/inventory" },
];

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  } catch (err) {
    return String(value);
  }
}

export default function Cashbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<CashboxSummary>({ total_in: 0, total_out: 0, cash_balance: 0, today_sales: 0, today_expenses: 0, today_net: 0 });
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashType, setCashType] = useState("in");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashMethod, setCashMethod] = useState("cash");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [viewTx, setViewTx] = useState<Transaction | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  async function loadCashbox(silent = false) {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const [summaryRes, txRes] = await Promise.all([
        cashboxService.getSummary(),
        cashboxService.listTransactions({ limit: 200 }),
      ]);
      setSummary(adaptObject(summaryRes, { total_in: 0, total_out: 0, cash_balance: 0, today_sales: 0, today_expenses: 0, today_net: 0 }) ?? { total_in: 0, total_out: 0, cash_balance: 0, today_sales: 0, today_expenses: 0, today_net: 0 });
      setTransactions(adaptList(txRes));
    } catch (_error) {
      toast.error("فشل تحميل بيانات الخزنة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadCashbox(); }, []);

  const filteredAll = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    return transactions.filter((row) => {
      const rowDate = row.transaction_date || row.created_at ? new Date(String(row.transaction_date || row.created_at)) : null;
      const isVoided = Number(row.is_voided || 0) === 1;
      if (activeTab === "in" && row.direction !== "in") return false;
      if (activeTab === "out" && row.direction !== "out") return false;
      if (activeTab === "voided" && !isVoided) return false;
      if (quickFilter === "today") {
        if (!rowDate) return false;
        if (rowDate.getFullYear() !== now.getFullYear() || rowDate.getMonth() !== now.getMonth() || rowDate.getDate() !== now.getDate()) return false;
      }
      if (start && (!rowDate || rowDate < start)) return false;
      if (end && (!rowDate || rowDate > end)) return false;
      if (!term) return true;
      return [row.transaction_no, row.reference_no, row.type, row.notes, row.payment_method].filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
    });
  }, [transactions, searchTerm, quickFilter, startDate, endDate, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredAll.length / pageSize));
  const visibleRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAll.slice(start, start + pageSize);
  }, [filteredAll, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, quickFilter, startDate, endDate, activeTab]);

  // 7-day trend
  const trendData = useMemo(() => {
    const days: { name: string; in: number; out: number; net: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("ar-EG", { weekday: "short" });
      const dayTx = transactions.filter((r) => {
        const rd = r.transaction_date || r.created_at;
        return rd && String(rd).slice(0, 10) === key && Number(r.is_voided || 0) !== 1;
      });
      const inSum = dayTx.filter((r) => r.direction === "in").reduce((a, b) => a + Number(b.amount || 0), 0);
      const outSum = dayTx.filter((r) => r.direction === "out").reduce((a, b) => a + Number(b.amount || 0), 0);
      days.push({ name: label, in: inSum, out: outSum, net: inSum - outSum });
    }
    return days;
  }, [transactions]);

  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAll.filter((r) => Number(r.is_voided || 0) !== 1).forEach((r) => {
      const label = TYPE_LABELS[r.type ?? ""] || r.type || "غير محدد";
      map[label] = (map[label] || 0) + Number(r.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredAll]);

  async function handleCreateCash() {
    if (!cashAmount || Number(cashAmount) <= 0) return toast.error("أدخل مبلغ صحيح");
    if (!cashReason.trim()) return toast.error("أدخل سبب الحركة");
    if (cashType === "out" && Number(cashAmount) > Number(summary.cash_balance) && String(user?.role).toLowerCase() !== "owner") {
      // Allow owner to overdraw, but warn
      toast.error("❌ الرصيد غير كافي");
      return;
    }
    try {
      await cashboxService.createTransaction({
        direction: cashType,
        amount: Number(cashAmount),
        notes: cashReason,
        payment_method: cashMethod,
      });
      toast.success("✅ تم تسجيل حركة الخزنة");
      setShowCashModal(false);
      setCashAmount("");
      setCashReason("");
      setCashMethod("cash");
      loadCashbox(true);
    } catch (e) {
      const apiErr = e as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr?.response?.data?.detail as string) || "فشل تسجيل العملية");
    }
  }

  function exportVisibleRowsCsv() {
    if (!visibleRows.length) return toast.error("لا توجد بيانات للتصدير");
    const headers = ["transaction_no", "date", "direction", "type", "amount", "payment_method", "reference_no", "notes", "balance_after"];
    const rows = visibleRows.map((r) => [
      r.transaction_no || `#${r.id}`,
      r.transaction_date || r.created_at || "",
      r.direction === "in" ? "وارد" : "صادر",
      TYPE_LABELS[r.type ?? ""] || r.type || "",
      r.amount,
      r.payment_method || "",
      r.reference_no || "",
      (r.notes || "").replace(/"/g, '""'),
      r.balance_after ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cashbox_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  const handlePrintReceipt = async (txId) => {
    try {
      toast.loading("جاري تجهيز الإيصال...", { id: "print-tx" });
      const response = await api.get(`/cashbox/transactions/${txId}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `receipt_TX_${txId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("تم تحميل الإيصال", { id: "print-tx" });
    } catch (_error) {
      toast.error("فشل توليد الإيصال", { id: "print-tx" });
    }
  };

  const openView = (row) => {
    setViewTx(row);
    setIsViewOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-accent">
          <div className="h-12 w-12 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
          <p className="text-sm font-black text-muted">جاري مزامنة بيانات الخزنة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-6 pb-10" dir="rtl">
      <PageHeader
        title="خزينة المحل"
        subtitle="القلب المالي للنظام — كل جنيه داخل وخارج يمر من هنا"
        badge="الخزنة المركزية"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => { setCashType("in"); setShowCashModal(true); }} className="h-11 rounded-xl px-5 font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 gap-2">
              <ArrowUpCircle size={18} /> إيداع
            </Button>
            <Button onClick={() => { setCashType("out"); setShowCashModal(true); }} className="h-11 rounded-xl px-5 font-black bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20 gap-2">
              <ArrowDownCircle size={18} /> سحب
            </Button>
            <Button variant="outline" onClick={() => loadCashbox(true)} disabled={refreshing} className="h-11 w-11 rounded-xl border-2 p-0">
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
            </Button>
          </div>
        }
      />

      {/* System Relations */}
      <PremiumCard noPadding className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/30">
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center"><ArrowRightLeft size={16} /></div>
            <div>
              <h3 className="text-sm font-black text-main">ترابط الخزينة مع النظام</h3>
              <p className="text-[11px] font-bold text-muted">الخزنة هي المرآة الحية لكل العمليات المالية</p>
            </div>
            <Badge variant="outline" className="mr-auto hidden sm:flex rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-black">تحديث لحظي</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {SYSTEM_LINKS.map((link) => (
              <button key={link.label} onClick={() => navigate(link.href)} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right hover:border-slate-900 hover:shadow-md transition-all">
                <div className={cn("h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0", link.color)}><link.icon size={18} /></div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-xs font-black text-main flex items-center gap-1">{link.label} <ArrowUpRight size={12} className="text-muted group-hover:text-slate-900" /></div>
                  <div className="text-[10px] font-bold text-muted leading-tight mt-0.5 line-clamp-2">{link.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      {/* Stats - fixed heights, no overlap */}
      <div data-stats-grid="true">
        <StatCardDisplay
          label="الرصيد المتاح"
          value={formatCurrency(summary.cash_balance)}
          icon={Wallet}
          variant="dark"
          hint="محمي بالتدقيق"
        />
        <CurrencyStatCard
          label="إجمالي الداخل"
          value={summary.total_in}
          icon={ArrowUpCircle}
          variant="success"
        />
        <CurrencyStatCard
          label="إجمالي الخارج"
          value={summary.total_out}
          icon={ArrowDownCircle}
          variant="danger"
        />
        <StatCardDisplay
          label="صافي اليوم"
          value={formatCurrency(summary.today_net)}
          icon={Number(summary.today_net) >= 0 ? TrendingUp : TrendingDown}
          variant={Number(summary.today_net) >= 0 ? "success" : "danger"}
          hint={`دخل ${formatCurrency(summary.today_sales)} • خرج ${formatCurrency(summary.today_expenses)}`}
        />
      </div>

      {/* Charts - fixed-height, no-overlap wrappers */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <ChartCard
          className="xl:col-span-3"
          title="تدفق آخر 7 أيام"
          subtitle="مقارنة الوارد والصادر اليومي"
          badge={
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold flex-wrap justify-end max-w-full">
              <span className="flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-emerald-500" /> وارد</span>
              <span className="flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-rose-500" /> صادر</span>
              <span className={cn("flex items-center gap-1 px-2 py-1 rounded-full bg-soft border border-border text-[10px] whitespace-nowrap")}><TrendingUp size={12} /> صافي:&nbsp;
                <span className={cn("font-black", Number(summary.today_net) >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(summary.today_net)}</span>
              </span>
            </div>
          }
          data={trendData}
          height={280}
          emptyTitle="لا توجد حركات آخر 7 أيام"
          emptyHint="سيظهر التدفق هنا بعد تسجيل إيداع نقدي من الكاشير"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 800 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 11, fontWeight: 800 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} width={44} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name) => [formatCurrency(value), name === "in" ? "وارد" : name === "out" ? "صادر" : "صافي"]} labelFormatter={(l) => `يوم ${l}`} contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }} />
              <Area type="monotone" dataKey="in" name="وارد" stroke="#10b981" fill="url(#gradIn)" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: "white" }} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="out" name="صادر" stroke="#ef4444" fill="url(#gradOut)" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: "white" }} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="net" name="صافي" stroke="#6366f1" strokeDasharray="6 3" fill="none" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-3 hidden sm:grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2 min-w-0">
              <div className="text-[9px] font-black text-muted uppercase truncate">إجمالي وارد 7 أيام</div>
              <div className="text-xs font-black text-emerald-700 truncate">{formatCurrency(trendData.reduce((a,b)=>a+b.in,0))}</div>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-2 min-w-0">
              <div className="text-[9px] font-black text-muted uppercase truncate">إجمالي صادر</div>
              <div className="text-xs font-black text-rose-700 truncate">{formatCurrency(trendData.reduce((a,b)=>a+b.out,0))}</div>
            </div>
            <div className="rounded-xl bg-slate-900 text-white p-2 min-w-0">
              <div className="text-[9px] font-black text-white/60 uppercase truncate">الصافي</div>
              <div className="text-xs font-black truncate">{formatCurrency(trendData.reduce((a,b)=>a+b.net,0))}</div>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="توزيع الأنواع"
          subtitle="حركة الخزنة حسب نوع العملية"
          badge={
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft border-border whitespace-nowrap">
              {typeBreakdown.length} أنواع
            </Badge>
          }
          data={typeBreakdown}
          height={220}
          emptyTitle="لا توجد أنواع لعرضها"
          emptyHint="سجل إيداع نقدي ليظهر التوزيع"
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" stroke="none">
                {typeBreakdown.map((entry, idx) => {
                  const key = Object.keys(TYPE_LABELS).find(k => TYPE_LABELS[k] === entry.name) || entry.name;
                  const color = TYPE_COLORS[key] || `hsl(${(idx*47)%360} 70% 50%)`;
                  return <Cell key={idx} fill={color} stroke="white" strokeWidth={2} />;
                })}
              </Pie>
              <Tooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-1 gap-1.5 mt-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
            {typeBreakdown.map((t) => {
              const key = Object.keys(TYPE_LABELS).find(k => TYPE_LABELS[k] === t.name) || t.name;
              const color = TYPE_COLORS[key] || "#6b7280";
              const pct = ((t.value / typeBreakdown.reduce((a,b)=>a+b.value,0))*100).toFixed(1);
              return (
                <div key={t.name} className="flex items-center gap-2 rounded-xl border border-border bg-soft/50 px-3 py-2 min-w-0">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-black text-main truncate flex-1 min-w-0">{t.name}</span>
                  <span className="text-[10px] font-bold text-muted shrink-0">{pct}%</span>
                  <span className="text-xs font-black text-main shrink-0 truncate">{formatCurrency(t.value)}</span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6 min-w-0">
        {/* Filters Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-4 h-fit">
          <PremiumCard className="p-5 space-y-5">
            <div className="flex items-center gap-2 text-xs font-black text-main uppercase tracking-widest border-b border-border/40 pb-3">
              <Filter className="w-4 h-4 text-accent" /> فلترة ذكية
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">بحث شامل</label>
              <div className="relative group">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="رقم العملية، مرجع، ملاحظات..." className="h-11 pr-10 rounded-xl bg-soft border-border font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase">من</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-xl bg-soft border-border text-xs font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase">إلى</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-xl bg-soft border-border text-xs font-bold" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase">فلترة سريعة</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "الكل" },
                  { id: "today", label: "اليوم" },
                  { id: "voided", label: "الملغاة" },
                ].map((btn) => (
                  <button key={btn.id} onClick={() => setQuickFilter(btn.id)} className={cn("px-3.5 py-2 rounded-xl text-xs font-black transition-all border", quickFilter === btn.id ? "bg-slate-900 text-white border-slate-900" : "bg-soft text-muted border-border hover:bg-card")}>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" onClick={exportVisibleRowsCsv} className="w-full h-11 rounded-xl font-black gap-2">
              <Download size={16} /> تصدير CSV
            </Button>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
              <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold leading-relaxed text-amber-800">لا يمكن حذف الحركة، فقط إلغاء مع حفظ الأثر للتدقيق.</p>
            </div>
          </PremiumCard>
          <PremiumCard className="p-4 bg-slate-900 text-white border-0">
            <div className="text-xs font-black">رصيد الخزنة الحي</div>
            <div className="text-2xl font-black tabular-nums mt-1">{formatCurrency(summary.cash_balance)}</div>
            <div className="text-[11px] font-bold text-white/60 mt-1">يتحدث بعد كل فاتورة ومصروف وراتب</div>
          </PremiumCard>
        </div>

        {/* Transactions */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-1.5 bg-soft border border-border p-1.5 rounded-2xl w-fit overflow-x-auto max-w-full">
            {[
              { id: "all", label: "الكل", icon: ArrowRightLeft, count: filteredAll.length },
              { id: "in", label: "وارد", icon: ArrowUpCircle },
              { id: "out", label: "صادر", icon: ArrowDownCircle },
              { id: "voided", label: "ملغاة", icon: X },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all", activeTab === tab.id ? "bg-card text-slate-900 shadow-sm border border-border" : "text-muted hover:text-main")}>
                <tab.icon size={14} /> {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
              </button>
            ))}
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            <AnimatePresence>
              {visibleRows.map((row) => {
                const isIn = row.direction === "in";
                const isVoided = Number(row.is_voided || 0) === 1;
                return (
                  <motion.div key={row.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("rounded-2xl border bg-card p-4 shadow-sm", isVoided && "opacity-60")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", isIn ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                          {isIn ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-main truncate">{row.transaction_no || `#${row.id}`}</div>
                          <div className="text-xs font-bold text-muted truncate">{TYPE_LABELS[row.type ?? ""] || row.type}</div>
                        </div>
                      </div>
                      <div className={cn("text-sm font-black tabular-nums", isVoided ? "line-through text-muted" : isIn ? "text-emerald-600" : "text-rose-600")}>
                        {isIn ? "+" : "-"}{formatCurrency(row.amount)}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-muted">
                      <span className="flex items-center gap-1"><Clock size={12} />{formatDateTime(row.transaction_date || row.created_at).split("،")[0]}</span>
                      <span className="flex items-center gap-1"><CreditCard size={12} />{row.payment_method || "cash"}</span>
                      <button onClick={() => openView(row)} className="h-8 px-3 rounded-xl bg-slate-900 text-white font-black flex items-center gap-1"><Eye size={12} /> عرض</button>
                    </div>
                    {row.notes && <p className="mt-2 text-xs font-bold text-muted/80 bg-soft rounded-xl p-2 border border-border/40 line-clamp-2">{row.notes}</p>}
                    {row.balance_after !== null && row.balance_after !== undefined && <div className="mt-2 text-[10px] font-black text-muted">الرصيد بعد: <span className="text-main">{formatCurrency(row.balance_after)}</span></div>}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Desktop Table */}
          <PremiumCard noPadding className="hidden lg:block overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[24%]" />
                  <col className="w-[9%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[15%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <thead>
                  <tr className="bg-soft/50 border-b border-border">
                    <th className="px-4 py-4 text-right text-[10px] font-black text-muted uppercase tracking-widest">العملية</th>
                    <th className="px-4 py-4 text-right text-[10px] font-black text-muted uppercase">البيان</th>
                    <th className="px-3 py-4 text-right text-[10px] font-black text-muted uppercase">الدفع</th>
                    <th className="px-3 py-4 text-right text-[10px] font-black text-muted uppercase">الرصيد بعد</th>
                    <th className="px-3 py-4 text-right text-[10px] font-black text-muted uppercase">الوقت</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black text-muted uppercase">القيمة</th>
                    <th className="px-2 py-4 text-center text-[10px] font-black text-muted uppercase">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  <AnimatePresence mode="popLayout">
                    {visibleRows.map((row) => {
                      const isIn = row.direction === "in";
                      const isVoided = Number(row.is_voided || 0) === 1;
                      return (
                        <motion.tr key={row.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn("group hover:bg-soft/30 transition-colors", isVoided && "opacity-40")}>
                          <td className="px-4 py-4 overflow-hidden">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", isIn ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                                {isIn ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                              </div>
                              <span className="text-sm font-black text-main truncate min-w-0 flex-1" dir="ltr" title={row.transaction_no || `#${row.id}`}>
                                {row.transaction_no || `#${row.id}`}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 overflow-hidden">
                            <div className="text-sm font-bold text-main truncate" title={TYPE_LABELS[row.type ?? ""] || row.type || ""}>
                              {TYPE_LABELS[row.type ?? ""] || row.type}
                            </div>
                            <div className="text-[11px] font-bold text-muted truncate" title={row.notes || row.reference_no || "—"}>
                              {row.notes ? `"${row.notes.slice(0, 32)}"` : row.reference_no ? `مرجع: ${row.reference_no}` : "بدون ملاحظات"}
                            </div>
                            {isVoided && <Badge variant="danger" className="mt-1 h-4 text-[8px] px-1.5">ملغاة</Badge>}
                          </td>
                          <td className="px-3 py-4 overflow-hidden"><Badge variant="outline" className="rounded-lg text-[10px] font-black whitespace-nowrap">{row.payment_method || "cash"}</Badge></td>
                          <td className="px-3 py-4 text-xs font-black tabular-nums text-main overflow-hidden">
                            <span className="block truncate" dir="ltr" title={row.balance_after !== null && row.balance_after !== undefined ? formatCurrency(row.balance_after) : "—"}>
                              {row.balance_after !== null && row.balance_after !== undefined ? formatCurrency(row.balance_after) : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-[11px] font-bold text-muted overflow-hidden">
                            <span className="block truncate" title={formatDateTime(row.transaction_date || row.created_at)}>
                              {formatDateTime(row.transaction_date || row.created_at)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-left overflow-hidden">
                            <span className={cn("text-[14px] font-black tabular-nums whitespace-nowrap block", isVoided ? "line-through text-muted" : isIn ? "text-emerald-600" : "text-rose-600")} dir="ltr">
                              {isIn ? "+" : "−"}{formatCurrency(row.amount)}
                            </span>
                          </td>
                          <td className="px-2 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openView(row)} className="h-8 w-8 rounded-xl hover:bg-slate-900 hover:text-white" title="عرض">
                                <Eye size={14} />
                              </Button>
                              {row.type?.includes("manual") && !isVoided && (
                                <Button variant="ghost" size="icon" onClick={() => handlePrintReceipt(row.id)} className="h-8 w-8 rounded-xl text-accent hover:bg-accent/10" title="طباعة">
                                  <Printer size={14} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {visibleRows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-soft border border-border flex items-center justify-center"><Activity size={20} className="text-muted/40" /></div>
                <h3 className="mt-3 text-sm font-black text-main">لا توجد سجلات</h3>
                <p className="text-xs font-bold text-muted">جرب تغيير الفلاتر أو إنشاء حركة جديدة</p>
              </div>
            )}
          </PremiumCard>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-muted">صفحة {currentPage} من {totalPages} • {filteredAll.length} سجل</p>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}><ArrowUpCircle className="rotate-90" size={16} /></Button>
                <span className="text-sm font-black min-w-[40px] text-center bg-card border border-border rounded-xl py-1.5">{currentPage}</span>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}><ArrowDownCircle className="rotate-90" size={16} /></Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Details Modal - Read Only */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent dir="rtl" className="max-w-lg rounded-[2rem] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]">
          <div className={cn("p-6 text-white relative overflow-hidden", viewTx?.direction === "in" ? "bg-gradient-to-br from-emerald-600 to-emerald-700" : "bg-gradient-to-br from-rose-600 to-rose-700")}>
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                {viewTx?.direction === "in" ? <ArrowUpCircle size={22} /> : <ArrowDownCircle size={22} />}
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white leading-tight">{viewTx?.transaction_no || `#${viewTx?.id}`}</DialogTitle>
                <DialogDescription className="text-xs font-bold text-white/80">{viewTx ? TYPE_LABELS[viewTx.type ?? ""] || viewTx.type : ""} • قراءة فقط</DialogDescription>
              </div>
              <Badge className={cn("mr-auto rounded-full px-3 py-1 text-[10px] font-black border-0", viewTx?.direction === "in" ? "bg-white text-emerald-700" : "bg-white text-rose-700")}>
                {viewTx?.direction === "in" ? "وارد" : "صادر"}
              </Badge>
            </div>
          </div>
          {viewTx ? (
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft border border-border p-4">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">المبلغ</div>
                  <div className={cn("text-lg font-black", viewTx.direction === "in" ? "text-emerald-600" : "text-rose-600")}>{viewTx.direction === "in" ? "+" : "-"}{formatCurrency(viewTx.amount)}</div>
                  <div className="text-[11px] font-bold text-muted">{viewTx.payment_method || "cash"}</div>
                </div>
                <div className="rounded-2xl bg-soft border border-border p-4">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">الرصيد بعد</div>
                  <div className="text-lg font-black text-slate-900">{viewTx.balance_after !== null && viewTx.balance_after !== undefined ? formatCurrency(viewTx.balance_after) : "-"}</div>
                  <div className="text-[11px] font-bold text-muted">بعد هذه الحركة</div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex justify-between text-xs"><span className="font-black text-muted">النوع</span><span className="font-black text-main">{TYPE_LABELS[viewTx.type ?? ""] || viewTx.type}</span></div>
                <div className="flex justify-between text-xs"><span className="font-black text-muted">المرجع</span><span className="font-black text-main">{viewTx.reference_no || "-"}</span></div>
                <div className="flex justify-between text-xs"><span className="font-black text-muted">التاريخ</span><span className="font-black text-main">{formatDateTime(viewTx.transaction_date || viewTx.created_at)}</span></div>
                <div className="flex justify-between text-xs"><span className="font-black text-muted">الحالة</span>{Number(viewTx.is_voided || 0) === 1 ? <Badge variant="danger" className="h-5 text-[10px]">ملغاة</Badge> : <Badge className="h-5 bg-emerald-500 text-white text-[10px]">معتمدة</Badge>}</div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black text-muted uppercase tracking-widest">الملاحظات</div>
                <div className="rounded-2xl border border-border bg-soft/50 p-4 min-h-[60px]">
                  <p className="text-sm font-bold leading-relaxed text-main whitespace-pre-wrap">{viewTx.notes || "لا توجد ملاحظات."}</p>
                </div>
              </div>
              {viewTx.type?.includes("manual") && Number(viewTx.is_voided || 0) !== 1 && (
                <Button onClick={() => handlePrintReceipt(viewTx.id)} variant="outline" className="w-full h-11 rounded-xl font-black gap-2">
                  <Printer size={16} /> طباعة الإيصال PDF
                </Button>
              )}
              <Button onClick={() => setIsViewOpen(false)} className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black">إغلاق</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create Transaction Modal */}
      <Dialog open={showCashModal} onOpenChange={setShowCashModal}>
        <DialogContent dir="rtl" className="max-w-md rounded-[1.75rem] p-0 overflow-hidden border-0 shadow-2xl bg-card">
          <div className={cn("h-2 w-full", cashType === "in" ? "bg-emerald-500" : "bg-rose-500")} />
          <DialogHeader className="p-6 pb-4 text-center">
            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3", cashType === "in" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
              {cashType === "in" ? <ArrowUpCircle size={28} /> : <ArrowDownCircle size={28} />}
            </div>
            <DialogTitle className="text-xl font-black text-main">{cashType === "in" ? "إيداع نقدي" : "سحب نقدي"}</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted">سيتم تسجيل الحركة في السجل الرسمي مع رقم تلقائي</DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-0 space-y-5">
            <div className="flex bg-soft border border-border rounded-2xl p-1">
              <button onClick={() => setCashType("in")} className={cn("flex-1 h-10 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition-all", cashType === "in" ? "bg-emerald-600 text-white shadow" : "text-muted")}>
                <ArrowUpCircle size={14} /> إيداع
              </button>
              <button onClick={() => setCashType("out")} className={cn("flex-1 h-10 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition-all", cashType === "out" ? "bg-rose-600 text-white shadow" : "text-muted")}>
                <ArrowDownCircle size={14} /> سحب
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">المبلغ *</label>
              <div className="relative">
                <Input type="number" placeholder="0.00" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="h-14 text-2xl font-black text-center rounded-2xl border-2 focus:border-slate-900 bg-soft pr-4 pl-12" autoFocus />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted">ج.م</span>
              </div>
              <div className="text-[11px] font-bold text-muted">الرصيد الحالي: <span className="text-main font-black">{formatCurrency(summary.cash_balance)}</span> {cashType === "out" && Number(cashAmount) > Number(summary.cash_balance) && <span className="text-rose-600">• غير كافي</span>}</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">طريقة الدفع</label>
              <Select value={cashMethod} onValueChange={setCashMethod}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="wallet">محفظة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">السبب *</label>
              <textarea placeholder="مثال: سلفة موظف، مصروف طارئ..." value={cashReason} onChange={(e) => setCashReason(e.target.value)} className="w-full h-24 rounded-2xl border-2 border-border bg-soft p-4 text-sm font-bold focus:border-slate-900 outline-none resize-none" />
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 gap-2 flex-row">
            <Button variant="outline" onClick={() => setShowCashModal(false)} className="flex-1 h-11 rounded-xl font-black">إلغاء</Button>
            <Button onClick={handleCreateCash} disabled={!cashAmount || Number(cashAmount) <= 0 || !cashReason.trim()} className={cn("flex-1 h-11 rounded-xl font-black text-white", cashType === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700")}>
              تأكيد {cashType === "in" ? "الإيداع" : "السحب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
