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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/core/utils";
import { PageHeader, PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { StatCard as StatCardDisplay } from "@/components/shared/DisplayComponents";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CashDirectionTab } from "@/features/cashbox/hooks/useCashbox";
import { useCashboxData } from "@/features/cashbox/hooks/useCashboxData";
import { CashboxCharts } from "@/features/cashbox/components/CashboxCharts";
import { CashboxTable } from "@/features/cashbox/components/CashboxTable";
import { formatDateTimeLocal, getTypeLabel, PAYMENT_LABELS, isVoided } from "@/features/cashbox/utils/cashboxHelpers";

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
  } = useCashboxData();

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

  return (
    <div className="erp-page space-y-5 pb-10" dir="rtl">
      <PageHeader
        title="الخزنة المركزية"
        subtitle="الخزنة المركزية • نقدي و رقمي — كل وردية تسمع تلقائياً"
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
        <DialogContent dir="rtl" className="max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="text-base font-black">{viewTx?.transaction_no || `#${viewTx?.id}`} • {viewTx ? getTypeLabel(viewTx.type) : ""}</DialogTitle>
            <DialogDescription className="text-xs">{PAYMENT_LABELS[String(viewTx?.payment_method ?? "cash")] ?? viewTx?.payment_method} • {viewTx?.direction === "in" ? "وارد" : "صادر"}</DialogDescription>
          </DialogHeader>
          {viewTx && (
            <div className="p-5 pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-soft p-3 border">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted">المبلغ</div>
                  <div className={cn("text-lg font-black", viewTx.direction === "in" ? "text-emerald-600" : "text-rose-600")}>{viewTx.direction === "in" ? "+" : "-"}{formatCurrency(viewTx.amount)}</div>
                </div>
                <div className="rounded-xl bg-soft p-3 border">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted">الرصيد بعد</div>
                  <div className="text-lg font-black">{viewTx.balance_after != null ? formatCurrency(viewTx.balance_after) : "—"}</div>
                </div>
              </div>
              <div className="rounded-xl border p-3 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted">النوع</span><span className="font-bold">{getTypeLabel(viewTx.type)}</span></div>
                <div className="flex justify-between"><span className="text-muted">المرجع</span><span className="font-bold">{viewTx.reference_no || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">التاريخ</span><span className="font-bold">{formatDateTimeLocal(viewTx.transaction_date ?? viewTx.created_at)}</span></div>
                <div className="flex justify-between"><span className="text-muted">الحالة</span>{isVoided(viewTx) ? <Badge variant="danger" className="h-5 text-[10px]">ملغاة</Badge> : <Badge className="h-5 bg-emerald-500 text-white text-[10px]">نشط</Badge>}</div>
              </div>
              <div className="rounded-xl bg-soft p-3 border">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">الملاحظات</div>
                <p className="text-sm leading-relaxed">{viewTx.notes || "—"}</p>
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
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCashModal} onOpenChange={setShowCashModal}>
        <DialogContent dir="rtl" className="max-w-sm rounded-2xl p-0 overflow-hidden">
          <div className={cn("h-1 w-full", cashType === "in" ? "bg-emerald-500" : "bg-rose-500")} />
          <DialogHeader className="p-5 text-center">
            <div className={cn("h-12 w-12 rounded-xl mx-auto flex items-center justify-center mb-2", cashType === "in" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
              {cashType === "in" ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
            </div>
            <DialogTitle className="text-base font-black">{cashType === "in" ? "إيداع" : "سحب"} • خزنة نقدية</DialogTitle>
            <DialogDescription className="text-xs">نقدي فقط • سحب/إيداع نقدي</DialogDescription>
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
            <div className="text-xs text-muted">رصيد النقدي: <b className="text-main">{formatCurrency(summary.cash_balance_detail)}</b></div>
            <Select value={cashMethod} onValueChange={setCashMethod}>
              <SelectTrigger className="h-9 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقدي</SelectItem>
                <SelectItem value="card">بطاقة</SelectItem>
                <SelectItem value="bank_transfer">تحويل</SelectItem>
                <SelectItem value="wallet">محفظة</SelectItem>
              </SelectContent>
            </Select>
            <textarea value={cashReason} onChange={(e) => setCashReason(e.target.value)} placeholder="السبب..." className="w-full h-20 rounded-xl border bg-soft p-3 text-sm resize-none outline-none focus:border-slate-900" maxLength={200} />
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
