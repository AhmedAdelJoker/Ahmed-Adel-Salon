import type { Dispatch, SetStateAction } from "react";
import { Columns, Download, Search, X } from "lucide-react";
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

export interface InvoicesToolbarProps {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  fromDate: string;
  setFromDate: Dispatch<SetStateAction<string>>;
  toDate: string;
  setToDate: Dispatch<SetStateAction<string>>;
  paymentFilter: string;
  setPaymentFilter: Dispatch<SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  timePreset: string;
  setTimePreset: Dispatch<SetStateAction<string>>;
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
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  paymentFilter,
  setPaymentFilter,
  statusFilter,
  setStatusFilter,
  timePreset,
  setTimePreset,
  setCurrentPage,
  showColumnPicker,
  setShowColumnPicker,
  visibleColumns,
  toggleColumn,
  exportToCSV,
}: InvoicesToolbarProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "today", label: "اليوم" },
            { key: "week", label: "الأسبوع" },
            { key: "month", label: "الشهر" },
            { key: "last_month", label: "الشهر الماضي" },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => {
                const sp = new URLSearchParams(window.location.search);
                if (sp.has("month")) {
                  sp.delete("month");
                  const q = sp.toString();
                  window.history.replaceState(
                    null,
                    "",
                    `${window.location.pathname}${q ? `?${q}` : ""}`,
                  );
                }
                setTimePreset(preset.key);
                setCurrentPage(1);
              }}
              className={cn(
                "h-8 whitespace-nowrap rounded-lg px-3 text-[10px] font-black transition-all sm:h-9 sm:rounded-xl sm:px-4",
                timePreset === preset.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-soft text-muted hover:bg-card hover:text-main",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {(fromDate || toDate) && (
          <div className="ms-auto flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-soft px-2 py-1 text-[9px] font-bold text-primary">
            <span className="tabular-nums">{fromDate || "..."}</span>
            <span>←</span>
            <span className="tabular-nums">{toDate || "..."}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 p-3 sm:gap-3 sm:p-4 md:grid-cols-2 xl:grid-cols-12">
        <div className="relative xl:col-span-4">
          <Search
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
            size={14}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            className="h-10 w-full pr-9 text-sm sm:h-11"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:col-span-3">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-10 w-full min-w-0 text-xs font-bold sm:h-11"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-10 w-full min-w-0 text-xs font-bold sm:h-11"
          />
        </div>
        <div className="xl:col-span-2">
          <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 w-full rounded-xl font-bold sm:h-11">
              <SelectValue placeholder="طريقة الدفع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل طرق الدفع</SelectItem>
              <SelectItem value="cash">نقدي</SelectItem>
              <SelectItem value="card">شبكة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="xl:col-span-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 w-full rounded-xl font-bold sm:h-11">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="paid">مدفوعة</SelectItem>
              <SelectItem value="cancelled">ملغاة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-2 xl:col-span-1">
          <Popover
            open={showColumnPicker}
            onOpenChange={setShowColumnPicker}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
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
                  onClick={() => setShowColumnPicker(false)}
                >
                  <X size={10} />
                </Button>
              </div>
              <div className="space-y-0.5 py-1">
                {[
                  { key: "invoiceNo", label: "رقم الفاتورة" },
                  { key: "customer", label: "العميل والخبير" },
                  { key: "date", label: "التاريخ" },
                  { key: "payment", label: "وسيلة الدفع" },
                  { key: "status", label: "الحالة" },
                  { key: "amount", label: "القيمة" },
                  { key: "actions", label: "الإجراءات" },
                ].map((col) => (
                  <label
                    key={col.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-soft"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-bold text-main">
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
            onClick={exportToCSV}
            title="تصدير CSV"
          >
            <Download size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
