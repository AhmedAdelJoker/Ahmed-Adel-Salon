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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="relative flex-1 max-w-md group">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
            size={18}
          />
          <Input
            placeholder="البحث بالاسم أو معرف الدخول..."
            className="h-12 pl-4 pr-12 rounded-xl bg-white border-border focus:border-primary shadow-sm transition-all font-bold text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-border shadow-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "px-6 py-2 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2",
              viewMode === "grid"
                ? "bg-primary text-white shadow-md"
                : "text-muted hover:bg-soft",
            )}
          >
            <LayoutGrid size={14} /> شبكة
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "px-6 py-2 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2",
              viewMode === "table"
                ? "bg-primary text-white shadow-md"
                : "text-muted hover:bg-soft",
            )}
          >
            <List size={14} /> قائمة
          </button>
        </div>
      </div>
    </>
  );
}
