import { Search, X, ShieldCheck, RefreshCw, ArrowDownWideNarrow, ScrollText } from "lucide-react";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/core/utils";
import { cn } from "@/lib/core/utils";
import { CATEGORIES, PAYMENT_METHODS, type ExpenseQuickRange, type ExpenseSort } from "@/features/expenses/constants";

interface ExpensesToolbarProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  paymentFilter: string;
  setPaymentFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  sort: ExpenseSort;
  setSort: (v: ExpenseSort) => void;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  hasActiveFilters: boolean;
  quickRange: ExpenseQuickRange;
  onQuickRange: (range: ExpenseQuickRange) => void;
  totalCount: number;
  totalAmount: number;
  expenseRowsCount: number;
  onRefresh: () => void;
}

export function ExpensesToolbar({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  paymentFilter,
  setPaymentFilter,
  statusFilter,
  setStatusFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  sort,
  setSort,
  setCurrentPage,
  hasActiveFilters,
  quickRange,
  onQuickRange,
  totalCount,
  totalAmount,
  expenseRowsCount,
  onRefresh,
}: ExpensesToolbarProps) {
  const { t } = useTranslation("owner");
  const clearFilters = () => {
    setCategoryFilter("all");
    setPaymentFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
    setCurrentPage(1);
    onQuickRange("all");
  };

  const quickRanges: Array<{ id: ExpenseQuickRange; label: string }> = [
    { id: "all", label: t("expenses.chipAllTime") },
    { id: "thisMonth", label: t("expenses.chipThisMonth") },
    { id: "lastMonth", label: t("expenses.chipLastMonth") },
    { id: "thisYear", label: t("expenses.chipThisYear") },
  ];

  return (
    <PremiumCard noPadding className="overflow-hidden">
      {/* Ledger header */}
      <div className="flex flex-col gap-3 border-b border-border/60 bg-soft/30 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-amber-300">
            <ScrollText size={16} />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-main">{t("expenses.ledgerTitle")}</h2>
            <p className="text-[10px] font-bold text-muted">
              <span className="font-black text-main">{expenseRowsCount}</span> / {totalCount} {t("expenses.recordsSuffix")} · {t("expenses.displayedTotal")} <span className="text-rose-600 font-black">{formatCurrency(totalAmount)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label={t("expenses.quickRangeLabel")}>
          {quickRanges.map((range) => {
            const active = quickRange === range.id;
            return (
              <button
                key={range.id}
                type="button"
                onClick={() => onQuickRange(range.id)}
                aria-pressed={active}
                className={cn(
                  "h-8 rounded-lg px-3 text-[10px] font-black transition-all",
                  active ? "bg-zinc-950 text-amber-200 shadow-sm" : "text-muted hover:bg-muted/40 hover:text-main",
                )}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("expenses.searchPlaceholder")}
              aria-label={t("expenses.searchPlaceholder")}
              className="h-11 w-full pe-10 rounded-xl bg-soft border-border font-bold focus:border-zinc-900 focus:ring-zinc-900/10 text-sm"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm("")} aria-label={t("expenses.clearSearch")} className="absolute start-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-card border border-border flex items-center justify-center">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 w-[140px] rounded-xl font-black bg-soft border-border" aria-label={t("expenses.fieldCategory")}><SelectValue placeholder={t("expenses.categoryShort")} /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">{t("expenses.allCategories")}</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 w-[140px] rounded-xl font-black bg-soft border-border" aria-label={t("expenses.fieldPaymentMethod")}><SelectValue placeholder={t("expenses.paymentShort")} /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">{t("expenses.allMethods")}</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 w-[150px] rounded-xl font-black bg-soft border-border" aria-label={t("expenses.statusLabel")}><SelectValue placeholder={t("expenses.statusShort")} /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">{t("expenses.allStatuses")}</SelectItem>
                <SelectItem value="approved">{t("expenses.statusApproved")}</SelectItem>
                <SelectItem value="pending_audit">{t("expenses.statusPending")}</SelectItem>
                <SelectItem value="rejected">{t("expenses.statusRejected")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => { setSort(v as ExpenseSort); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 w-[170px] rounded-xl font-black bg-soft border-border" aria-label={t("expenses.sortLabel")}>
                <ArrowDownWideNarrow size={13} className="me-1 shrink-0" /><SelectValue placeholder={t("expenses.sortLabel")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="-expense_date">{t("expenses.sortDateNewest")}</SelectItem>
                <SelectItem value="-amount">{t("expenses.sortAmountDesc")}</SelectItem>
                <SelectItem value="title">{t("expenses.sortTitleAz")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} aria-label={t("expenses.from")} className="h-11 w-[140px] rounded-xl font-bold bg-soft border-border text-xs" />
              <span className="text-muted font-black">—</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} aria-label={t("expenses.to")} className="h-11 w-[140px] rounded-xl font-bold bg-soft border-border text-xs" />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl border border-border bg-card" onClick={clearFilters} aria-label={t("expenses.clearFilters")}>
                <X size={16} />
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-border bg-card hidden sm:flex" onClick={onRefresh} aria-label={t("expenses.refresh")}>
              <RefreshCw size={15} />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-end text-[10px] font-bold text-muted">
          <span className="inline-flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-500" /> {t("expenses.cashboxProtected")}</span>
        </div>
      </div>
    </PremiumCard>
  );
}
