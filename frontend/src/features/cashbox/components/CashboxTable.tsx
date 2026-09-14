import { Activity, ArrowDownCircle, ArrowUpCircle, Clock, CreditCard, Eye, Printer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { cn, formatCurrency } from "@/lib/core/utils";
import { formatDateTimeLocal, getTypeLabel, isVoided, PAYMENT_LABELS } from "@/features/cashbox/utils/cashboxHelpers";
import type { Transaction } from "@/types/cashbox";

interface Props {
  rows: Transaction[];
  onView: (row: Transaction) => void;
  onPrint: (id: number) => void;
}

export function CashboxTable({ rows, onView, onPrint }: Props) {
  if (rows.length === 0) {
    return (
      <PremiumCard noPadding className="overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-soft border border-border flex items-center justify-center">
            <Activity size={20} className="text-muted/40" />
          </div>
          <h3 className="mt-3 text-sm font-black text-main">لا توجد سجلات</h3>
          <p className="text-xs font-bold text-muted">جرب تغيير الفلاتر أو إنشاء حركة جديدة</p>
        </div>
      </PremiumCard>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:hidden">
        <AnimatePresence>
          {rows.map((row) => {
            const isIn = row.direction === "in";
            const voided = isVoided(row);
            return (
              <motion.div
                key={row.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn("rounded-2xl border bg-card p-4 shadow-sm", voided && "opacity-60")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", isIn ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                      {isIn ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-main truncate">{row.transaction_no || `#${row.id}`}</div>
                      <div className="text-xs font-bold text-muted truncate">{getTypeLabel(row.type)}</div>
                    </div>
                  </div>
                  <div className={cn("text-sm font-black tabular-nums shrink-0", voided ? "line-through text-muted" : isIn ? "text-emerald-600" : "text-rose-600")}>
                    {isIn ? "+" : "-"}
                    {formatCurrency(row.amount)}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-muted gap-2">
                  <span className="flex items-center gap-1 min-w-0">
                    <Clock size={12} className="shrink-0" />
                    <span className="truncate">{formatDateTimeLocal(row.transaction_date ?? row.created_at).split(" ")[0]}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <CreditCard size={12} />
                    {PAYMENT_LABELS[String(row.payment_method ?? "cash")] ?? String(row.payment_method ?? "cash")}
                  </span>
                  <button onClick={() => onView(row)} className="h-8 px-3 rounded-xl bg-slate-900 text-white font-black flex items-center gap-1 shrink-0">
                    <Eye size={12} /> عرض
                  </button>
                </div>
                {row.notes && <p className="mt-2 text-xs font-bold text-muted/80 bg-soft rounded-xl p-2 border border-border/40 line-clamp-2">{row.notes}</p>}
                {row.balance_after !== null && row.balance_after !== undefined && (
                  <div className="mt-2 text-[10px] font-black text-muted">
                    الرصيد بعد: <span className="text-main">{formatCurrency(row.balance_after)}</span>
                  </div>
                )}
                {voided && <Badge variant="danger" className="mt-2 h-5 text-[10px]">ملغاة</Badge>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <PremiumCard noPadding className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="bg-soft/50 border-b border-border">
                <th className="px-4 py-4 text-right text-[10px] font-black text-muted uppercase tracking-widest w-[26%]">العملية</th>
                <th className="px-4 py-4 text-right text-[10px] font-black text-muted uppercase w-[24%]">البيان</th>
                <th className="px-3 py-4 text-right text-[10px] font-black text-muted uppercase w-[10%]">الدفع</th>
                <th className="px-3 py-4 text-right text-[10px] font-black text-muted uppercase w-[14%]">الرصيد بعد</th>
                <th className="px-3 py-4 text-right text-[10px] font-black text-muted uppercase w-[14%]">الوقت</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-muted uppercase w-[12%]">القيمة</th>
                <th className="px-2 py-4 text-center text-[10px] font-black text-muted uppercase w-[7%]">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              <AnimatePresence mode="popLayout">
                {rows.map((row) => {
                  const isIn = row.direction === "in";
                  const voided = isVoided(row);
                  return (
                    <motion.tr key={row.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn("group hover:bg-soft/30 transition-colors", voided && "opacity-40")}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", isIn ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                            {isIn ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                          </div>
                          <span className="text-sm font-black text-main truncate min-w-0 flex-1" dir="ltr" title={row.transaction_no || `#${row.id}`}>
                            {row.transaction_no || `#${row.id}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-bold text-main truncate" title={getTypeLabel(row.type)}>
                          {getTypeLabel(row.type)}
                        </div>
                        <div className="text-[11px] font-bold text-muted truncate" title={row.notes || row.reference_no || "\u2014"}>
                          {row.notes ? `"${row.notes.slice(0, 32)}"` : row.reference_no ? `مرجع: ${row.reference_no}` : "بدون ملاحظات"}
                        </div>
                        {voided && <Badge variant="danger" className="mt-1 h-4 text-[8px] px-1.5">ملغاة</Badge>}
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant="outline" className="rounded-lg text-[10px] font-black whitespace-nowrap">
                          {PAYMENT_LABELS[String(row.payment_method ?? "cash")] ?? String(row.payment_method ?? "cash")}
                        </Badge>
                      </td>
                      <td className="px-3 py-4 text-xs font-black tabular-nums text-main">
                        <span className="block truncate" dir="ltr" title={row.balance_after !== null && row.balance_after !== undefined ? formatCurrency(row.balance_after) : "\u2014"}>
                          {row.balance_after !== null && row.balance_after !== undefined ? formatCurrency(row.balance_after) : "\u2014"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-[11px] font-bold text-muted">
                        <span className="block truncate" title={formatDateTimeLocal(row.transaction_date ?? row.created_at)}>
                          {formatDateTimeLocal(row.transaction_date ?? row.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-left">
                        <span className={cn("text-[14px] font-black tabular-nums whitespace-nowrap block", voided ? "line-through text-muted" : isIn ? "text-emerald-600" : "text-rose-600")} dir="ltr">
                          {isIn ? "+" : "\u2212"}
                          {formatCurrency(row.amount)}
                        </span>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onView(row)} className="h-8 w-8 rounded-xl hover:bg-slate-900 hover:text-white" title="عرض">
                            <Eye size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onPrint(row.id)} className="h-8 w-8 rounded-xl text-accent hover:bg-accent/10" title="طباعة">
                            <Printer size={14} />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </>
  );
}
