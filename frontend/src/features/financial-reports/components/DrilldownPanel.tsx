import { FileDown, FileText, MousePointer2, Printer, Receipt, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/core/utils";
import { expenseCategoryLabel } from "@/lib/money/expenseCategories";
import { dayKeyOf, paymentLabel, shortLabel } from "@/features/financial-reports/utils";
import type { ExpenseSlice, FinancialsState, RawRow, TrendPoint } from "@/types/reports";

export interface SelectedPayment {
  name: string;
  value: number;
}

export interface DrilldownPanelProps {
  selectedDay: TrendPoint | null;
  selectedExpenseCategory: ExpenseSlice | null;
  selectedPayment: SelectedPayment | null;
  dayInvoices: RawRow[];
  dayExpenses: RawRow[];
  financials: FinancialsState;
  categoryMovements: RawRow[];
  paymentInvoices: RawRow[];
  onClose: () => void;
  onExportDay: () => void;
  onExportCategory: () => void;
  onExportPayment: () => void;
  onPrint: () => void;
}

export function DrilldownPanel({
  selectedDay,
  selectedExpenseCategory,
  selectedPayment,
  dayInvoices,
  dayExpenses,
  financials,
  categoryMovements,
  paymentInvoices,
  onClose,
  onExportDay,
  onExportCategory,
  onExportPayment,
  onPrint,
}: DrilldownPanelProps) {
  if (!selectedDay && !selectedExpenseCategory && !selectedPayment) return null;
  return (
    <Card className="overflow-hidden border-primary/30 bg-primary/5 animate-in slide-in-from-bottom-4">
      <CardHeader className="flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <MousePointer2 size={18} />
          </div>
          <div>
            <CardTitle className="text-lg">
              {selectedDay
                ? selectedDay.isBucket && selectedDay.rangeEnd
                  ? `تفاصيل الفترة ${selectedDay.date} إلى ${selectedDay.rangeEnd} (تجميع أسبوعي)`
                  : `تفاصيل ${selectedDay.date} — ${shortLabel(selectedDay.date)}`
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
          onClick={onClose}
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
                onClick={onExportDay}
                variant="outline"
                size="sm"
                className="gap-2 text-[11px] font-black"
                disabled={dayInvoices.length === 0 && dayExpenses.length === 0}
              >
                <FileDown size={14} /> تصدير اليوم Excel
              </Button>
              <Button
                onClick={onPrint}
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
                      onClick={onExportCategory}
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
                  onClick={onExportPayment}
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
  );
}
