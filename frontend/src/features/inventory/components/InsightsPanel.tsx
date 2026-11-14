import type { ReactNode } from "react";
import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Flame,
  Archive,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, formatCurrency, formatNumber, formatDate } from "@/lib/core/utils";
import type { InventoryInsights } from "@/features/inventory/insights";
import { EmptyState } from "@/components/shared/EmptyState";

type InsightTab = "value" | "consumed" | "stagnant";

interface InsightsPanelProps {
  insights: InventoryInsights | null;
  loading: boolean;
}

const TABS: Array<{ key: InsightTab; icon: typeof TrendingUp; labelKey: string }> = [
  { key: "value", icon: TrendingUp, labelKey: "inventory.insightsTabValue" },
  { key: "consumed", icon: Flame, labelKey: "inventory.insightsTabConsumed" },
  { key: "stagnant", icon: Archive, labelKey: "inventory.insightsTabStagnant" },
];

/**
 * "Where the money goes" panel next to the shelf total.
 *
 * Three questions owners ask about an inventory that the KPI cards cannot
 * answer: what holds the most value, what burns the fastest, and what sits
 * untouched. Strictly a read-out of `/products/insights` -- no mutation
 * lives here on purpose, so the panel is safe next to stock-changing buttons.
 */
export function InsightsPanel({ insights, loading }: InsightsPanelProps) {
  const { t } = useTranslation("owner");
  const [tab, setTab] = useState<InsightTab>("value");

  return (
    <section
      aria-label={t("inventory.insightsTitle")}
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 size={16} strokeWidth={2.2} />
          </span>
          <h2 className="text-sm font-black text-main">{t("inventory.insightsTitle")}</h2>
        </div>
        {insights?.days ? (
          <span className="rounded-full border border-border bg-soft px-2 py-1 text-[9px] font-black uppercase tracking-wide text-muted">
            {t("inventory.insightsDays", { days: insights.days })}
          </span>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label={t("inventory.insightsTitle")}
        className="mx-3 mt-3 flex rounded-xl bg-soft p-1"
      >
        {TABS.map(({ key, icon: Icon, labelKey }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              title={t(labelKey)}
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all",
                active
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted hover:text-main",
              )}
            >
              <Icon size={12} strokeWidth={2.4} />
              <span className="hidden min-[560px]:inline">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex h-full min-h-[9rem] items-center justify-center gap-2 text-xs font-bold text-muted">
            <Loader2 size={15} className="animate-spin" />
            {t("inventory.loading")}
          </div>
        ) : !insights ? (
          <EmptyState
            variant="inline"
            icon={BarChart3}
            title={t("inventory.insightsUnavailable")}
            className="h-full"
          />
        ) : tab === "value" ? (
          <InsightList
            rows={insights.top_by_value}
            emptyTitle={t("inventory.insightsEmptyValue")}
            renderMeta={(row) => (
              <>
                <span className="text-[10px] font-bold tabular-nums text-muted">
                  {formatNumber(row.quantity)} {row.unit}
                </span>
                <span className="text-xs font-black tabular-nums text-success">
                  {formatCurrency(row.value)}
                </span>
              </>
            )}
          />
        ) : tab === "consumed" ? (
          <InsightList
            rows={insights.most_consumed}
            emptyTitle={t("inventory.insightsEmptyConsumed")}
            renderMeta={(row) => (
              <span className="text-xs font-black tabular-nums text-main">
                {formatNumber(row.consumed)} {row.unit ?? ""}
              </span>
            )}
          />
        ) : (
          <StagnantList rows={insights.stagnant} />
        )}
      </div>
    </section>
  );
}

function InsightList<Row extends { id: number; name: string }>({
  rows,
  emptyTitle,
  renderMeta,
}: {
  rows: Row[];
  emptyTitle: string;
  renderMeta: (row: Row) => ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-[9rem] items-center justify-center text-xs font-bold text-muted">
        {emptyTitle}
      </div>
    );
  }
  return (
    <ol className="flex h-full flex-col justify-between divide-y divide-border/50">
      {rows.map((row, index) => (
        <li
          key={row.id}
          className="flex items-center gap-2.5 py-2.5 first:pt-1 last:pb-1"
        >
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-soft text-[10px] font-black tabular-nums text-muted"
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-main" title={row.name}>
            {row.name}
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            {renderMeta(row)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StagnantList({
  rows,
}: {
  rows: InventoryInsights["stagnant"];
}) {
  const { t } = useTranslation("owner");
  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-[9rem] items-center justify-center text-xs font-bold text-muted">
        {t("inventory.insightsEmptyStagnant")}
      </div>
    );
  }
  return (
    <ol className="flex h-full flex-col justify-between divide-y divide-border/50">
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-center gap-2.5 py-2.5 first:pt-1 last:pb-1">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-soft text-[10px] font-black tabular-nums text-muted"
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-main" title={row.name}>
              {row.name}
            </span>
            <span className="block text-[9px] font-bold tabular-nums text-muted">
              {row.last_movement_at
                ? t("inventory.stagnantLastMove", {
                    date: formatDate(row.last_movement_at),
                  })
                : t("inventory.stagnantNever")}
            </span>
          </span>
          <span className="shrink-0 text-xs font-black tabular-nums text-main">
            {formatNumber(row.quantity)} {row.unit}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default InsightsPanel;
