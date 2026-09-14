import { motion } from "framer-motion";
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Archive,
  Lock,
  Eye,
  Receipt,
  BarChart3,
  FolderArchive,
  Search,
  Landmark,
  PieChart,
  ChevronDown,
  User,
  Scissors,
  CreditCard,
  FileText,
  Unlock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, formatCurrency } from "@/lib/core/utils";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PremiumUI";
import { AnimatePresence } from "framer-motion";
import { useInvoiceArchive } from "@/features/invoice-archive";

function InvoiceArchivePage() {
  const navigate = useNavigate();
  const {
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
  } = useInvoiceArchive();

  const statCards = [
    {
      label: "إجمالي المبيعات",
      value: summary ? formatCurrency(summary.totalRevenue) : "—",
      icon: DollarSign,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "الفواتير المؤرشفة",
      value: summary ? summary.totalInvoices : "—",
      icon: Receipt,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "الأشهر المغلقة",
      value: summary ? `${summary.closedCount} / ${months.length}` : "—",
      icon: FolderArchive,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "متوسط الشهر",
      value: summary ? formatCurrency(summary.avg) : "—",
      icon: Landmark,
      color: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-900/20",
    },
  ];

  return (
    <div className="min-h-screen" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
        <PageHeader className={undefined}
          title="الأرشيف الشهري للفواتير"
          subtitle="استعرض وأغلق فواتير الأشهر المنتهية أو أعدها للمراجعة — كل الفلاتر والإجراءات من هنا"
          badge="الأرشيف المالي"
          icon={Archive}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-xl px-4"
                onClick={() => navigate("/invoices")}
              >
                <Receipt size={16} className="ml-2" /> الفواتير الحالية
              </Button>
              <Button
                onClick={handleExportPDF}
                className="h-10 rounded-xl bg-emerald-600 px-4 hover:bg-emerald-700"
              >
                <DownloadIcon /> تصدير PDF
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 rounded-premium bg-card border border-border/70 animate-pulse"
              />
            ))}
          </div>
        ) : (
          summary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {statCards.map(({ label, value, icon: Icon, color, bg }: any) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:shadow-premium"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted">
                        {label}
                      </p>
                      <p className="mt-1.5 truncate text-xl font-black tabular-nums text-main">
                        {value}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        bg,
                      )}
                    >
                      <Icon size={20} className={color} />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )
        )}

        {!loading && months.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-l from-primary/5 to-transparent p-5"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BarChart3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-main">
                    نظرة عامة على أداء الأشهر
                  </h3>
                  <p className="text-[10px] font-bold text-muted">
                    اضغط على أي شهر لعرض فواتيره بالأسفل
                  </p>
                </div>
              </div>
              {comparison && (
                <div className="hidden items-center gap-2 sm:flex">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      comparison.diff >= 0
                        ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20"
                        : "bg-red-50 text-red-500 dark:bg-red-900/20",
                    )}
                  >
                    {comparison.diff >= 0 ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                  </span>
                  <div className="text-left">
                    <p
                      className={cn(
                        "text-xs font-black tabular-nums",
                        comparison.diff >= 0
                          ? "text-emerald-500"
                          : "text-red-500",
                      )}
                    >
                      {Number(comparison.pct) > 0 ? "+" : ""}
                      {comparison.pct}%
                    </p>
                    <p className="text-[9px] font-bold text-muted">
                      {comparison.current.label_ar} مقابل{" "}
                      {comparison.previous.label_ar}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {months.slice(0, 12).map((month) => {
                const width = Math.max(
                  4,
                  Math.round(((month.total_amount || 0) / maxRevenue) * 100),
                );
                const isActive = expandedKey === month.key;
                return (
                  <button
                    key={`bar-${month.key}`}
                    onClick={() => toggleExpand(month)}
                    className={cn(
                      "group block w-full text-right transition-opacity hover:opacity-100",
                      !isActive && "opacity-85",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-black">
                      <span
                        className={cn(
                          "flex items-center gap-1.5",
                          isActive ? "text-primary" : "text-main",
                        )}
                      >
                        {month.label_ar}
                        <span className="rounded-md bg-soft px-1.5 py-0.5 text-[9px] font-bold text-muted">
                          {month.invoice_count} فاتورة
                        </span>
                      </span>
                      <span className="tabular-nums text-muted group-hover:text-main">
                        {formatCurrency(month.total_amount)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-soft">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full",
                          month.is_closed
                            ? "bg-gradient-to-l from-zinc-400 to-zinc-300"
                            : "bg-gradient-to-l from-emerald-500 to-teal-400",
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {comparison && (
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <p className="text-[9px] font-bold text-muted uppercase mb-1">
                    فواتير الشهر الحالي
                  </p>
                  <p className="text-sm font-black tabular-nums text-main">
                    {comparison.current.invoice_count}
                  </p>
                  <p
                    className={cn(
                      "text-[9px] font-bold",
                      comparison.invDiff >= 0
                        ? "text-emerald-500"
                        : "text-red-500",
                    )}
                  >
                    {comparison.invDiff > 0 ? "+" : ""}
                    {comparison.invDiff} عن الشهر السابق
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <p className="text-[9px] font-bold text-muted uppercase mb-1">
                    متوسط الفاتورة
                  </p>
                  <p className="text-sm font-black tabular-nums text-main">
                    {formatCurrency(
                      (comparison.current.total_amount || 0) /
                        Math.max(1, comparison.current.invoice_count),
                    )}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <p className="text-[9px] font-bold text-muted uppercase mb-1">
                    نسبة التحصيل
                  </p>
                  <p className="text-sm font-black tabular-nums text-main">
                    {summary?.totalInvoices
                      ? `${Math.round((summary.totalPaid / summary.totalInvoices) * 100)}%`
                      : "—"}
                  </p>
                  <p className="text-[9px] font-bold text-muted">
                    {summary?.totalPaid} مدفوعة
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <p className="text-[9px] font-bold text-muted uppercase mb-1">
                    أعلى شهر محقق
                  </p>
                  <p className="text-sm font-black tabular-nums text-main">
                    {summary?.best?.label_ar}
                  </p>
                  <p className="text-[9px] font-bold text-primary">
                    {summary?.best
                      ? formatCurrency(summary.best.total_amount)
                      : "—"}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {months.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="relative w-full sm:w-72">
              <Search
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن شهر..."
                className="h-10 w-full rounded-xl border border-border pr-9 pl-3 text-xs font-bold text-main outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-card"
              />
            </div>
            <div className="flex items-center gap-2">
              {[
                { key: "all", label: "الكل" },
                { key: "open", label: "مفتوح" },
                { key: "closed", label: "مغلق" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "h-9 rounded-xl px-4 text-[10px] font-black transition-all",
                    statusFilter === f.key
                      ? "bg-primary text-white shadow-sm"
                      : "border border-border bg-card text-muted hover:text-main",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl bg-card border border-border/70 p-5"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-12 w-12 rounded-xl bg-soft animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-2/3 rounded bg-soft animate-pulse" />
                    <div className="h-2 w-1/3 rounded bg-soft animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="h-16 rounded-xl bg-soft animate-pulse" />
                  <div className="h-16 rounded-xl bg-soft animate-pulse" />
                </div>
                <div className="h-9 w-full rounded-lg bg-soft animate-pulse" />
              </div>
            ))}
          </div>
        ) : months.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-24 text-center"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-soft">
              <Archive size={40} className="text-muted" />
            </div>
            <h3 className="mb-2 text-xl font-black text-main">
              لا توجد أشهر مؤرشفة بعد
            </h3>
            <p className="mb-6 text-sm font-bold text-muted">
              ستنتقل الفواتير تلقائيًا إلى الأرشيف بعد انتهاء الشهر.
            </p>
            <Button
              onClick={() => navigate("/invoices")}
              className="h-11 rounded-xl px-6"
            >
              عرض فواتير الشهر الحالي
            </Button>
          </motion.div>
        ) : filteredMonths.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
            <Search size={32} className="mb-3 text-muted" />
            <h3 className="mb-1 text-lg font-black text-main">
              لا نتائج مطابقة
            </h3>
            <p className="text-sm font-bold text-muted">
              جرّب تعديل البحث أو الفلتر.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredMonths.map((month, idx) => {
                const isClosed = month.is_closed;
                const hasChange =
                  month.change_percent !== undefined &&
                  month.change_percent !== 0;
                const changePositive = (month.change_percent || 0) >= 0;
                const isExpanded = expandedKey === month.key;
                const paidRatio = month.invoice_count
                  ? Math.round((month.paid_count / month.invoice_count) * 100)
                  : 0;
                const monthData = monthInvoices[month.key];

                return (
                  <motion.div
                    key={month.key}
                    layout="position"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.25) }}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow duration-300",
                      isClosed
                        ? "border-border"
                        : "border-primary/25 hover:shadow-premium",
                    )}
                  >
                    {!isClosed && (
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-primary via-primary/70 to-transparent" />
                    )}

                    {/* رأس البطاقة — قابل للضغط لعرض فواتير الشهر */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(month)}
                      aria-expanded={isExpanded}
                      className={cn(
                        "relative z-10 flex w-full flex-wrap items-center gap-4 p-5 text-right cursor-pointer hover:bg-soft/60 transition-colors",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300",
                          isClosed
                            ? "bg-soft text-muted"
                            : "bg-gradient-to-b from-primary/15 to-primary/5 text-primary group-hover:scale-105",
                        )}
                      >
                        <CalendarDays size={26} />
                      </div>

                      <div className="min-w-32">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-main">
                            {month.label_ar}
                          </h3>
                          <span
                            className={cn(
                              "flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-black",
                              isClosed
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30"
                                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30",
                            )}
                          >
                            {isClosed ? (
                              <Lock size={9} />
                            ) : (
                              <PieChart size={9} />
                            )}
                            {isClosed ? "مغلق" : "مفتوح"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] font-bold tabular-nums text-muted">
                          {month.key} · اضغط لعرض الفواتير
                        </p>
                      </div>

                      <div className="mr-auto flex items-center gap-6">
                        <div className="hidden min-w-24 text-left sm:block">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted">
                            المبيعات
                          </p>
                          <p className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(month.total_amount)}
                          </p>
                        </div>
                        <div className="hidden min-w-16 text-left md:block">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted">
                            الفواتير
                          </p>
                          <p className="text-lg font-black tabular-nums text-main">
                            {month.invoice_count}
                          </p>
                        </div>
                        {hasChange && (
                          <div
                            className={cn(
                              "hidden items-center gap-1 rounded-xl px-2.5 py-1.5 lg:flex",
                              changePositive
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
                                : "bg-red-50 text-red-500 dark:bg-red-900/20",
                            )}
                          >
                            {changePositive ? (
                              <TrendingUp size={13} />
                            ) : (
                              <TrendingDown size={13} />
                            )}
                            <span className="text-[10px] font-black tabular-nums">
                              {Math.abs(month.change_percent)}%
                            </span>
                          </div>
                        )}
                        <ChevronDown
                          size={20}
                          className={cn(
                            "shrink-0 text-muted transition-transform duration-300",
                            isExpanded && "rotate-180 text-primary",
                          )}
                        />
                      </div>

                      {/* شريط نسبة التحصيل */}
                      <div className="w-full">
                        <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              paidRatio >= 80
                                ? "bg-emerald-500"
                                : paidRatio >= 50
                                  ? "bg-amber-400"
                                  : "bg-red-400",
                            )}
                            style={{ width: `${paidRatio}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[9px] font-bold text-muted">
                          <span className="flex items-center gap-1">
                            <CheckIcon /> {month.paid_count} مدفوعة ·{" "}
                            {paidRatio}% من الشهر
                          </span>
                          <span className="sm:hidden">
                            {formatCurrency(month.total_amount)} ·{" "}
                            {month.invoice_count} فاتورة
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* قائمة فواتير الشهر */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="details"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="relative z-10 overflow-hidden border-t border-border/60 bg-soft/30"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
                            <h4 className="flex items-center gap-2 text-[11px] font-black text-main">
                              {isClosed ? (
                                <Lock size={13} className="text-amber-500" />
                              ) : (
                                <Eye size={13} className="text-primary" />
                              )}
                              {isClosed
                                ? `مراجعة فواتير ${month.label_ar} (مغلق)`
                                : `فواتير ${month.label_ar}`}
                              {monthData && (
                                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">
                                  {monthData.items.length} من {monthData.total}
                                </span>
                              )}
                            </h4>
                            {isClosed && (
                              <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[9px] font-black text-amber-600 dark:bg-amber-900/20">
                                <Lock size={10} />
                                عرض فقط — استخدم «فتح الشهر» للتعديل
                              </span>
                            )}
                          </div>

                          {invoicesLoading && !monthData ? (
                            <div className="space-y-2 p-4">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                  key={i}
                                  className="h-11 rounded-xl bg-card border border-border/50 animate-pulse"
                                />
                              ))}
                            </div>
                          ) : !monthData || monthData.items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <FileText
                                size={28}
                                className="mb-3 text-muted"
                              />
                              <p className="text-sm font-black text-main">
                                لا توجد فواتير في هذا الشهر
                              </p>
                              <p className="mt-1 text-[10px] font-bold text-muted">
                                لم يتم تسجيل أي فاتورة خلال{" "}
                                {month.label_ar}.
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="max-h-96 overflow-y-auto p-3">
                                <div className="hidden grid-cols-12 gap-3 rounded-xl px-4 pb-2 pt-1 text-[9px] font-black uppercase tracking-wider text-muted md:grid">
                                  <span className="col-span-2">رقم الفاتورة</span>
                                  <span className="col-span-3">العميل</span>
                                  <span className="col-span-2">الحلاق</span>
                                  <span className="col-span-2">التاريخ</span>
                                  <span className="col-span-1">الدفع</span>
                                  <span className="col-span-2 text-left">الإجمالي</span>
                                </div>
                                <div className="space-y-1.5">
                                  {monthData.items.map((inv) => (
                                    <MonthInvoiceRow key={inv.id} invoice={inv} PAYMENT_LABELS={PAYMENT_LABELS} fmtTime={fmtTime} />
                                  ))}
                                </div>
                                {monthData.total >
                                  monthData.items.length && (
                                  <button
                                    onClick={() => loadMoreInvoices(month)}
                                    disabled={loadingMoreKey === month.key}
                                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-[10px] font-black text-primary transition-colors hover:bg-primary/5 disabled:opacity-60"
                                  >
                                    {loadingMoreKey === month.key ? (
                                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    ) : (
                                      <ChevronDown size={12} />
                                    )}
                                    تحميل المزيد — يتبقى{" "}
                                    {monthData.total - monthData.items.length}{" "}
                                    فاتورة
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-card px-5 py-3">
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-bold text-muted">
                                  <span>
                                    إجمالي الفواتير:{" "}
                                    <b className="text-main tabular-nums">
                                      {monthData.total}
                                    </b>
                                  </span>
                                  <span>
                                    مدفوعة:{" "}
                                    <b className="text-emerald-600 tabular-nums">
                                      {month.paid_count}
                                    </b>
                                  </span>
                                  <span>
                                    معدل اليوم الواحد:{" "}
                                    <b className="text-main tabular-nums">
                                      {(
                                        monthData.total /
                                        Math.max(1, daysInMonth(month.key))
                                      ).toFixed(0)}
                                    </b>{" "}
                                    فاتورة
                                  </span>
                                </div>
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                  إجمالي: {formatCurrency(month.total_amount)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-card px-5 py-3">
                                <p className="text-[9px] font-bold leading-relaxed text-muted">
                                  {isClosed
                                    ? "هذا الشهر مغلق — فواتيره للعرض فقط حتى تفتحه للمراجعة."
                                    : "إغلاق الشهر يقفل كل فواتيره ويمنع التعديل أو الإلغاء نهائيًا."}
                                </p>
                                {isClosed ? (
                                  <Button
                                    size="sm"
                                    className="h-9 rounded-xl bg-blue-600 px-4 text-[10px] font-black hover:bg-blue-700"
                                    disabled={reopeningMonth === month.key}
                                    onClick={() => setConfirmReopen(month)}
                                  >
                                    {reopeningMonth === month.key ? (
                                      <Loader className="ml-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Unlock size={12} className="ml-1.5" />
                                    )}
                                    فتح الشهر للمراجعة
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="h-9 rounded-xl bg-amber-500 px-4 text-[10px] font-black hover:bg-amber-600"
                                    disabled={closingMonth === month.key}
                                    onClick={() => setConfirmClose(month)}
                                  >
                                    <Lock size={12} className="ml-1.5" />
                                    إغلاق الشهر نهائيًا
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Dialog
        open={!!confirmClose}
        onOpenChange={(open) => !open && setConfirmClose(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30">
              <Lock size={26} />
            </div>
            <DialogTitle className="text-center text-lg font-black">
              إغلاق شهر {confirmClose?.label_ar || ""}
            </DialogTitle>
            <DialogDescription className="text-center text-[11px] font-bold leading-relaxed text-muted">
              بعد إغلاق هذا الشهر لن يمكن تعديل أو إلغاء فواتيره بعد الآن.
              {confirmClose?.invoice_count
                ? ` يحتوي على ${confirmClose.invoice_count} فاتورة.`
                : ""}
              هل أنت متأكد؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              onClick={() => setConfirmClose(null)}
            >
              إلغاء
            </Button>
            <Button
              className="h-10 flex-1 rounded-xl bg-amber-600 hover:bg-amber-700"
              onClick={() => confirmClose && handleCloseMonth(confirmClose.key)}
              disabled={closingMonth === confirmClose?.key}
            >
              {closingMonth === confirmClose?.key ? (
                <Loader className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock size={14} className="ml-2" />
              )}
              تأكيد الإغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmReopen}
        onOpenChange={(open) => !open && setConfirmReopen(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
              <Unlock size={26} />
            </div>
            <DialogTitle className="text-center text-lg font-black">
              فتح شهر {confirmReopen?.label_ar || ""} للمراجعة
            </DialogTitle>
            <DialogDescription className="text-center text-[11px] font-bold leading-relaxed text-muted">
              ستتمكن من تعديل وإلغاء فواتير هذا الشهر مرة أخرى أثناء المراجعة.
              {confirmReopen?.invoice_count
                ? ` يحتوي على ${confirmReopen.invoice_count} فاتورة.`
                : ""}
              يمكنك إغلاقه مجددًا بعد الانتهاء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              onClick={() => setConfirmReopen(null)}
            >
              إلغاء
            </Button>
            <Button
              className="h-10 flex-1 rounded-xl bg-blue-600 hover:bg-blue-700"
              onClick={() =>
                confirmReopen && handleReopenMonth(confirmReopen.key)
              }
              disabled={reopeningMonth === confirmReopen?.key}
            >
              {reopeningMonth === confirmReopen?.key ? (
                <Loader className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock size={14} className="ml-2" />
              )}
              تأكيد الفتح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthInvoiceRow({ invoice, PAYMENT_LABELS, fmtTime }: any) {
  const method =
    PAYMENT_LABELS[String(invoice.payment_method || "").toLowerCase()] ||
    invoice.payment_method ||
    "غير محدد";
  const created = invoice.created_at ? new Date(invoice.created_at) : null;

  return (
    <div className="grid grid-cols-2 items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.03] md:grid-cols-12">
      <span className="col-span-1 truncate text-[11px] font-black tabular-nums text-main md:col-span-2">
        <FileText size={10} className="ml-1 inline text-primary" />
        {invoice.invoice_no}
      </span>
      <span className="col-span-1 flex items-center gap-1.5 truncate text-[11px] font-bold text-main md:col-span-3">
        <User size={10} className="shrink-0 text-muted" />
        <span className="truncate">{invoice.customer_name}</span>
      </span>
      <span className="col-span-1 hidden items-center gap-1.5 truncate text-[10px] font-bold text-muted md:flex md:col-span-2">
        <Scissors size={10} className="shrink-0" />
        <span className="truncate">{invoice.barber_name}</span>
      </span>
      <span className="col-span-1 truncate text-[10px] font-bold tabular-nums text-muted md:col-span-2">
        {created
          ? created.toLocaleDateString("ar-EG", {
              day: "numeric",
              month: "short",
            })
          : "-"}
        <span className="mr-1 text-[9px] opacity-70">{fmtTime(invoice.created_at)}</span>
      </span>
      <span className="col-span-1 hidden md:block md:col-span-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-soft px-1.5 py-0.5 text-[9px] font-black text-muted">
          <CreditCard size={8} />
          {method}
        </span>
      </span>
      <span className="col-span-1 text-left text-[11px] font-black tabular-nums text-emerald-600 dark:text-emerald-400 md:col-span-2">
        {formatCurrency(invoice.total_amount)}
      </span>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className="text-emerald-500"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function Loader({ className }: any) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v1.5M12 16.5V18M5.25 12H6.75M17.25 12h.75M8.4 8.4l.6.6m4.8 4.8.6.6M15.6 8.4l-.6.6M10.2 13.2l-.6.6"
      />
    </svg>
  );
}

export default function InvoiceArchivePageSafe() {
  return (
    <ErrorBoundary>
      <InvoiceArchivePage />
    </ErrorBoundary>
  );
}
