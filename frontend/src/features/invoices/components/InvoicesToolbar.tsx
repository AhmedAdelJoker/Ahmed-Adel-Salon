import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  Download,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import {
  PAYMENT_METHOD_OPTIONS,
  statusOptions,
} from "@/features/invoices/utils/invoice";
import type { DateRange, TimePreset } from "@/features/invoices/hooks/useInvoicesData";

const PRESETS: { key: Exclude<TimePreset, "custom">; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "الأسبوع" },
  { key: "month", label: "الشهر" },
  { key: "last_month", label: "الشهر الماضي" },
];

const COLUMN_OPTIONS = [
  { key: "invoiceNo", label: "رقم الفاتورة" },
  { key: "customer", label: "العميل والخبير" },
  { key: "date", label: "التاريخ" },
  { key: "payment", label: "وسيلة الدفع" },
  { key: "status", label: "الحالة" },
  { key: "amount", label: "القيمة" },
  { key: "actions", label: "الإجراءات" },
];

function shortDate(value: string): string {
  if (!value) return "…";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-EG-u-nu-latn", {
    day: "2-digit",
    month: "short",
  });
}

export interface InvoicesToolbarProps {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  searchPending: boolean;
  fromDate: string;
  toDate: string;
  timePreset: TimePreset;
  onApplyPreset: (preset: Exclude<TimePreset, "custom">) => void;
  onApplyRange: (range: DateRange) => void;
  onShiftMonth: (delta: number) => void;
  paymentFilter: string;
  setPaymentFilter: Dispatch<SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  showColumnPicker: boolean;
  setShowColumnPicker: Dispatch<SetStateAction<boolean>>;
  visibleColumns: Record<string, boolean>;
  toggleColumn: (key: string) => void;
  exportToCSV: () => void;
}

