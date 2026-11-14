import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  Lock,
  PieChart,
  Scissors,
  Trash2,
  TrendingDown,
  TrendingUp,
  Unlock,
  User,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";
import {
  formatDateParts,
  invoiceBarber,
  invoiceCustomer,
  invoiceNo,
  invoicePaymentLabel,
  invoiceTotal,
} from "@/features/invoices";
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
  drafts: MonthInvoice[];
  draftsLoading: boolean;
  busyDraftId: string | number | null;
  invoicesLoading: boolean;
  loadingMoreKey: string | null;
  closingMonth: string | null;
  reopeningMonth: string | null;
  canManage: boolean;
  onToggleExpand: (month: ArchiveMonth) => void;
  onLoadMore: (month: ArchiveMonth) => void;
  onConfirmClose: (month: ArchiveMonth) => void;
  onConfirmReopen: (month: ArchiveMonth) => void;
  onSelectInvoice: (invoice: MonthInvoice) => void;
  onFinalizeDraft: (monthKey: string, draft: MonthInvoice) => void;
  onDeleteDraft: (monthKey: string, draft: MonthInvoice) => void;
  /** Opens the invoices ledger on this month. When omitted, the button is hidden. */
  onOpenLedger?: (monthKey: string) => void;
  daysInMonth: (key: string) => number;
}

export interface MonthInvoiceRowProps {
  invoice: MonthInvoice;
  onSelect: () => void;
}

export function MonthInvoiceRow({
  invoice,
  onSelect,
}: MonthInvoiceRowProps) {
  const date = formatDateParts(invoice.created_at);
  const barber = invoiceBarber(invoice);
  const payment = invoicePaymentLabel(invoice);

  return (
    <button
      type="button"
      onClick={onSelect}
      title="عرض تفاصيل الفاتورة"
      className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-right transition-all hover:border-primary/35 hover:bg-primary/[0.03] hover:shadow-sm md:grid-cols-12"
    >
      <span className="col-span-1 flex min-w-0 items-center gap-1.5 text-[11px] font-black tabular-nums text-main md:col-span-2">
        <FileText size={10} className="shrink-0 text-primary" />
        <span dir="ltr" className="truncate">
          {invoiceNo(invoice)}
        </span>
      </span>

      <span className="col-span-1 flex min-w-0 items-center justify-end gap-1.5 text-[11px] font-black tabular-nums text-emerald-600 dark:text-emerald-400 md:col-span-2 md:justify-start">
        <span className="truncate">{formatCurrency(invoiceTotal(invoice))}</span>
        <ChevronLeft
          size={11}
          className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
      </span>

      <span className="col-span-1 flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-main md:col-span-3">
        <User size={10} className="shrink-0 text-muted" />
        <span className="truncate">{invoiceCustomer(invoice)}</span>
      </span>

      <span className="col-span-1 flex min-w-0 items-center justify-end gap-1.5 text-[10px] font-bold text-muted md:col-span-2 md:justify-start">
        <Scissors size={10} className="shrink-0" />
        <span className="truncate">{barber}</span>
      </span>

      <span className="col-span-1 flex min-w-0 items-center gap-1.5 text-[10px] font-bold tabular-nums text-muted md:col-span-2">
        <CalendarDays size={10} className="shrink-0" />
        <span className="truncate">
          {date.date}
          {date.time && (
            <span className="text-[9px] opacity-75"> • {date.time}</span>
          )}
        </span>
      </span>

      <span className="col-span-1 flex items-center justify-end gap-1.5 md:col-span-1 md:justify-start">
        <span className="inline-flex items-center gap-1 rounded-md bg-soft px-1.5 py-0.5 text-[9px] font-black text-muted">
          <CreditCard size={8} />
          {payment}
        </span>
        {invoice.is_closed && (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-black text-red-600 dark:bg-red-900/20 dark:text-red-300">
            ملغاة
          </span>
        )}
      </span>
    </button>
  );
}

