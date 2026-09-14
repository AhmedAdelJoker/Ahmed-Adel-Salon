import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Wallet,
  Download,
  TrendingUp,
  TrendingDown,
  X,
  Package,
  Users,
  Receipt,
  Banknote,
  CreditCard,
  Smartphone,
  Landmark,
  ArrowRightLeft,
  User,
  ShieldCheck,
  Clock,
  FileText,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/core/utils";
import { PageHeader, PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { StatCard as StatCardDisplay } from "@/components/shared/DisplayComponents";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCashbox, type CashDirectionTab } from "@/features/cashbox/hooks/useCashbox";
import { CashboxCharts } from "@/features/cashbox/components/CashboxCharts";
import { CashboxTable } from "@/features/cashbox/components/CashboxTable";
import {
  formatDateTimeLocal,
  getTypeLabel,
  PAYMENT_LABELS,
  isVoided,
  buildCashboxCsv,
  getCreator,
  getRoleMeta,
  getLinkedEntity,
  parseRecipientNotes,
} from "@/features/cashbox/utils/cashboxHelpers";
import type { Transaction } from "@/types/cashbox";
import cashboxService from "@/services/cashboxService";
import { staticURL } from "@/services/api";

const SYSTEM_LINKS = [
  { label: "نقطة البيع", icon: Receipt, href: "/pos" },
  { label: "المصروفات", icon: TrendingDown, href: "/expenses" },
  { label: "الرواتب", icon: Users, href: "/owner/payroll" },
  { label: "المخزون", icon: Package, href: "/inventory" },
] as const;

const PERIODS = [
  { id: "all", label: "الكل" },
  { id: "day", label: "اليوم" },
  { id: "week", label: "أسبوع" },
  { id: "month", label: "شهر" },
  { id: "year", label: "سنة" },
] as const;

