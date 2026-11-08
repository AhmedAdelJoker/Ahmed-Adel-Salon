import {
  LayoutGrid,
  List as ListIcon,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import type { HrStatusFilter, HrViewMode } from "@/features/hr/types";

export type HrFilterCounts = {
  all: number;
  active: number;
  suspended: number;
};

/**
 * The board's controls in one bar: who to look for, which state to keep, and
 * how densely to read it.
 *
 * Search goes to the server (`q`), which is why the state chips sit next to it
 * rather than above it: a filter that sees one page and a filter that sees the
 * roster must not look like the same control. The chips carry their counts so
 * the owner knows what waiting behind each one before clicking it, and the
 * range says what this page is showing instead of leaving the count to the
 * pagination footer.
 */
export default function HrToolbar({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  activeView,
  setActiveView,
  resultCount,
  totalCount,
  page,
  size,
  counts,
  onRefresh,
  refreshing = false,
  searchPending = false,
}: {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: HrStatusFilter;
  setStatusFilter: (v: HrStatusFilter) => void;
  activeView: HrViewMode;
  setActiveView: (v: HrViewMode) => void;
  resultCount: number;
  totalCount: number;
  page: number;
  size: number;
  counts?: HrFilterCounts;
  onRefresh?: () => void;
  refreshing?: boolean;
  searchPending?: boolean;
}) {
  const { t } = useTranslation("owner");

  const filters: Array<{
    value: HrStatusFilter;
    label: string;
    count?: number;
  }> = [
    { value: "all", label: t("hr.filterAll"), count: counts?.all },
    { value: "active", label: t("hr.statusActive"), count: counts?.active },
    {
      value: "suspended",
      label: t("hr.statusSuspended"),
      count: counts?.suspended,
    },
  ];

  const rangeStart =
    totalCount === 0 || resultCount === 0 ? 0 : (page - 1) * size + 1;
  const rangeEnd = Math.min((page - 1) * size + resultCount, totalCount);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-content-tertiary"
            size={16}
            aria-hidden="true"
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("hr.searchPlaceholder")}
            aria-label={t("hr.searchPlaceholder")}
            className="h-10 rounded-lg border-line bg-sunken ps-10 pe-10 text-sm font-semibold text-content placeholder:text-content-tertiary focus:border-accent focus:bg-raised"
          />
          {searchPending ? (
            <Loader2
              size={14}
              className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-accent"
              aria-hidden="true"
            />
          ) : (
            searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label={t("hr.clearSearch")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-content-tertiary transition-colors hover:bg-sunken hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X size={14} />
              </button>
            )
          )}
        </div>

        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label={t("hr.filterLabel")}
        >
          {filters.map((filter) => {
            const pressed = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={pressed}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  pressed
                    ? "border-accent bg-accent text-content-on-accent"
                    : "border-line bg-raised text-content-secondary hover:bg-sunken hover:text-content",
                )}
              >
                <span>{filter.label}</span>
                {typeof filter.count === "number" && (
                  <span
                    className={cn(
                      "rounded px-1 py-px font-mono text-[10px] tabular-nums",
                      pressed ? "bg-white/15" : "bg-sunken text-content-tertiary",
                    )}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span
          className="font-mono text-[11px] tabular-nums text-content-tertiary"
          aria-live="polite"
        >
          {searchPending
            ? t("hr.searchPending")
            : t("hr.showingRange", {
                from: rangeStart,
                to: rangeEnd,
                total: totalCount,
              })}
        </span>

        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={refreshing}
            title={t("hr.refresh")}
            aria-label={t("hr.refresh")}
            className="h-9 w-9 rounded-lg border-line bg-raised text-content-secondary hover:text-content"
          >
            <RefreshCw
              size={15}
              className={cn(refreshing && "animate-spin")}
              aria-hidden="true"
            />
          </Button>
        )}

        <div
          className="flex items-center gap-1 rounded-lg border border-line bg-sunken p-1"
          role="group"
          aria-label={t("hr.viewLabel")}
        >
          {[
            {
              mode: "cards" as HrViewMode,
              icon: LayoutGrid,
              label: t("hr.gridView"),
            },
            {
              mode: "table" as HrViewMode,
              icon: ListIcon,
              label: t("hr.listView"),
            },
          ].map((view) => (
            <button
              key={view.mode}
              type="button"
              onClick={() => setActiveView(view.mode)}
              aria-pressed={activeView === view.mode}
              title={view.label}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                activeView === view.mode
                  ? "bg-raised text-content shadow-sm"
                  : "text-content-tertiary hover:text-content-secondary",
              )}
            >
              <view.icon size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{view.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
