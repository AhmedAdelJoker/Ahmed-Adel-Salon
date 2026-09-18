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
import { formatCurrency } from "@/lib/core/utils";
import { CATEGORIES, PAYMENT_METHODS } from "@/features/expenses/constants";

interface ExpensesToolbarProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  paymentFilter: string;
  setPaymentFilter: (v: string) => void;
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
  return (
    <PremiumCard noPadding className="overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="بحث بالعنوان، الوصف أو الفئة..." className="h-11 w-full pr-10 rounded-xl bg-soft border-border font-bold focus:border-slate-900 focus:ring-slate-900/10 text-sm" />
            {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-card border border-border flex items-center justify-center"><X size={12} /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 w-[140px] rounded-xl font-black bg-soft border-border"><SelectValue placeholder="الفئة" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل الفئات</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 w-[140px] rounded-xl font-black bg-soft border-border"><SelectValue placeholder="الدفع" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل الطرق</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="h-11 w-[145px] rounded-xl font-bold bg-soft border-border text-xs" />
              <span className="text-muted font-black">—</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="h-11 w-[145px] rounded-xl font-bold bg-soft border-border text-xs" />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl border border-border bg-card" onClick={() => { setCategoryFilter("all"); setPaymentFilter("all"); setDateFrom(""); setDateTo(""); setSearchTerm(""); }}>
                <X size={16} />
              </Button>
            )}
            <Button variant="outline" className="h-11 rounded-xl font-black hidden sm:flex" onClick={onRefresh}>
              <RefreshCw size={14} className="ml-1.5" /> تحديث
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-bold text-muted border-t border-border/40 pt-3">
          <span>يعرض <span className="text-main font-black">{expenseRowsCount}</span> من <span className="text-main font-black">{totalCount}</span> • الإجمالي المعروض: <span className="text-danger font-black">{formatCurrency(totalAmount)}</span></span>
          <span className="hidden sm:flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> الحذف محمي لضمان النزاهة</span>
        </div>
      </div>
    </PremiumCard>
  );
}
