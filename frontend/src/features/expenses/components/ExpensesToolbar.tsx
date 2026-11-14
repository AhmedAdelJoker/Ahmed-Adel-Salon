import { Search, X, ShieldCheck, RefreshCw } from "lucide-react";
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
import { CATEGORIES, PAYMENT_METHODS } from "@/features/expenses/constants";

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
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  hasActiveFilters: boolean;
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
  setCurrentPage,
  hasActiveFilters,
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
  };

  return (
    <PremiumCard noPadding className="overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("expenses.searchPlaceholder")}
              aria-label={t("expenses.searchPlaceholder")}
              className="h-11 w-full pe-10 rounded-xl bg-soft border-border font-bold focus:border-slate-900 focus:ring-slate-900/10 text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label={t("expenses.clearSearch")}
                className="absolute start-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-card border border-border flex items-center justify-center"
              >
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
            <div className="flex items-center gap-1">
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} aria-label={t("expenses.from")} className="h-11 w-[145px] rounded-xl font-bold bg-soft border-border text-xs" />
              <span className="text-muted font-black">—</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} aria-label={t("expenses.to")} className="h-11 w-[145px] rounded-xl font-bold bg-soft border-border text-xs" />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl border border-border bg-card" onClick={clearFilters} aria-label={t("expenses.clearFilters")}>
                <X size={16} />
              </Button>
            )}
            <Button variant="outline" className="h-11 rounded-xl font-black hidden sm:flex" onClick={onRefresh}>
              <RefreshCw size={14} className="ms-1.5" /> {t("expenses.refresh")}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-bold text-muted border-t border-border/40 pt-3">
          <span>{t("expenses.showingOf", { count: expenseRowsCount, total: totalCount })} • {t("expenses.displayedTotal")} <span className="text-danger font-black">{formatCurrency(totalAmount)}</span></span>
          <span className="hidden sm:flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> {t("expenses.cashboxProtected")}</span>
        </div>
      </div>
    </PremiumCard>
  );
}