export default function Cashbox() {
  const navigate = useNavigate();
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
  const [cashRecipient, setCashRecipient] = useState("");
  const [cashRef, setCashRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewTx, setViewTx] = useState<Transaction | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const openView = (row: Transaction) => {
    setViewTx(row);
    setIsViewOpen(true);
  };

  const handleCreateCash = async () => {
    if (!cashAmount || Number(cashAmount) <= 0) return toast.error("أدخل مبلغ صحيح");
    if (!cashReason.trim() || cashReason.trim().length < 3) return toast.error("أدخل سبب واضح (3 أحرف على الأقل)");
    try {
      setIsSubmitting(true);
      const ok = await createTransaction({
        direction: cashType,
        amount: Number(cashAmount),
        notes: cashReason.trim(),
        payment_method: cashMethod,
        recipient_name: cashRecipient.trim() || undefined,
        reference_no: cashRef.trim() || undefined,
      });
      if (ok) {
        setShowCashModal(false);
        setCashAmount("");
        setCashReason("");
        setCashMethod("cash");
        setCashRecipient("");
        setCashRef("");
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

  if (loading) {
    return (
      <div className="erp-page space-y-5 pb-10" dir="rtl">
        <div className="h-20 rounded-2xl bg-soft animate-pulse border border-border" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} variant="stats" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SkeletonCard variant="chart" className="h-[320px]" />
          <SkeletonCard variant="chart" className="h-[320px]" />
        </div>
      </div>
    );
  }

  const isPeriod = period !== "all";
  const cashMain = isPeriod ? summary.period_cash_net : summary.cash_balance_detail;
  const cashSub = isPeriod ? `${summary.period_label} • ${formatCurrency(summary.period_cash_in)} → ${formatCurrency(summary.period_cash_out)}` : `وارد ${formatCurrency(summary.cash_in)} • صادر ${formatCurrency(summary.cash_out)}`;
  const digitalMain = isPeriod ? summary.period_non_cash_net : summary.non_cash_balance;
  const totalMain = isPeriod ? summary.period_net : summary.cash_balance;

  return (
    <div className="erp-page space-y-5 pb-10" dir="rtl">
      <PageHeader
        title="الخزنة المركزية"
        subtitle="الخزنة المركزية • نقدي و رقمي — كل وردية وكل حركة تسمع تلقائياً"
        badge="الخزنة"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-9 rounded-xl gap-1.5">
              <Download size={14} /> تصدير
            </Button>
            <Button size="sm" onClick={() => { setCashType("in"); setShowCashModal(true); }} className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              <ArrowUpCircle size={14} /> إيداع
            </Button>
            <Button size="sm" onClick={() => { setCashType("out"); setShowCashModal(true); }} className="h-9 rounded-xl bg-rose-600 hover:bg-rose-700 gap-1.5">
              <ArrowDownCircle size={14} /> سحب
            </Button>
            <Button variant="ghost" size="icon" onClick={() => refresh()} disabled={refreshing} className="h-9 w-9 rounded-xl border border-border">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-soft border border-border p-1 rounded-xl">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as typeof period)}
              className={cn("px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all", period === p.id ? "bg-slate-900 text-white" : "text-muted hover:text-main")}
            >
              {p.label}
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <button onClick={() => setPeriod("custom")} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", period === "custom" ? "bg-slate-900 text-white" : "text-muted")}>
            مخصص
          </button>
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 rounded-lg text-xs w-[140px]" />
            <span className="text-xs text-muted">—</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 rounded-lg text-xs w-[140px]" />
          </div>
        )}
        <Badge variant="outline" className="rounded-full text-[10px] hidden sm:flex">
          {summary.period_label}
        </Badge>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs font-bold text-muted hover:text-main flex items-center gap-1">
            <X size={12} /> مسح
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <button onClick={() => setPaymentMethod("cash")} className="text-right">
          <PremiumCard className={cn("p-5 border-l-4 hover:shadow-md transition-all text-right", paymentMethod === "cash" ? "border-l-emerald-500 bg-emerald-50/40" : "border-l-emerald-500")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-widest uppercase text-muted flex items-center gap-1.5">
                <Banknote size={12} className="text-emerald-600" /> نقدي
              </span>
              <Badge variant="outline" className="text-[10px] rounded-full h-5 px-2">
                {paymentMethod === "cash" ? "نشط" : "نقدي فقط"}
              </Badge>
            </div>
            <div className="text-2xl font-black tracking-tight mt-2 tabular-nums">{formatCurrency(cashMain)}</div>
            <div className="text-xs font-medium text-muted mt-1 truncate">{cashSub}</div>
            <div className="text-[11px] font-bold mt-2 text-emerald-700">سحب و إيداع نقدي فقط</div>
          </PremiumCard>
        </button>

        <button onClick={() => setPaymentMethod("non_cash")} className="text-right">
          <PremiumCard className={cn("p-5 border-l-4 hover:shadow-md transition-all text-right", paymentMethod === "non_cash" ? "border-l-indigo-500 bg-indigo-50/40" : "border-l-indigo-500")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-widest uppercase text-muted flex items-center gap-1.5">
                <CreditCard size={12} className="text-indigo-600" /> رقمي
              </span>
              <Badge variant="outline" className="text-[10px] rounded-full h-5 px-2">
                {paymentMethod === "non_cash" ? "نشط" : "بطاقة/محفظة"}
              </Badge>
            </div>
            <div className="text-2xl font-black tracking-tight mt-2 tabular-nums">{formatCurrency(digitalMain)}</div>
            <div className="text-xs font-medium text-muted mt-1 truncate">
              <span className="inline-flex items-center gap-1"><CreditCard size={10} /> {formatCurrency(byMethod.find((m) => m.method === "card")?.value ?? 0)}</span>
              <span className="mx-1.5">•</span>
              <span className="inline-flex items-center gap-1"><Landmark size={10} /> {formatCurrency(byMethod.find((m) => m.method === "bank_transfer")?.value ?? 0)}</span>
              <span className="mx-1.5">•</span>
              <span className="inline-flex items-center gap-1"><Smartphone size={10} /> {formatCurrency(byMethod.find((m) => m.method === "wallet")?.value ?? 0)}</span>
            </div>
            <div className="text-[11px] font-bold mt-2 text-indigo-700">مبيعات غير نقدية</div>
          </PremiumCard>
        </button>

        <PremiumCard className="p-5 border-l-4 border-l-slate-900 bg-slate-900 text-white text-right">
          <div className="text-[11px] font-bold tracking-widest uppercase text-white/60">الإجمالي</div>
          <div className="text-2xl font-black tracking-tight mt-2 tabular-nums">{formatCurrency(totalMain)}</div>
          <div className="text-xs font-medium text-white/60 mt-1 truncate">
            {isPeriod ? `الصافي ${formatCurrency(summary.period_net)} • ${summary.period_label}` : `وارد ${formatCurrency(summary.total_in)} • صادر ${formatCurrency(summary.total_out)}`}
          </div>
          <div className="text-[11px] font-bold mt-2 text-white/80">الخزنة المركزية • ديناميكي</div>
        </PremiumCard>
      </div>

      <div className="flex flex-wrap gap-2">
        {SYSTEM_LINKS.map((l) => (
          <button key={l.label} onClick={() => navigate(l.href)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-bold hover:border-slate-900 hover:bg-soft transition-colors">
            <l.icon size={12} /> {l.label}
          </button>
        ))}
        <span className="text-xs text-muted mr-2 hidden sm:inline-flex items-center">المبيعات • المصروفات • الرواتب • المشتريات ← الخزنة</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCardDisplay label={isPeriod ? `الصافي • ${summary.period_label}` : "الصافي • اليوم"} value={formatCurrency(isPeriod ? summary.period_net : summary.today_net)} icon={isPeriod ? TrendingUp : TrendingUp} variant={Number(isPeriod ? summary.period_net : summary.today_net) >= 0 ? "success" : "danger"} hint={isPeriod ? `نقدي ${formatCurrency(summary.period_cash_net)} • رقمي ${formatCurrency(summary.period_non_cash_net)}` : `نقدي ${formatCurrency(summary.cash_today_net)} • رقمي ${formatCurrency(summary.non_cash_today_net)}`} />
        <StatCardDisplay label="حركة النقدي" value={`${formatCurrency(isPeriod ? summary.period_cash_in : summary.cash_in)} → ${formatCurrency(isPeriod ? summary.period_cash_out : summary.cash_out)}`} icon={Banknote} variant="primary" hint="وارد → صادر" />
        <StatCardDisplay label="حركة الرقمي" value={`${formatCurrency(isPeriod ? summary.period_non_cash_in : summary.non_cash_in)} → ${formatCurrency(isPeriod ? summary.period_non_cash_out : summary.non_cash_out)}`} icon={CreditCard} variant="secondary" hint="بطاقة / تحويل / محفظة" />
      </div>

      <CashboxCharts trend={trend} breakdown={breakdown} todayNet={isPeriod ? summary.period_net : summary.today_net} byMethod={byMethod} />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted">
            <span>الفلترة</span>
            <span className="flex-1 h-px bg-border" />
          </div>
          <PremiumCard noPadding className="overflow-hidden">
            <div className="p-4 space-y-3">
              <div className="relative">
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="بحث برقم العملية، ملاحظات..." className="h-9 pr-9 rounded-xl text-sm" />
                <ArrowRightLeft size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
              <div className="flex gap-2">
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9 rounded-xl text-xs font-bold flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الطرق</SelectItem>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="non_cash">رقمي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="bank_transfer">تحويل</SelectItem>
                    <SelectItem value="wallet">محفظة</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 rounded-xl text-xs font-bold flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    <SelectItem value="invoice_payment">مبيعات</SelectItem>
                    <SelectItem value="expense_payment">مصروفات</SelectItem>
                    <SelectItem value="manual_deposit">إيداع</SelectItem>
                    <SelectItem value="manual_withdraw">سحب</SelectItem>
                    <SelectItem value="opening_balance">افتتاحي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period !== "custom" && (
                <div className="flex gap-2">
                  <Input type="date" value={startDate} onChange={(e) => { setPeriod("custom"); setStartDate(e.target.value); }} className="h-8 rounded-lg text-xs flex-1" />
                  <Input type="date" value={endDate} onChange={(e) => { setPeriod("custom"); setEndDate(e.target.value); }} className="h-8 rounded-lg text-xs flex-1" />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters} className="flex-1 h-8 rounded-lg text-xs">مسح</Button>
                <Button variant="ghost" size="sm" onClick={() => refresh()} className="h-8 rounded-lg text-xs">تحديث</Button>
              </div>
              <div className="text-[11px] text-muted font-medium pt-2 border-t border-border/40">
                {totalCount} سجل • {transactions.length} معروض
              </div>
            </div>
          </PremiumCard>
          <div className="rounded-xl bg-soft border border-border p-3 text-xs leading-relaxed text-muted font-medium">
            المبيعات والمصروفات والمشتريات والرواتب تسجل تلقائياً في الخزنة حسب طريقة الدفع.
          </div>
        </div>

        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-1.5 bg-soft border border-border p-1 rounded-xl w-fit">
            {[
              { id: "all", label: "الكل", count: totalCount },
              { id: "in", label: "وارد" },
              { id: "out", label: "صادر" },
              { id: "voided", label: "ملغاة" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDirection(tab.id as CashDirectionTab)}
                className={cn("px-3.5 py-1.5 rounded-lg text-xs font-bold", direction === tab.id ? "bg-white shadow border border-border text-main" : "text-muted hover:text-main")}
              >
                {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            {[
              { id: "all", label: "الكل" },
              { id: "cash", label: "نقدي" },
              { id: "non_cash", label: "رقمي" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                className={cn("px-3 py-1 rounded-full text-xs font-bold border", paymentMethod === m.id ? "bg-slate-900 text-white border-slate-900" : "bg-card text-muted border-border")}
              >
                {m.label}
              </button>
            ))}
            <button onClick={() => { setDirection("out"); setPaymentMethod("cash"); }} className="mr-auto text-xs font-bold text-rose-600 hover:underline hidden sm:block">
              سحب نقدي فقط
            </button>
          </div>

          <CashboxTable rows={transactions} onView={openView} onPrint={downloadReceipt} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-muted">
                صفحة {currentPage} / {totalPages} • {totalCount}
              </span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                  <ArrowUpCircle className="rotate-90" size={14} />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                  <ArrowDownCircle className="rotate-90" size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent dir="rtl" className="max-w-lg rounded-2xl p-0 overflow-hidden bg-card max-h-[90vh] flex flex-col">
          {viewTx ? (
            (() => {
              const creator = getCreator(viewTx);
              const roleMeta = getRoleMeta(creator.role);
              const linked = getLinkedEntity(viewTx);
              const { cleanNotes, recipient, reference } = parseRecipientNotes(viewTx.notes);
              const isIn = viewTx.direction === "in";
              return (
                <>
                  <div className={cn("p-5 text-white relative overflow-hidden shrink-0", isIn ? "bg-gradient-to-br from-emerald-600 to-emerald-700" : "bg-gradient-to-br from-rose-600 to-rose-700")}>
                    <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
                        {isIn ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black truncate">{viewTx.transaction_no || `#${viewTx.id}`} • {getTypeLabel(viewTx.type)}</div>
                        <div className="text-xs font-bold text-white/80 truncate">{PAYMENT_LABELS[String(viewTx.payment_method ?? "cash")] ?? viewTx.payment_method} • {isIn ? "وارد" : "صادر"}</div>
                      </div>
                      <Badge className={cn("rounded-full px-3 py-1 text-[10px] font-black border-0 shrink-0", isIn ? "bg-white text-emerald-700" : "bg-white text-rose-700")}>
                        {isIn ? "وارد" : "صادر"}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* المنشئ — عالمي متوسط */}
                    <div className="rounded-xl border bg-soft/50 p-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center overflow-hidden shrink-0">
                        {creator.avatar ? (
                          <img src={creator.avatar.startsWith("http") ? creator.avatar : `${staticURL}${creator.avatar}`} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User size={16} className="text-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black truncate flex items-center gap-2">
                          {creator.name}
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black border", roleMeta.bg)}>{roleMeta.label}</span>
                        </div>
                        <div className="text-xs font-bold text-muted flex items-center gap-1">
                          <Clock size={10} /> {formatDateTimeLocal(viewTx.created_at ?? viewTx.transaction_date)}
                          <span className="h-1 w-1 rounded-full bg-border mx-1" />
                          {isVoided(viewTx) ? <span className="text-rose-600">ملغاة</span> : <span className="text-emerald-600">نشط</span>}
                        </div>
                      </div>
                      <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-soft p-3 border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted">المبلغ</div>
                        <div className={cn("text-lg font-black", isIn ? "text-emerald-600" : "text-rose-600")}>{isIn ? "+" : "-"}{formatCurrency(viewTx.amount)}</div>
                        <div className="text-[11px] font-bold text-muted">{PAYMENT_LABELS[String(viewTx.payment_method ?? "cash")] ?? viewTx.payment_method}</div>
                      </div>
                      <div className="rounded-xl bg-soft p-3 border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted">الرصيد بعد</div>
                        <div className="text-lg font-black">{viewTx.balance_after != null ? formatCurrency(viewTx.balance_after) : "—"}</div>
                        <div className="text-[11px] font-bold text-muted">بعد الحركة</div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-3 space-y-2.5 text-xs bg-card">
                      <div className="flex justify-between"><span className="text-muted font-bold">النوع</span><span className="font-black">{getTypeLabel(viewTx.type)}</span></div>
                      <div className="flex justify-between"><span className="text-muted font-bold">المرجع</span><span className="font-black">{reference || viewTx.reference_no || "—"}</span></div>
                      {recipient && <div className="flex justify-between"><span className="text-muted font-bold">المستفيد</span><span className="font-black">{recipient}</span></div>}
                      <div className="flex justify-between"><span className="text-muted font-bold">التاريخ</span><span className="font-bold">{formatDateTimeLocal(viewTx.transaction_date ?? viewTx.created_at)}</span></div>
                      <div className="flex justify-between"><span className="text-muted font-bold">الخزنة</span><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black border", viewTx.payment_method === "cash" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-indigo-50 border-indigo-200 text-indigo-700")}>{PAYMENT_LABELS[String(viewTx.payment_method ?? "cash")] ?? viewTx.payment_method}</span></div>
                      {linked && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted font-bold">الترابط</span>
                          <button onClick={() => linked.href && navigate(linked.href)} className="font-black text-indigo-600 hover:underline flex items-center gap-1 text-xs">
                            {linked.label} <ExternalLink size={10} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl bg-soft p-3 border">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1 flex items-center gap-1"><FileText size={10} /> الملاحظات</div>
                      <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{cleanNotes || "—"}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => downloadReceipt(viewTx.id)} className="flex-1 h-9 rounded-xl text-xs gap-1">
                        <Download size={12} /> PDF
                      </Button>
                      <Button onClick={() => setIsViewOpen(false)} className="flex-1 h-9 rounded-xl bg-slate-900 text-white text-xs">
                        إغلاق
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showCashModal} onOpenChange={setShowCashModal}>
        <DialogContent dir="rtl" className="max-w-sm rounded-2xl p-0 overflow-hidden">
          <div className={cn("h-1 w-full", cashType === "in" ? "bg-emerald-500" : "bg-rose-500")} />
          <DialogHeader className="p-5 text-center">
            <div className={cn("h-12 w-12 rounded-xl mx-auto flex items-center justify-center mb-2", cashType === "in" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
              {cashType === "in" ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
            </div>
            <DialogTitle className="text-base font-black">{cashType === "in" ? "إيداع" : "سحب"} • خزنة</DialogTitle>
            <DialogDescription className="text-xs">إضافة تفاصيل أكثر — كل حركة مرتبطة بالمنشئ والخزنة</DialogDescription>
          </DialogHeader>
          <div className="p-5 pt-0 space-y-3">
            <div className="flex bg-soft border rounded-xl p-1">
              <button onClick={() => setCashType("in")} className={cn("flex-1 h-8 rounded-lg text-xs font-bold", cashType === "in" ? "bg-emerald-600 text-white" : "text-muted")}>
                إيداع
              </button>
              <button onClick={() => setCashType("out")} className={cn("flex-1 h-8 rounded-lg text-xs font-bold", cashType === "out" ? "bg-rose-600 text-white" : "text-muted")}>
                سحب
              </button>
            </div>
            <div className="relative">
              <Input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0.00" className="h-12 text-xl font-black text-center pr-4 pl-10 rounded-xl" autoFocus />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">ج.م</span>
            </div>
            <div className="text-xs text-muted">رصيد النقدي: <b className="text-main">{formatCurrency(summary.cash_balance_detail)}</b> • الرقمي: <b className="text-main">{formatCurrency(summary.non_cash_balance)}</b></div>

            <Select value={cashMethod} onValueChange={setCashMethod}>
              <SelectTrigger className="h-9 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقدي — خزنة الكاش</SelectItem>
                <SelectItem value="card">بطاقة — خزنة رقمية</SelectItem>
                <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                <SelectItem value="wallet">محفظة</SelectItem>
              </SelectContent>
            </Select>

            <Input value={cashRecipient} onChange={(e) => setCashRecipient(e.target.value)} placeholder="المستفيد / المودع (اختياري)" className="h-9 rounded-xl text-sm" />
            <Input value={cashRef} onChange={(e) => setCashRef(e.target.value)} placeholder="رقم المرجع (اختياري)" className="h-9 rounded-xl text-sm" />
            <textarea value={cashReason} onChange={(e) => setCashReason(e.target.value)} placeholder="السبب / التفاصيل..." className="w-full h-20 rounded-xl border bg-soft p-3 text-sm resize-none outline-none focus:border-slate-900" maxLength={300} />
            <div className="text-[11px] text-muted">سيُحفظ مع اسمك ودورك ({/* role hint */} ) ويرتبط بالخزنة {cashMethod === "cash" ? "النقدية" : "الرقمية"}.</div>
          </div>
          <DialogFooter className="p-4 pt-0 flex gap-2">
            <Button variant="outline" onClick={() => setShowCashModal(false)} className="flex-1 h-9 rounded-xl text-xs">
              إلغاء
            </Button>
            <Button onClick={handleCreateCash} disabled={!cashAmount || Number(cashAmount) <= 0 || !cashReason.trim() || isSubmitting} className={cn("flex-1 h-9 rounded-xl text-xs text-white", cashType === "in" ? "bg-emerald-600" : "bg-rose-600")}>
              {isSubmitting ? "..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
