import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/core/utils";

export interface ArchiveToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

const STATUS_FILTERS = [
  { key: "all", label: "الكل" },
  { key: "open", label: "مفتوح" },
  { key: "closed", label: "مغلق" },
];

export function ArchiveToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: ArchiveToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="relative w-full sm:w-72">
        <Search
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ابحث عن شهر..."
          className="h-10 w-full rounded-xl border border-border pr-9 pl-3 text-xs font-bold text-main outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-card"
        />
      </div>
      <div className="flex items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onStatusFilterChange(f.key)}
            className={cn(
              "h-9 rounded-xl px-4 text-[10px] font-black transition-all",
              statusFilter === f.key
                ? "bg-primary text-white shadow-sm"
                : "border border-border bg-card text-muted hover:text-main",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
