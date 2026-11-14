import { useTranslation } from "react-i18next";
import { cn } from "@/lib/core/utils";
import type { CategoryAggregate } from "@/features/inventory/insights";

interface CategoryChipsProps {
  /** Aggregates from /products/insights (all non-archived rows). */
  options: CategoryAggregate[];
  /** The selected category; "" means "all". */
  active: string;
  onChange: (category: string) => void;
  /** Total active lines, for the "All" chip. */
  totalCount: number;
}

/**
 * Category quick filters for the shelf view.
 *
 * The chips double as a census of the catalogue: the count next to each one
 * is how many active lines carry that category. Anonymous rows ("—") are
 * skipped -- a filter you cannot name is not a filter.
 */
export function CategoryChips({
  options,
  active,
  onChange,
  totalCount,
}: CategoryChipsProps) {
  const { t } = useTranslation("owner");
  const named = options.filter(
    (option) => option.category && option.category !== "—",
  );

  if (named.length === 0 && totalCount === 0) return null;

  const chip = (
    label: string,
    count: number,
    value: string,
    isActive: boolean,
  ) => (
    <button
      key={value || "__all__"}
      type="button"
      aria-pressed={isActive}
      onClick={() => onChange(isActive && value ? "" : value)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isActive
          ? "border-primary bg-primary text-primary-foreground shadow-soft"
          : "border-border bg-card text-main hover:border-primary/40 hover:text-primary",
      )}
    >
      <span className="max-w-[10rem] truncate">{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[9px] font-black tabular-nums",
          isActive ? "bg-white/20 text-white" : "bg-soft text-muted",
        )}
      >
        {count}
      </span>
    </button>
  );

  return (
    <div
      role="group"
      aria-label={t("inventory.categoryFilters")}
      className="flex flex-wrap items-center gap-2"
    >
      {chip(t("inventory.categoryAll"), totalCount, "", active === "")}
      {named.slice(0, 6).map((option) =>
        chip(option.category, option.count, option.category, active === option.category),
      )}
    </div>
  );
}

export default CategoryChips;
