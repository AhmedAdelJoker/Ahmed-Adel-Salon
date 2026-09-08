import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import { Input } from "@/components/ui/input";

const DATE_FILTERS = [
  { id: "today", label: "اليوم" },
  { id: "tomorrow", label: "غداً" },
  { id: "this_week", label: "هذا الأسبوع" },
  { id: "all", label: "الكل" },
  { id: "custom", label: "مخصص" },
];

const TAB_OPTIONS = ["الكل", "أونلاين", "الأرشيف", "الملغاة"];

export default function BookingFilters({
  searchTerm,
  setSearchTerm,
  selectedEmployeeId,
  setSelectedEmployeeId,
  employees,
  activeTab,
  setActiveTab,
  dateFilter,
  setDateFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  return (
    <div className="border-b border-gray-100 bg-gray-50/50">
      <div className="px-6 py-4 space-y-4">
        {/* Row 1: Search + Employee + Tabs */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
          <div className="relative w-full lg:w-80">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <Input
              placeholder="بحث بالاسم أو رقم الهاتف..."
              className="h-10 pr-10 bg-white border-gray-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select
            value={selectedEmployeeId}
            onValueChange={setSelectedEmployeeId}
          >
            <SelectTrigger className="w-full lg:w-48 h-10 bg-white border-gray-200 text-sm font-bold rounded-xl">
              <SelectValue placeholder="كل الخبراء" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="font-bold">
                كل الخبراء
              </SelectItem>
              {employees.map((emp) => (
                <SelectItem
                  key={emp.id}
                  value={String(emp.id)}
                  className="font-bold"
                >
                  {emp.display_name || emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex bg-gray-100 p-1 rounded-xl gap-0.5">
            {TAB_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  activeTab === t
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Date filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-xl gap-0.5">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  dateFilter === f.id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="h-9 px-3 text-xs font-bold w-36 bg-white border-gray-200 rounded-xl"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-xs font-bold text-gray-400">إلى</span>
              <Input
                type="date"
                className="h-9 px-3 text-xs font-bold w-36 bg-white border-gray-200 rounded-xl"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
