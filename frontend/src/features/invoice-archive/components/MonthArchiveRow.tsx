import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Lock,
  Eye,
  FileText,
  ChevronDown,
  PieChart,
  TrendingUp,
  TrendingDown,
  User,
  Scissors,
  CreditCard,
  Unlock,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";
import { CheckIcon, Loader } from "@/features/invoice-archive/components/ArchiveIcons";
import type {
  ArchiveMonth,
  MonthInvoice,
  MonthInvoicePage,
} from "@/features/invoice-archive/types";

export interface MonthArchiveRowProps {
  month: ArchiveMonth;
  index: number;
  isExpanded: boolean;
  monthData: MonthInvoicePage | undefined;
  invoicesLoading: boolean;
  loadingMoreKey: string | null;
  closingMonth: string | null;
  reopeningMonth: string | null;
  paymentLabels: Record<string, string>;
  onToggleExpand: (month: ArchiveMonth) => void;
  onLoadMore: (month: ArchiveMonth) => void;
  onConfirmClose: (month: ArchiveMonth) => void;
  onConfirmReopen: (month: ArchiveMonth) => void;
  daysInMonth: (key: string) => number;
  formatTime: (value: string) => string;
}

export interface MonthInvoiceRowProps {
  invoice: MonthInvoice;
  paymentLabels: Record<string, string>;
  formatTime: (value: string) => string;
}

export function MonthInvoiceRow({
  invoice,
  paymentLabels,
  formatTime,
}: MonthInvoiceRowProps) {
  const method =
    paymentLabels[String(invoice.payment_method || "").toLowerCase()] ||
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
        <span className="mr-1 text-[9px] opacity-70">{formatTime(invoice.created_at)}</span>
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

export function MonthArchiveRow({
  month,
  index,
  isExpanded,
  monthData,
  invoicesLoading,
  loadingMoreKey,
  closingMonth,
  reopeningMonth,
  paymentLabels,
  onToggleExpand,
  onLoadMore,
  onConfirmClose,
  onConfirmReopen,
  daysInMonth,
  formatTime,
}: MonthArchiveRowProps) {
  const isClosed = month.is_closed;
  const hasChange =
    month.change_percent !== undefined && month.change_percent !== 0;
  const changePositive = (month.change_percent || 0) >= 0;
  const paidRatio = month.invoice_count
    ? Math.round((month.paid_count / month.invoice_count) * 100)
    : 0;

  return (
    <motion.div
      key={month.key}
      layout="position"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
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
        onClick={() => onToggleExpand(month)}
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
                {Math.abs(month.change_percent ?? 0)}%
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
                      <MonthInvoiceRow key={inv.id} invoice={inv} paymentLabels={paymentLabels} formatTime={formatTime} />
                    ))}
                  </div>
                  {monthData.total >
                    monthData.items.length && (
                    <button
                      onClick={() => onLoadMore(month)}
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
                      onClick={() => onConfirmReopen(month)}
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
                      onClick={() => onConfirmClose(month)}
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
}