export function InvoicesToolbar({
  query,
  setQuery,
  searchPending,
  fromDate,
  toDate,
  timePreset,
  onApplyPreset,
  onApplyRange,
  onShiftMonth,
  paymentFilter,
  setPaymentFilter,
  statusFilter,
  setStatusFilter,
  setCurrentPage,
  showColumnPicker,
  setShowColumnPicker,
  visibleColumns,
  toggleColumn,
  exportToCSV,
}: InvoicesToolbarProps) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(fromDate);
  const [draftTo, setDraftTo] = useState(toDate);

  useEffect(() => {
    if (rangeOpen) {
      setDraftFrom(fromDate);
      setDraftTo(toDate);
    }
  }, [rangeOpen, fromDate, toDate]);

  const invalidRange = Boolean(
    draftFrom && draftTo && draftFrom > draftTo,
  );
  const activeFilters =
    (paymentFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const resetFilters = () => {
    setQuery("");
    setPaymentFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
    setFiltersOpen(false);
  };

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-3 shadow-soft sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-soft/80 p-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onApplyPreset(preset.key)}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-xl px-3 text-[11px] font-black transition-colors sm:px-4",
                timePreset === preset.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-card hover:text-main",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-9 rounded-xl px-3 text-[11px] font-black"
            >
              <CalendarDays size={14} className="ms-1" />
              {shortDate(fromDate)} — {shortDate(toDate)}
              <ChevronDown size={13} className="ms-1 text-muted" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-4" align="start">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted">
              فترة مخصصة
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-muted">من</span>
                <Input
                  type="date"
                  value={draftFrom}
                  onChange={(event) => setDraftFrom(event.target.value)}
                  className="h-10 text-xs font-bold"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-muted">إلى</span>
                <Input
                  type="date"
                  value={draftTo}
                  onChange={(event) => setDraftTo(event.target.value)}
                  className="h-10 text-xs font-bold"
                />
              </label>
            </div>
            {invalidRange && (
              <p className="mt-2 text-[10px] font-bold text-danger">
                تاريخ البداية يجب أن يكون قبل تاريخ النهاية
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button
                className="h-9 flex-1 rounded-xl text-xs"
                disabled={!draftFrom || !draftTo || invalidRange}
                onClick={() => {
                  onApplyRange({ from: draftFrom, to: draftTo });
                  setRangeOpen(false);
                }}
              >
                تطبيق الفترة
              </Button>
              <Button
                variant="ghost"
                className="h-9 rounded-xl px-3 text-xs"
                onClick={() => {
                  setDraftFrom(fromDate);
                  setDraftTo(toDate);
                  setRangeOpen(false);
                }}
              >
                إلغاء
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            aria-label="الفترة السابقة"
            title="الفترة السابقة"
            onClick={() => onShiftMonth(-1)}
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            aria-label="الفترة التالية"
            title="الفترة التالية"
            onClick={() => onShiftMonth(1)}
          >
            <ChevronLeft size={16} />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted/60"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث برقم الفاتورة أو اسم العميل..."
            className="h-10 w-full border-border/70 bg-soft/50 ps-9 pe-9 text-sm focus-visible:bg-card sm:h-11"
          />
          {searchPending && (
            <Loader2
              size={14}
              className="absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-primary"
            />
          )}
          {!searchPending && query && (
            <button
              type="button"
              aria-label="مسح البحث"
              onClick={() => setQuery("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-soft hover:text-main"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Select
            value={paymentFilter}
            onValueChange={(value) => {
              setPaymentFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-[150px] rounded-xl font-bold xl:h-11">
              <SelectValue placeholder="طريقة الدفع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل طرق الدفع</SelectItem>
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-[125px] rounded-xl font-bold xl:h-11">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          className="h-10 rounded-xl px-3 sm:hidden"
          onClick={() => setFiltersOpen((prev) => !prev)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={15} className="ms-1" />
          فلاتر
          {activeFilters > 0 && (
            <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-white">
              {activeFilters}
            </span>
          )}
        </Button>

        <Popover open={showColumnPicker} onOpenChange={setShowColumnPicker}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-10 w-10 shrink-0 rounded-xl sm:inline-flex"
              aria-label="إظهار أو إخفاء الأعمدة"
              title="إظهار/إخفاء الأعمدة"
            >
              <Columns size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" side="bottom" align="end">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                الأعمدة
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label="إغلاق"
                onClick={() => setShowColumnPicker(false)}
              >
                <X size={10} />
              </Button>
            </div>
            <div className="space-y-0.5 py-1">
              {COLUMN_OPTIONS.map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-soft"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key]}
                    onChange={() => toggleColumn(column.key)}
                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-bold text-main">
                    {column.label}
                  </span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          onClick={exportToCSV}
          aria-label="تصدير CSV"
          title="تصدير CSV"
        >
          <Download size={16} />
        </Button>
      </div>

      {filtersOpen && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
          <Select
            value={paymentFilter}
            onValueChange={(value) => {
              setPaymentFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl font-bold">
              <SelectValue placeholder="طريقة الدفع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل طرق الدفع</SelectItem>
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl font-bold">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {activeFilters > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {query.trim() && (
            <FilterChip label={`بحث: ${query.trim()}`} onClear={() => setQuery("")} />
          )}
          {paymentFilter !== "all" && (
            <FilterChip
              label={
                PAYMENT_METHOD_OPTIONS.find(
                  (method) => method.value === paymentFilter,
                )?.label || paymentFilter
              }
              onClear={() => {
                setPaymentFilter("all");
                setCurrentPage(1);
              }}
            />
          )}
          {statusFilter !== "all" && (
            <FilterChip
              label={
                statusOptions.find((option) => option.value === statusFilter)
                  ?.label || statusFilter
              }
              onClear={() => {
                setStatusFilter("all");
                setCurrentPage(1);
              }}
            />
          )}
          <button
            type="button"
            onClick={resetFilters}
            className="ms-1 text-[10px] font-black text-muted underline-offset-4 hover:text-danger hover:underline"
          >
            مسح الكل
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-1 text-[10px] font-bold text-primary">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`إزالة فلتر ${label}`}
        className="rounded p-0.5 hover:bg-primary/10"
      >
        <X size={10} />
      </button>
    </span>
  );
}
