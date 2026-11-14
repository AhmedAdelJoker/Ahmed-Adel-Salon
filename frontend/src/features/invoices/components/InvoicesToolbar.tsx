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
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { getIntlLocale } from "@/lib/format/locale";
import i18n from "@/i18n";
import {
  PAYMENT_METHOD_VALUES,
  STATUS_FILTER_VALUES,
  paymentMethodLabel,
  statusFilterLabel,
} from "@/features/invoices/utils/invoice";
import type { DateRange, TimePreset } from "@/features/invoices/hooks/useInvoicesData";

const PRESETS: { key: Exclude<TimePreset, "custom">; labelKey: string }[] = [
  { key: "today", labelKey: "presetToday" },
  { key: "week", labelKey: "presetWeek" },
  { key: "month", labelKey: "presetMonth" },
  { key: "last_month", labelKey: "presetLastMonth" },
];

const COLUMN_KEYS = [
  "invoiceNo",
  "customer",
  "date",
  "payment",
  "status",
  "amount",
  "actions",
] as const;

function shortDate(value: string): string {
  if (!value) return "…";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  return date.toLocaleDateString(locale, {
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
  exporting?: boolean;
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
  exporting = false,
}: InvoicesToolbarProps) {
  const { t } = useTranslation("invoices");
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

  const paymentChips = PAYMENT_METHOD_VALUES.map((value) => ({
    value,
    label: paymentMethodLabel(value),
  }));
  const statusChips = STATUS_FILTER_VALUES.map((value) => ({
    value,
    label: statusFilterLabel(value),
  }));

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-3 shadow-soft sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-soft/80 p-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onApplyPreset(preset.key)}
              aria-pressed={timePreset === preset.key}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-xl px-3 text-[11px] font-black transition-colors sm:px-4",
                timePreset === preset.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-card hover:text-main",
              )}
            >
              {t(`toolbar.${preset.labelKey}`)}
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
              {t("toolbar.customRange")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-muted">
                  {t("toolbar.from")}
                </span>
                <Input
                  type="date"
                  value={draftFrom}
                  onChange={(event) => setDraftFrom(event.target.value)}
                  className="h-10 text-xs font-bold"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-muted">
                  {t("toolbar.to")}
                </span>
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
                {t("toolbar.invalidRange")}
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
                {t("toolbar.applyRange")}
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
                {t("toolbar.cancel")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            aria-label={t("toolbar.previousPeriod")}
            title={t("toolbar.previousPeriod")}
            onClick={() => onShiftMonth(-1)}
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            aria-label={t("toolbar.nextPeriod")}
            title={t("toolbar.nextPeriod")}
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
            placeholder={t("toolbar.searchPlaceholder")}
            aria-label={t("toolbar.searchPlaceholder")}
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
              aria-label={t("toolbar.clearSearch")}
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
              <SelectValue placeholder={t("toolbar.allPayments")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toolbar.allPayments")}</SelectItem>
              {paymentChips.map((method) => (
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
              <SelectValue placeholder={t("statuses.all")} />
            </SelectTrigger>
            <SelectContent>
              {statusChips.map((option) => (
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
          {t("toolbar.filter")}
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
              className="h-10 w-10 shrink-0 rounded-xl"
              aria-label={t("toolbar.columnsToggle")}
              title={t("toolbar.columnsToggle")}
            >
              <Columns size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" side="bottom" align="end">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                {t("toolbar.columns")}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label={t("toolbar.hideColumns")}
                onClick={() => setShowColumnPicker(false)}
              >
                <X size={10} />
              </Button>
            </div>
            <div className="space-y-0.5 py-1">
              {COLUMN_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-soft"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(visibleColumns[key])}
                    onChange={() => toggleColumn(key)}
                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-bold text-main">
                    {t(`columns.${key}`)}
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
          disabled={exporting}
          aria-label={t("toolbar.exportCsv")}
          title={exporting ? t("toolbar.exporting") : t("toolbar.exportCsv")}
        >
          {exporting ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
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
              <SelectValue placeholder={t("toolbar.allPayments")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toolbar.allPayments")}</SelectItem>
              {paymentChips.map((method) => (
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
              <SelectValue placeholder={t("statuses.all")} />
            </SelectTrigger>
            <SelectContent>
              {statusChips.map((option) => (
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
            <FilterChip
              label={t("toolbar.searchChip", { term: query.trim() })}
              onClear={() => setQuery("")}
              clearLabel={t("toolbar.removeFilter", { label: t("toolbar.searchChip", { term: query.trim() }) })}
            />
          )}
          {paymentFilter !== "all" && (
            <FilterChip
              label={paymentMethodLabel(paymentFilter)}
              onClear={() => {
                setPaymentFilter("all");
                setCurrentPage(1);
              }}
              clearLabel={t("toolbar.removeFilter", { label: paymentMethodLabel(paymentFilter) })}
            />
          )}
          {statusFilter !== "all" && (
            <FilterChip
              label={statusFilterLabel(statusFilter)}
              onClear={() => {
                setStatusFilter("all");
                setCurrentPage(1);
              }}
              clearLabel={t("toolbar.removeFilter", { label: statusFilterLabel(statusFilter) })}
            />
          )}
          <button
            type="button"
            onClick={resetFilters}
            className="ms-1 text-[10px] font-black text-muted underline-offset-4 hover:text-danger hover:underline"
          >
            {t("toolbar.clearFilters")}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  onClear,
  clearLabel,
}: {
  label: string;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-1 text-[10px] font-bold text-primary">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel}
        className="rounded p-0.5 hover:bg-primary/10"
      >
        <X size={10} />
      </button>
    </span>
  );
}
