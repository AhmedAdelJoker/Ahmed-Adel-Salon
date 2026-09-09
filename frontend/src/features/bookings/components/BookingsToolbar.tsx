import { Filter, RefreshCw, Search, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import { DATE_FILTERS, TAB_CATEGORIES } from "@/features/bookings";

export default function BookingsToolbar({
  searchTerm,
  setSearchTerm,
  selectedEmployeeId,
  setSelectedEmployeeId,
  employees,
  dateFilter,
  setDateFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  activeTab,
  setActiveTab,
  quickFilter,
  setQuickFilter,
  tabCounts,
  connected,
  lastUpdated,
  refreshing,
  refreshBookings,
  searchInputRef,
}: any) {
  return (
    <div className="p-4 sm:p-6 border-b border-border space-y-4">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted/60"
              size={16}
            />
            <Input
              ref={searchInputRef}
              placeholder="بحث باسم العميل أو الهاتف (/)..."
              className="h-10 sm:h-11 pr-10 text-xs font-bold rounded-xl bg-soft/50 border-border focus:bg-card"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-main"
                aria-label="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Barber Dropdown */}
          <Select
            value={selectedEmployeeId}
            onValueChange={setSelectedEmployeeId}
          >
            <SelectTrigger className="h-10 sm:h-11 bg-soft/50 border-border font-bold text-xs rounded-xl w-full sm:w-48">
              <SelectValue placeholder="كل الخبراء" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border shadow-premium">
              <SelectItem value="all" className="font-bold text-xs py-2.5">
                كل الخبراء
              </SelectItem>
              {employees.map((emp: any) => (
                <SelectItem
                  key={emp.id}
                  value={String(emp.id)}
                  className="font-bold text-xs py-2.5"
                >
                  {emp.display_name || emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right Controls: Date Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-end">
          <div className="flex items-center flex-wrap gap-1 bg-soft p-1 rounded-xl border border-border">
            {DATE_FILTERS.map((f: any) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap",
                  dateFilter === f.id
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted hover:text-main",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter === "custom" && (
            <div className="flex items-center gap-2 bg-soft/50 p-1.5 rounded-xl border border-border mt-2 sm:mt-0">
              <Input
                type="date"
                className="h-8 px-2 text-xs font-bold w-32 bg-card rounded-lg"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-xs font-bold text-muted">إلى</span>
              <Input
                type="date"
                className="h-8 px-2 text-xs font-bold w-32 bg-card rounded-lg"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Status Tabs with Live Counters (wrap so all tabs stay visible) */}
      <div className="flex flex-wrap bg-soft p-1 rounded-xl border border-border w-full">
        {TAB_CATEGORIES.map((t: any) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
              setQuickFilter("all");
            }}
            className={cn(
              "flex-1 min-w-[7rem] px-3 sm:px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap text-center flex items-center justify-center gap-1.5",
              activeTab === t.id
                ? "bg-card text-primary shadow-sm"
                : "text-muted hover:text-main",
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded-md leading-none tabular-nums",
                activeTab === t.id
                  ? "bg-primary/10 text-primary"
                  : "bg-soft/80 text-muted",
              )}
            >
              {tabCounts[t.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* SMART QUICK CHIPS FILTER ROW (wrap so all chips stay visible) */}
      <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-border/40">
        <span className="text-[10px] font-black text-muted uppercase flex items-center gap-1 shrink-0">
          <Filter size={12} /> فلترة سريعة:
        </span>

        {[
          { id: "all", label: "الكل" },
          { id: "walkin", label: "مشاة" },
          { id: "late", label: "المتأخرة" },
          { id: "pending", label: "قيد التأكيد" },
          { id: "online", label: "أونلاين" },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setQuickFilter(chip.id)}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black transition-all whitespace-nowrap border",
              quickFilter === chip.id
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-soft/60 text-muted border-border hover:border-primary/40 hover:text-main",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Live status strip: connection + last update + manual refresh */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
        <div className="flex items-center gap-2 text-[11px] font-bold text-muted min-w-0">
          <span
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
              connected
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
            )}
          >
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "الاتصال الحي يعمل" : "إعادة الاتصال..."}
          </span>
          <span className="truncate">
            آخر تحديث:{" "}
            {lastUpdated.toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={refreshBookings}
          disabled={refreshing}
          className="h-8 px-3 rounded-lg text-[11px] font-black text-muted hover:text-primary gap-1.5 shrink-0"
        >
          <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
          تحديث
        </Button>
      </div>
    </div>
  );
}
