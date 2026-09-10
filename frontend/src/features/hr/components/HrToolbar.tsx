import { LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/core/utils";
import type { HrViewMode } from "@/features/hr/types";

export default function HrToolbar({
  searchTerm,
  setSearchTerm,
  activeView,
  setActiveView,
}: {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  activeView: HrViewMode;
  setActiveView: (v: HrViewMode) => void;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative flex-1 max-w-md group">
        <Search
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors"
          size={18}
        />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث باسم الموظف أو المسمى الوظيفي..."
          className="h-14 rounded-2xl border-border bg-card/80 pr-12 text-sm font-bold shadow-sm focus:border-accent focus:bg-card"
        />
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-card/60 border border-border p-1.5 shadow-sm">
        <button
          onClick={() => setActiveView("cards")}
          className={cn(
            "flex h-11 items-center gap-2 rounded-xl px-5 text-[11px] font-black transition-all",
            activeView === "cards"
              ? "bg-accent text-white shadow-lg"
              : "text-muted hover:bg-card",
          )}
        >
          <LayoutGrid size={16} /> عرض الشبكة
        </button>
        <button
          onClick={() => setActiveView("table")}
          className={cn(
            "flex h-11 items-center gap-2 rounded-xl px-5 text-[11px] font-black transition-all",
            activeView === "table"
              ? "bg-accent text-white shadow-lg"
              : "text-muted hover:bg-card",
          )}
        >
          <ListIcon size={16} /> عرض القائمة
        </button>
      </div>
    </div>
  );
}
