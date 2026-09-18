/** Customers CustomerToolbar (moved from Customers page, no logic changes). */
import { Search } from "lucide-react";
import { Input } from "@/components/ui";
import { Card } from "@/components/ui";
import { cn } from "@/lib/core/utils";
import { CUSTOMER_FILTER_TABS } from "@/features/customers/constants";

export default function CustomerToolbar({
  activeFilter,
  onFilter,
  searchTerm,
  onSearch,
  viewMode,
  onViewMode,
  loading,
}: {
  activeFilter: string;
  onFilter: (tab: string) => void;
  searchTerm: string;
  onSearch: (v: string) => void;
  viewMode: string;
  onViewMode: (v: string) => void;
  loading: boolean;
}) {
  return (
      <Card className="border-border p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="chip-scroller">
            {CUSTOMER_FILTER_TABS.map((tab) => (
              <button
                type="button"
                key={tab}
                disabled={loading}
                onClick={() => onFilter(tab)}
                className={`whitespace-nowrap rounded-xl px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === tab ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-soft text-muted hover:text-main"}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              placeholder="البحث بالاسم أو رقم الجوال..."
              className="pr-11 h-12 rounded-xl bg-soft border-border/60 font-bold"
              value={searchTerm || ""}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-soft p-1 border border-border/40">
            <button
              type="button"
              onClick={() => onViewMode("cards")}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                viewMode === "cards"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-main",
              )}
              title="عرض بطاقات"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onViewMode("table")}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                viewMode === "table"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-main",
              )}
              title="عرض جدول"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
              </svg>
            </button>
          </div>
        </div>
      </Card>
  );
}
