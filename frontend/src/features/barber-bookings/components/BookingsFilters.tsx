import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BookingsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
}

export const BookingsFilters = ({
  searchTerm,
  setSearchTerm,
  selectedDate,
  setSelectedDate,
  statusFilter,
  setStatusFilter,
}: BookingsFiltersProps) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالعميل أو الخدمة..."
            className="h-10 w-full pr-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 rounded-xl border border-border bg-soft px-3 text-xs font-bold"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-soft px-2 text-xs font-bold"
          >
            <option value="all">كل الحالات</option>
            <option value="waiting">في الانتظار</option>
            <option value="in-service">قيد الخدمة</option>
            <option value="completed">مكتمل</option>
            <option value="ready_for_payment">جاهز للدفع</option>
            <option value="cancelled">ملغي</option>
          </select>
          {(selectedDate || statusFilter !== "all" || searchTerm) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => {
                setSelectedDate("");
                setStatusFilter("all");
                setSearchTerm("");
              }}
            >
              <Filter size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
