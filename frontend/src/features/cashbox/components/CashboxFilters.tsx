import { Search, X, Filter, Calendar, CreditCard, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { PAYMENT_LABELS, TYPE_LABELS } from "@/features/cashbox/utils/cashboxHelpers";

interface Props {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  startDate: string;
  endDate: string;
  onStartDate: (v: string) => void;
  onEndDate: (v: string) => void;
  paymentMethod: string;
  onPaymentMethod: (v: string) => void;
  typeFilter: string;
  onTypeFilter: (v: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  onRefresh: () => void;
  totalCount: number;
  pageCount: number;
}

const PAY_OPTS = [
  { value: "all", label: "كل الطرق" },
  { value: "cash", label: PAYMENT_LABELS.cash },
  { value: "card", label: PAYMENT_LABELS.card },
  { value: "bank_transfer", label: PAYMENT_LABELS.bank_transfer },
  { value: "wallet", label: PAYMENT_LABELS.wallet },
];

const TYPE_OPTS = [
  { value: "all", label: "كل الأنواع" },
  ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

export function CashboxFilters({
  searchTerm,
  onSearchChange,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  paymentMethod,
  onPaymentMethod,
  typeFilter,
  onTypeFilter,
  hasActiveFilters,
  onClear,
  onRefresh,
  totalCount,
  pageCount,
}: Props) {
  return (
    <PremiumCard noPadding className="overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-main uppercase tracking-widest border-b border-border/40 pb-3">
          <Filter className="w-4 h-4 text-accent" /> فلترة ذكية
          {hasActiveFilters && (
            <Badge variant="outline" className="mr-auto rounded-full bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-black">
              مفلتر
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1">
            <Search size={12} /> بحث شامل
          </label>
          <div className="relative group">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
            <Input
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="رقم العملية، مرجع، ملاحظات..."
              className="h-11 pr-10 pl-10 rounded-xl bg-soft border-border font-bold"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-soft"
                aria-label="مسح البحث"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted uppercase flex items-center gap-1">
              <Calendar size={11} /> من
            </label>
            <Input type="date" value={startDate} onChange={(e) => onStartDate(e.target.value)} className="h-10 rounded-xl bg-soft border-border text-xs font-bold" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted uppercase">إلى</label>
            <Input type="date" value={endDate} onChange={(e) => onEndDate(e.target.value)} className="h-10 rounded-xl bg-soft border-border text-xs font-bold" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted uppercase flex items-center gap-1">
              <CreditCard size={11} /> الدفع
            </label>
            <Select value={paymentMethod} onValueChange={onPaymentMethod}>
              <SelectTrigger className="h-10 rounded-xl bg-soft border-border font-black text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {PAY_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="font-bold text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted uppercase flex items-center gap-1">
              <Tag size={11} /> النوع
            </label>
            <Select value={typeFilter} onValueChange={onTypeFilter}>
              <SelectTrigger className="h-10 rounded-xl bg-soft border-border font-black text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-64">
                {TYPE_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="font-bold text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="outline" onClick={onClear} className="flex-1 h-10 rounded-xl font-black gap-1.5 text-xs">
              <X size={14} /> مسح الفلاتر
            </Button>
          )}
          <Button variant="ghost" onClick={onRefresh} className="h-10 rounded-xl font-black border border-border bg-soft text-xs flex-1">
            تحديث
          </Button>
        </div>

        <div className="flex items-center justify-between text-[11px] font-bold text-muted border-t border-border/40 pt-3">
          <span>
            يعرض <span className="text-main font-black">{pageCount}</span> في الصفحة • الإجمالي <span className="text-main font-black">{totalCount}</span>
          </span>
        </div>
      </div>
    </PremiumCard>
  );
}
