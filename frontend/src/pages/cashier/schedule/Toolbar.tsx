import { useEffect, useState } from "react";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  ListTree,
  ListOrdered,
  X,
  FileDown,
  RefreshCcw,
  PanelRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/core/utils";
import { statusMap } from "@/pages/cashier/schedule/scheduleUtils";

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDate(dateStr, offsetDays) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + offsetDays);
  return formatDateInput(d);
}

function QuickDateChip({ label, date, selectedDate, setSelectedDate }: any) {
  const active = date === selectedDate;
  return (
    <button
      onClick={() => setSelectedDate(date)}
      className={cn(
        "h-9 px-3.5 rounded-xl text-[10px] font-black transition-all border",
        active
          ? "bg-accent text-white border-accent shadow-md shadow-accent/25"
          : "bg-card text-muted border-border/70 hover:border-accent/40 hover:text-accent",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

const Toolbar = ({
  search,
  setSearch,
  barberFilter,
  setBarberFilter,
  statusFilter,
  setStatusFilter,
  barbers,
  selectedDate,
  setSelectedDate,
  viewMode,
  setViewMode,
  hasActiveFilters,
  onClearFilters,
  onExport,
  live,
  lastUpdated,
  onRefresh,
  range,
  setRange,
  sidebarOpen,
  onToggleSidebar,
}: any) => {
  const today = formatDateInput(new Date());

  const quickDates = [
    { label: "اليوم", date: today },
    { label: "غداً", date: shiftDate(today, 1) },
    { label: "بعد غدٍ", date: shiftDate(today, 2) },
  ];

  const viewButtons = [
    { key: "day", label: "الجدول", icon: LayoutGrid },
    { key: "week", label: "الأسبوع", icon: ListTree },
    { key: "list", label: "القائمة", icon: ListOrdered },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col 2xl:flex-row items-stretch 2xl:items-center justify-between gap-5"
    >
      <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
        <div className="relative group flex-1 min-w-[200px] max-w-md">
          <Search
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors z-10"
            size={17}
          />
          <input
            className="w-full h-11 pr-10 rounded-xl bg-soft border border-border focus:bg-card focus:border-accent focus:ring-0 transition-all font-bold placeholder:text-muted text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث سريع (اسم، خدمة، هاتف)..."
            aria-label="بحث عن موعد"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
              aria-label="مسح البحث"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <Select value={barberFilter} onValueChange={setBarberFilter}>
          <SelectTrigger className="h-11 px-4 rounded-xl bg-soft border-border text-xs font-black min-w-[140px]">
            <SelectValue placeholder="جميع الموظفين" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-bold">
              جميع الموظفين
            </SelectItem>
            {barbers.map((b) => (
              <SelectItem key={b.id} value={String(b.id)} className="font-bold">
                {b.display_name || b.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 px-4 rounded-xl bg-soft border-border text-xs font-black min-w-[140px]">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-bold">
              جميع الحالات
            </SelectItem>
            {Object.entries(statusMap).map(([key, val]) => (
              <SelectItem key={key} value={key} className="font-bold">
                <span className="flex items-center gap-2">
                  <span
                    className={cn("w-2 h-2 rounded-full shrink-0", val.dot)}
                  />
                  {val.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-11 px-4 rounded-xl bg-soft border-border text-xs font-black min-w-[130px]">
            <SelectValue placeholder="الفترة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-bold">
              كل ساعات العمل
            </SelectItem>
            <SelectItem value="morning" className="font-bold">
              صباحاً (حتى 2 ظهراً)
            </SelectItem>
            <SelectItem value="evening" className="font-bold">
              مساءً (من 2 ظهراً)
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-11 rounded-xl text-xs gap-1.5 text-muted"
          disabled={!hasActiveFilters}
          aria-label="مسح كافة الفلاتر"
        >
          <X size={14} /> مسح
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
        <div className="flex items-center gap-1.5 bg-soft p-1.5 rounded-xl border border-border/60">
          {quickDates.map((q) => (
            <QuickDateChip
              key={q.label}
              label={q.label}
              date={q.date}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 bg-soft p-2 rounded-xl border border-border shadow-sm">
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="h-9 w-9 flex items-center justify-center hover:bg-card rounded-lg transition-all group border border-transparent hover:border-border"
            aria-label="اليوم السابق"
            title="اليوم السابق (السهم الأيسر)"
          >
            <ChevronRight
              size={18}
              className="text-muted group-hover:text-accent"
            />
          </button>
          <input
            type="date"
            className="bg-transparent border-none text-sm font-black focus:ring-0 p-0 text-center w-32 cursor-pointer text-accent"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="اختيار التاريخ"
          />
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="h-9 w-9 flex items-center justify-center hover:bg-card rounded-lg transition-all group border border-transparent hover:border-border"
            aria-label="اليوم التالي"
            title="اليوم التالي (السهم الأيمن)"
          >
            <ChevronLeft
              size={18}
              className="text-muted group-hover:text-accent"
            />
          </button>
        </div>

        <div className="flex items-center bg-soft p-1 rounded-xl border border-border gap-1 shadow-sm">
          {viewButtons.map(({ key, label, icon: Icon }: any) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black transition-all",
                viewMode === key
                  ? "bg-accent text-white shadow-lg"
                  : "text-muted hover:text-accent hover:bg-white",
              )}
              aria-pressed={viewMode === key}
              aria-label={`عرض ${label}`}
              title={label === "الجدول" ? "عرض الجدول (D)" : undefined}
            >
              <Icon size={14} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        <div
          className={cn(
            "flex items-center gap-2 px-3 h-11 rounded-xl border text-[10px] font-black transition-all",
            live
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
              : "bg-rose-500/10 border-rose-500/30 text-rose-500",
          )}
          title={
            live
              ? "متصل بالخادم - تحديث تلقائي مباشر"
              : "غير متصل - البيانات غير محدثة"
          }
        >
          {live ? (
            <Wifi size={14} className="animate-pulse" />
          ) : (
            <WifiOff size={14} />
          )}
          {live ? "مباشر" : "غير متصل"}
          <span className="hidden sm:inline text-muted font-bold tabular-nums">
            {lastUpdated ? `· ${lastUpdated}` : ""}
          </span>
          <button
            onClick={onRefresh}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="تحديث البيانات"
            title="تحديث يدوي"
          >
            <RefreshCcw size={13} />
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleSidebar}
          className={cn(
            "h-11 w-11 rounded-xl p-0",
            sidebarOpen && "border-accent/50 text-accent",
          )}
          aria-label="إظهار/إخفاء الشريط الجانبي"
          aria-pressed={sidebarOpen}
          title="الشريط الجانبي (L)"
        >
          <PanelRight size={16} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-11 rounded-xl gap-2 px-4"
            >
              <FileDown size={15} />{" "}
              <span className="hidden sm:inline text-xs">تصدير</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>خيارات التصدير</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onExport("pdf")}>
              PDF للجدول اليومي
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("csv")}>
              CSV (بيانات المواعيد)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
};

export default Toolbar;
