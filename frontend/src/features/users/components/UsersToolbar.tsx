import type { Dispatch, SetStateAction } from "react";
import { Search, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/core/utils";

export interface UsersToolbarProps {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  viewMode: string;
  setViewMode: Dispatch<SetStateAction<string>>;
}

export function UsersToolbar({ searchTerm, setSearchTerm, viewMode, setViewMode }: UsersToolbarProps) {
  return (
    <>
      {/* Elegant Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md group">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-primary"
            size={16}
          />
          <Input
            placeholder="البحث بالاسم أو البريد أو الرتبة..."
            className="h-11 pl-4 pr-11 rounded-xl bg-soft border-border focus:border-primary focus:bg-card shadow-sm transition-all font-bold text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="بحث المستخدمين"
          />
        </div>
        <div className="flex bg-card p-1 rounded-xl border border-border shadow-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "px-5 py-2 rounded-lg transition-all font-black text-[11px] uppercase tracking-widest flex items-center gap-1.5",
              viewMode === "grid"
                ? "bg-primary text-white shadow-md"
                : "text-muted hover:bg-soft hover:text-main",
            )}
          >
            <LayoutGrid size={14} /> شبكة
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "px-5 py-2 rounded-lg transition-all font-black text-[11px] uppercase tracking-widest flex items-center gap-1.5",
              viewMode === "table"
                ? "bg-primary text-white shadow-md"
                : "text-muted hover:bg-soft hover:text-main",
            )}
          >
            <List size={14} /> قائمة
          </button>
        </div>
      </div>
    </>
  );
}
