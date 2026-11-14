import {
  CheckCircle2, Copy, CreditCard, Eye, FileText, Pencil, Trash2, XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurrencyText, DateText } from "@/components/shared/DisplayComponents";
import { PAYMENT_METHODS, CATEGORY_COLORS, CATEGORY_ICONS } from "@/features/expenses/constants";
import type { ExpenseRecord } from "@/types/expenses";
import { cn } from "@/lib/core/utils";

interface ExpenseLedgerProps {
  rows: ExpenseRecord[];
  isOwner: boolean;
  onView: (exp: ExpenseRecord) => void;
  onEdit: (exp: ExpenseRecord) => void;
  onDuplicate: (exp: ExpenseRecord) => void;
  onApprove: (id: number | string) => void;
  onReject: (id: number | string) => void;
  onDelete: (id: number | string) => void;
}

const STATUS_STYLE: Record<string, string> = {
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  pending_audit: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 animate-pulse",
  rejected: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  cancelled: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

/**
 * The ledger itself: a dense ERP-grade table on md+ screens and stacked
 * cards on phones. Every action is one tap away; approval and rejection sit
 * beside each other so the owner never leaves the row to make a decision.
 */
export function ExpenseLedger({
  rows,
  isOwner,
  onView,
  onEdit,
  onDuplicate,
  onApprove,
  onReject,
  onDelete,
}: ExpenseLedgerProps) {
  const { t } = useTranslation("owner");
  const statusLabel = (s?: string) =>
    s === "approved" ? t("expenses.statusApproved") : s === "pending_audit" ? t("expenses.statusPending") : s === "rejected" ? t("expenses.statusRejected") : (s ?? "—");

  const actionCluster = (exp: ExpenseRecord) => {
    const isPending = exp.status === "pending_audit";
    const expId = exp.id as number | string;
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted transition-colors hover:bg-slate-900 hover:text-white" onClick={() => onView(exp)} title={t("expenses.viewDetails")} aria-label={t("expenses.viewDetails")}>
          <Eye size={14} />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted transition-colors hover:bg-slate-900 hover:text-white" onClick={() => onEdit(exp)} title={isOwner ? t("expenses.edit") : t("expenses.viewDetails")} aria-label={isOwner ? t("expenses.edit") : t("expenses.viewDetails")}>
          {isOwner ? <Pencil size={13} /> : <Eye size={14} />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted transition-colors hover:bg-slate-900 hover:text-white" onClick={() => onDuplicate(exp)} title={t("expenses.duplicateBtn")} aria-label={t("expenses.duplicateBtn")}>
          <Copy size={13} />
        </Button>
        {isPending && isOwner && exp.id != null && (
          <>
            <Button size="sm" className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-black text-white hover:bg-emerald-700" onClick={() => onApprove(expId)}>
              <CheckCircle2 size={12} className="ms-1" /> {t("expenses.approve")}
            </Button>
            <Button size="sm" variant="outline" className="h-8 rounded-lg border-rose-200 bg-rose-50 px-2.5 text-[11px] font-black text-rose-700 hover:bg-rose-100" onClick={() => onReject(expId)}>
              <XCircle size={12} className="ms-1" /> {t("expenses.reject")}
            </Button>
          </>
        )}
        {isOwner && (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted hover:bg-rose-50 hover:text-rose-600" onClick={() => onDelete(expId)} title={t("expenses.deleteProtected")} aria-label={t("expenses.deleteProtected")}>
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      {/* md+ — dense ERP table */}
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/5 text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              <TableHead className="w-40">{t("expenses.fieldExpenseDate")}</TableHead>
              <TableHead>{t("expenses.colExpense")}</TableHead>
              <TableHead className="w-32">{t("expenses.paymentShort")}</TableHead>
              <TableHead className="w-28">{t("expenses.statusShort")}</TableHead>
              <TableHead className="w-36 text-end">{t("expenses.amountLabel")}</TableHead>
              <TableHead className="w-44 text-end">{t("expenses.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((exp) => {
              const CatIcon = CATEGORY_ICONS[exp.category ?? ""] || FileText;
              const catColor = CATEGORY_COLORS[exp.category ?? ""] || "var(--text-muted)";
              const s = String(exp.status ?? "");
              const isRejected = s === "rejected" || s === "cancelled";
              const isPending = s === "pending_audit";
              return (
                <TableRow key={String(exp.id)} className={cn("group border-b border-border/40 transition-colors hover:bg-muted/10", isPending && "bg-amber-50/40", isRejected && "opacity-60")}>
                  <TableCell className="text-[11px] font-bold tabular-nums text-muted"><DateText value={exp.expense_date} /></TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/50" style={{ backgroundColor: `color-mix(in srgb, ${catColor} 12%, transparent)`, color: catColor }}>
                        <CatIcon size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn("truncate text-[12px] font-black text-main", isRejected && "line-through decoration-rose-400")}>{exp.title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black text-white" style={{ backgroundColor: catColor }}>{exp.category}</span>
                          {exp.recipient_name ? <span className="truncate text-[10px] font-semibold text-muted">· {exp.recipient_name}</span> : null}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] font-bold text-muted">
                    <span className="inline-flex items-center gap-1.5"><CreditCard size={11} className="text-muted/60" />{PAYMENT_METHODS.find((m) => m.value === exp.payment_method)?.label || exp.payment_method}</span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black", STATUS_STYLE[s] || STATUS_STYLE.approved)}>
                      {statusLabel(s)}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <span className={cn("text-[13px] font-black tabular-nums tracking-tight", isRejected ? "text-muted line-through" : "text-rose-600")}>
                      <CurrencyText value={exp.amount} tone="muted" />
                    </span>
                  </TableCell>
                  <TableCell>{actionCluster(exp)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* <md — stacked cards */}
      <div className="space-y-2 p-3 md:hidden">
        <AnimatePresence>
          {rows.map((exp, i) => {
            const CatIcon = CATEGORY_ICONS[exp.category ?? ""] || FileText;
            const catColor = CATEGORY_COLORS[exp.category ?? ""] || "var(--text-muted)";
            const s = String(exp.status ?? "");
            const isRejected = s === "rejected" || s === "cancelled";
            const isPending = s === "pending_audit";
            return (
              <motion.div
                key={String(exp.id)}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, delay: i * 0.02 }}
                className={cn("rounded-2xl border border-border bg-card p-3 shadow-sm", isPending && "border-amber-300/60 bg-amber-50/30", isRejected && "opacity-70")}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${catColor} 12%, transparent)`, color: catColor }}>
                    <CatIcon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-[12px] font-black text-main", isRejected && "line-through")}>{exp.title}</p>
                      <span className={cn("shrink-0 text-[12px] font-black tabular-nums", isRejected ? "text-muted" : "text-rose-600")}><CurrencyText value={exp.amount} tone="muted" /></span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-muted">
                      <DateText value={exp.expense_date} />
                      <span className="h-0.5 w-0.5 rounded-full bg-border" />
                      <span>{PAYMENT_METHODS.find((m) => m.value === exp.payment_method)?.label}</span>
                      <span className="h-0.5 w-0.5 rounded-full bg-border" />
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-black", STATUS_STYLE[s] || "")}>{statusLabel(s)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end border-t border-border/40 pt-2">
                  {actionCluster(exp)}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