export function MonthArchiveRow({
  month,
  index,
  isExpanded,
  monthData,
  drafts,
  draftsLoading,
  busyDraftId,
  invoicesLoading,
  loadingMoreKey,
  closingMonth,
  reopeningMonth,
  canManage,
  onToggleExpand,
  onLoadMore,
  onConfirmClose,
  onConfirmReopen,
  onSelectInvoice,
  onFinalizeDraft,
  onDeleteDraft,
  onOpenLedger,
  daysInMonth,
}: MonthArchiveRowProps) {
  const perDay = monthData
    ? monthData.total / Math.max(1, daysInMonth(month.key))
    : 0;
  const perDayLabel =
    perDay === 0 ? "0" : perDay < 1 ? "<1" : perDay.toFixed(1);
  const hasDrafts = month.draft_count > 0;
  const voidedCount = month.voided_count || 0;

  return (
    <motion.div
      id={`archive-month-${month.key}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.3 }}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-3xl border bg-card shadow-soft transition-shadow",
        isExpanded
          ? "border-primary/40 shadow-premium"
          : "border-border/70 hover:shadow-premium",
      )}
    >
      <button
        type="button"
        onClick={() => onToggleExpand(month)}
        aria-expanded={isExpanded}
        aria-controls={`archive-month-panel-${month.key}`}
        className="group w-full p-4 text-right transition-colors hover:bg-soft/30 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 sm:h-12 sm:w-12",
              month.status === "locked"
                ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20"
                : month.status === "partial"
                  ? "bg-sky-50 text-sky-600 dark:bg-sky-900/20"
                  : "bg-primary-soft text-primary group-hover:scale-105",
            )}
          >
            <CalendarDays size={22} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-sm font-black text-main sm:text-base">
                {month.label_ar}
              </h3>
              <MonthStatusPill status={month.status} />
              {hasDrafts && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
                  <FileText size={9} />
                  {month.draft_count} مسودة
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[9px] font-bold tabular-nums text-muted">
                {month.key} · {month.invoice_count} فاتورة نهائية
                {voidedCount > 0 ? ` · ${voidedCount} ملغاة` : ""}
              </p>
              <p className="shrink-0 text-[10px] font-black tabular-nums text-emerald-600 dark:text-emerald-400 sm:hidden">
                {formatCurrency(month.total_amount)}
              </p>
            </div>
          </div>

          <div className="hidden shrink-0 text-left sm:block">
            <p className="text-[9px] font-bold text-muted">المبيعات</p>
            <p className="mt-0.5 text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-base">
              {formatCurrency(month.total_amount)}
            </p>
          </div>

          <ChevronDown
            size={18}
            className={cn(
              "mt-1 shrink-0 text-muted transition-transform duration-300",
              isExpanded && "rotate-180 text-primary",
            )}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MonthLockChip month={month} />
          <ChangePill value={month.change_percent} />
        </div>
      </button>

      {isExpanded && (
        <motion.div
          id={`archive-month-panel-${month.key}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden border-t border-border/60 bg-soft/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {month.is_locked ? (
                <Lock size={13} className="shrink-0 text-amber-500" />
              ) : (
                <Eye size={13} className="shrink-0 text-primary" />
              )}
              <div className="min-w-0">
                <h4 className="truncate text-[11px] font-black text-main">
                  فواتير {month.label_ar}
                </h4>
                <p className="text-[9px] font-bold text-muted">
                  {monthData
                    ? `${monthData.items.length} من ${monthData.total} فاتورة`
                    : "جارٍ تحميل الفواتير..."}
                </p>
              </div>
            </div>
            {month.is_locked && (
              <span className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
                <Lock size={9} />
                الشهر مقفل
              </span>
            )}
            {onOpenLedger && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 rounded-lg text-[10px] font-black text-primary"
                onClick={() => onOpenLedger(month.key)}
                title={`عرض فواتير ${month.label_ar ?? month.key} في السجل`}
              >
                <ChevronLeft size={12} className="ms-1 rtl:rotate-180" />
                فتح في السجل
              </Button>
            )}
          </div>

          {hasDrafts && (
            <div className="border-b border-border/50 bg-amber-50/50 px-4 py-3 dark:bg-amber-900/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-black text-main">
                  مسودات غير مكتملة ({month.draft_count})
                </p>
                <p className="text-[9px] font-bold text-amber-700 dark:text-amber-300">
                  أكملها أو احذفها قبل قفل الشهر
                </p>
              </div>

              {draftsLoading ? (
                <div className="mt-2 space-y-1.5">
                  {[1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-11 animate-pulse rounded-xl border border-border/50 bg-card"
                    />
                  ))}
                </div>
              ) : drafts.length === 0 ? (
                <p className="mt-2 text-[9px] font-bold text-muted">
                  لا توجد مسودات محفوظة في هذا الشهر.
                </p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {drafts.map((draft) => (
                    <DraftRow
                      key={String(draft.id)}
                      draft={draft}
                      busy={busyDraftId === draft.id}
                      canManage={canManage}
                      onFinalize={() => onFinalizeDraft(month.key, draft)}
                      onDelete={() => onDeleteDraft(month.key, draft)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {invoicesLoading && !monthData ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-11 animate-pulse rounded-xl border border-border/50 bg-card"
                />
              ))}
            </div>
          ) : !monthData || monthData.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText size={26} className="mb-2 text-muted" />
              <p className="text-xs font-black text-main">
                لا توجد فواتير في هذا الشهر
              </p>
              <p className="mt-1 text-[9px] font-bold text-muted">
                لم يتم تسجيل أي فاتورة نهائية خلال {month.label_ar}.
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto p-3">
                <div className="sticky top-0 z-10 hidden grid-cols-12 gap-3 rounded-lg bg-soft/95 px-3 py-1.5 text-[9px] font-black text-muted backdrop-blur md:grid">
                  <span className="col-span-2">رقم الفاتورة</span>
                  <span className="col-span-3">العميل</span>
                  <span className="col-span-2">الحلاق</span>
                  <span className="col-span-2">التاريخ</span>
                  <span className="col-span-1">الدفع</span>
                  <span className="col-span-2 text-left">الإجمالي</span>
                </div>
                <div className="mt-1 space-y-1.5">
                  {monthData.items.map((invoice) => (
                    <MonthInvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      onSelect={() => onSelectInvoice(invoice)}
                    />
                  ))}
                </div>
                {monthData.total > monthData.items.length && (
                  <button
                    type="button"
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
                    {monthData.total - monthData.items.length} فاتورة
                  </button>
                )}
              </div>

              <div className="border-t border-border/50 bg-card px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-bold text-muted">
                    <span>
                      فواتير:{" "}
                      <b className="tabular-nums text-main">
                        {monthData.total}
                      </b>
                    </span>
                    <span>
                      ملغاة:{" "}
                      <b className="tabular-nums text-red-500">{voidedCount}</b>
                    </span>
                    <span>
                      متوسط اليوم:{" "}
                      <b className="tabular-nums text-main">{perDayLabel}</b>
                    </span>
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {!month.is_locked && hasDrafts && (
                        <span className="text-[9px] font-bold text-amber-600">
                          أكمل أو احذف {month.draft_count} مسودة أولًا
                        </span>
                      )}
                      {month.is_locked ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-lg bg-blue-600 px-3 text-[10px] font-black hover:bg-blue-700"
                          disabled={reopeningMonth === month.key}
                          onClick={() => onConfirmReopen(month)}
                        >
                          {reopeningMonth === month.key ? (
                            <Loader2 className="ms-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Unlock size={11} className="ms-1.5" />
                          )}
                          إعادة فتح الشهر
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-lg bg-amber-600 px-3 text-[10px] font-black hover:bg-amber-700"
                          disabled={
                            closingMonth === month.key || hasDrafts
                          }
                          onClick={() => onConfirmClose(month)}
                          title={
                            hasDrafts
                              ? "أكمل أو احذف المسودات قبل قفل الشهر"
                              : "قفل الشهر"
                          }
                        >
                          {closingMonth === month.key ? (
                            <Loader2 className="ms-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Lock size={11} className="ms-1.5" />
                          )}
                          قفل الشهر
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[9px] font-bold text-muted">
                      قفل الشهر متاح للمدير أو المالك فقط
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function DraftRow({
  draft,
  busy,
  canManage,
  onFinalize,
  onDelete,
}: {
  draft: MonthInvoice;
  busy: boolean;
  canManage: boolean;
  onFinalize: () => void;
  onDelete: () => void;
}) {
  const date = formatDateParts(draft.created_at);
  const items = Array.isArray(draft.items) ? draft.items.length : 0;
  const withoutItems = items === 0;
  const withoutCustomer = Number(draft.customer_id ?? 0) === 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/70 bg-card px-3 py-2 dark:border-amber-900/40">
      <div className="min-w-0 flex-1">
        <p
          dir="ltr"
          className="truncate text-[10px] font-black tabular-nums text-main"
        >
          {invoiceNo(draft)}
        </p>
        <p className="truncate text-[9px] font-bold text-muted">
          {invoiceCustomer(draft)} · {date.date} ·{" "}
          {formatCurrency(invoiceTotal(draft))} · {items} بند
        </p>
      </div>

      {canManage ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-7 rounded-lg bg-emerald-600 px-2.5 text-[9px] font-black hover:bg-emerald-700"
            onClick={onFinalize}
            disabled={busy || withoutItems || withoutCustomer}
            title={
              withoutItems
                ? "المسودة بدون بنود — أضف بنودًا قبل إتمامها"
                : withoutCustomer
                  ? "حدّد عميلًا قبل إتمام المسودة"
                  : "تحويل المسودة إلى فاتورة نهائية"
            }
          >
            {busy ? (
              <Loader2 className="ms-1 h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 size={11} className="ms-1" />
            )}
            إتمام
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-lg border-red-200 px-2.5 text-[9px] font-black text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20"
            onClick={onDelete}
            disabled={busy}
            title="حذف المسودة"
          >
            <Trash2 size={11} className="ms-1" />
            حذف
          </Button>
        </div>
      ) : (
        <span className="shrink-0 text-[9px] font-bold text-muted">
          الإتاحة للمدير أو المالك
        </span>
      )}
    </div>
  );
}

function MonthLockChip({ month }: { month: ArchiveMonth }) {
  if (month.is_locked) {
    const locked = month.locked_at ? formatDateParts(month.locked_at) : null;
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
        <Lock size={10} />
        مقفل{locked ? ` منذ ${locked.date}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-soft px-2 py-1 text-[9px] font-black text-muted">
      <Unlock size={10} />
      قابل للتعديل
    </span>
  );
}

function MonthStatusPill({
  status,
}: {
  status: ArchiveMonth["status"];
}) {
  if (status === "locked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
        <Lock size={8} />
        مقفل
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[9px] font-black text-sky-600 dark:bg-sky-900/20 dark:text-sky-300">
        <PieChart size={8} />
        جزئي
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
      <Unlock size={8} />
      مفتوح
    </span>
  );
}

function ChangePill({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="hidden shrink-0 text-[9px] font-bold text-muted/60 sm:inline">
        لا مقارنة
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      title="مقارنة بالشهر التقويمي السابق"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black tabular-nums",
        positive
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
          : "bg-red-50 text-red-500 dark:bg-red-900/20",
      )}
    >
      {positive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      <span dir="ltr">
        {value > 0 ? "+" : ""}
        {value.toFixed(1)}%
      </span>
    </span>
  );
}
