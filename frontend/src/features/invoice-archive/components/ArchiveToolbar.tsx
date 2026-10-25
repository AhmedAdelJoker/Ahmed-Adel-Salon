import { motion } from "framer-motion";
import { RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";

export interface ArchiveToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  resultCount: number;
  totalCount: number;
}

const STATUS_FILTERS = [
  { key: "all", label: "الكل" },
  { key: "open", label: "مفتوح" },
  { key: "partial", label: "جزئي" },
  { key: "locked", label: "مقفل" },
];

export function ArchiveToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  refreshing,
  resultCount,
  totalCount,
}: ArchiveToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="sticky top-2 z-20 rounded-2xl border border-border/70 bg-card/95 p-2.5 shadow-soft backdrop-blur"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="ابحث بالشهر أو السنة..."
            aria-label="البحث في الأشهر المؤرشفة"
            className="h-10 w-full rounded-xl border border-border bg-soft/40 pe-8 ps-9 text-xs font-bold text-main outline-none transition-colors placeholder:text-muted/60 focus:border-primary/60 focus:bg-card focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="مسح البحث"
              className="absolute end-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-soft hover:text-main"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <div className="flex shrink-0 items-center gap-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => onStatusFilterChange(filter.key)}
                aria-pressed={statusFilter === filter.key}
                className={cn(
                  "h-8 shrink-0 rounded-lg px-3 text-[10px] font-black transition-all",
                  statusFilter === filter.key
                    ? "bg-primary text-white shadow-sm"
                    : "border border-border/70 bg-card text-muted hover:border-primary/30 hover:text-main",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <span className="hidden text-[9px] font-bold text-muted sm:inline">
              {resultCount} من {totalCount} شهر
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="تحديث الأرشيف"
              title="تحديث"
              className="h-8 w-8 rounded-lg"
            >
              <RefreshCw
                size={14}
                className={cn(refreshing && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
