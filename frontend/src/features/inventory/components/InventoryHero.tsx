import type { ReactNode } from "react";
import { Package, Boxes, Layers, AlertTriangle, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, formatCurrency } from "@/lib/core/utils";
import {
  computeCategoryShares,
  OTHER_CATEGORY,
  type CategoryAggregate,
} from "@/features/inventory/insights";

interface InventoryHeroProps {
  value: number;
  cost: number;
  /** Units and packs on the shelf; undefined while the insights call is loading. */
  totals?: { units: number; packs: number; lines: number; missing_pack_size: number } | null;
  /** True until the first /products/summary answer arrives -- renders shimmer, not zeros. */
  loading?: boolean;
  lowStock: number;
  showLowStockOnly: boolean;
  onToggleLowStock: () => void;
  /** Categories from /products/insights (all non-archived rows). */
  categories: CategoryAggregate[];
}

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimalFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/**
 * Segment palette: layered white tints.
 *
 * The bar sits on the brand gradient, so the slices are opacity steps of
 * white instead of raw hues -- no hex outside the token layer, and the
 * separation reads as depth rather than noise.
 */
const SLICE_COLORS = [
  "rgba(255, 255, 255, 0.92)",
  "rgba(255, 255, 255, 0.7)",
  "rgba(255, 255, 255, 0.52)",
  "rgba(255, 255, 255, 0.38)",
];
const OTHER_COLOR = "rgba(255, 255, 255, 0.22)";

/**
 * The inventory hero: how much money is on the shelf and where it sits.
 *
 * Unlike a plain KPI strip this answers the two questions the owner actually
 * asks in front of a warehouse count -- "how much is tied up, and in which
 * categories" -- and folds the low-stock filter toggle into the same surface
 * so the number is one click away from the list it names.
 */
export function InventoryHero({
  value,
  cost,
  totals,
  loading = false,
  lowStock,
  showLowStockOnly,
  onToggleLowStock,
  categories,
}: InventoryHeroProps) {
  const { t } = useTranslation("owner");
  const shares = computeCategoryShares(categories, 4);
  const units = totals?.units ?? 0;
  const packs = totals?.packs ?? 0;
  const lines = totals?.lines ?? 0;
  const missingPack = totals?.missing_pack_size ?? 0;

  const legendPercent = (share: number) => {
    const rounded = Math.round(share * 100);
    if (rounded === 0 && share > 0) return "<1%";
    return `${rounded}%`;
  };

  const legendLabel = (category: string) => {
    if (category === OTHER_CATEGORY) return t("inventory.otherCategory");
    if (category === "—") return t("inventory.categoryNone");
    return category;
  };

  return (
    <section
      aria-label={t("inventory.heroValueLabel")}
      className="relative h-full overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-l from-primary-strong via-primary to-primary-strong text-white shadow-premium"
    >
      {/* Ambient decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-28 h-80 w-80 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -start-20 bottom-[-4rem] h-64 w-64 rounded-full bg-black/20 blur-3xl"
      />
      <Package
        aria-hidden
        size={210}
        strokeWidth={1}
        className="pointer-events-none absolute -bottom-8 -end-8 rotate-12 text-white/10"
      />

      <div className="relative grid h-full gap-6 p-5 sm:p-6 lg:grid-cols-12 lg:gap-8 lg:p-7">
        {/* Left: headline number + composition */}
        <div className="flex flex-col justify-between gap-6 lg:col-span-7">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
              <Package size={13} strokeWidth={2.5} />
              {t("inventory.heroValueLabel")}
            </div>
            {loading ? (
              <div
                aria-hidden
                className="mt-3 h-12 w-56 animate-pulse rounded-2xl bg-white/15 sm:h-14 sm:w-80"
              />
            ) : (
              <p className="mt-3 whitespace-nowrap text-3xl font-black leading-none tracking-tight tabular-nums sm:text-4xl 2xl:text-5xl">
                {formatCurrency(value)}
              </p>
            )}
            {loading ? (
              <div
                aria-hidden
                className="mt-3 h-4 w-64 animate-pulse rounded-lg bg-white/10"
              />
            ) : (
              <p className="mt-2.5 text-xs font-bold text-white/75 sm:text-sm">
                {t("inventory.stockCost")}: <span className="tabular-nums">{formatCurrency(cost)}</span>
                <span className="mx-2 opacity-50">|</span>
                {t("inventory.heroLines", { count: lines })}
              </p>
            )}
            {missingPack > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-bold text-white/85">
                <AlertTriangle size={11} strokeWidth={2.5} aria-hidden />
                {t("inventory.heroMissingPack", { count: missingPack })}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
              {t("inventory.heroDistribution")}
            </p>
            {shares.length > 0 ? (
              <>
                <div
                  role="img"
                  aria-label={shares
                    .map(
                      (share) =>
                        `${legendLabel(share.category)}: ${legendPercent(share.share)}`,
                    )
                    .join(", ")}
                  className="flex h-2.5 w-full overflow-hidden rounded-full bg-black/30"
                >
                  {shares.map((share, index) => (
                    <div
                      key={share.category}
                      className="h-full first:rounded-s-full last:rounded-e-full"
                      style={{
                        width: `${Math.max(share.share * 100, 0.5)}%`,
                        backgroundColor:
                          share.category === OTHER_CATEGORY
                            ? OTHER_COLOR
                            : SLICE_COLORS[index % SLICE_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-bold text-white/80">
                  {shares.map((share, index) => (
                    <li key={share.category} className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            share.category === OTHER_CATEGORY
                              ? OTHER_COLOR
                              : SLICE_COLORS[index % SLICE_COLORS.length],
                        }}
                      />
                      <span className="max-w-[9rem] truncate" title={legendLabel(share.category)}>
                        {legendLabel(share.category)}
                      </span>
                      <span className="tabular-nums text-white/60">
                        {legendPercent(share.share)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[11px] font-bold text-white/60">
                {t("inventory.heroDistributionEmpty")}
              </p>
            )}
          </div>
        </div>

        {/* Right: shelf facts + the low-stock filter, same surface */}
        <div className="flex flex-col justify-between gap-2 lg:col-span-5">
          <HeroStat
            icon={<Layers size={17} strokeWidth={2.2} />}
            label={t("inventory.statUnits")}
            value={intFmt.format(units)}
            unit=""
            loading={loading || !totals}
          />
          <HeroStat
            icon={<Boxes size={17} strokeWidth={2.2} />}
            label={t("inventory.statPacks")}
            value={oneDecimalFmt.format(packs)}
            unit=""
            loading={loading || !totals}
          />
          <button
            type="button"
            onClick={onToggleLowStock}
            aria-pressed={showLowStockOnly}
            className={cn(
              "group flex flex-1 items-center gap-3 rounded-2xl border p-3.5 text-start transition-all",
              showLowStockOnly
                ? "border-danger/50 bg-danger/20 ring-2 ring-danger/40"
                : "border-white/15 bg-white/10 hover:bg-white/15",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
                lowStock > 0 ? "bg-danger/80" : "bg-white/15",
              )}
            >
              <AlertTriangle size={17} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-2xl font-black leading-none tabular-nums">
                {intFmt.format(lowStock)}
              </span>
              <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.16em] text-white/60">
                {t("inventory.lowStock")}
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wide text-white/80 transition-colors",
                showLowStockOnly ? "border-danger/60 bg-danger/30" : "border-white/20 bg-white/5",
              )}
            >
              <Filter size={9} />
              {showLowStockOnly ? t("inventory.showAllProducts") : t("inventory.showLowStockOnly")}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  icon,
  label,
  value,
  unit,
  loading = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        {loading ? (
          <div aria-hidden className="h-6 w-20 animate-pulse rounded-lg bg-white/15" />
        ) : (
          <span className="block text-2xl font-black leading-none tabular-nums">
            {value}
            {unit}
          </span>
        )}
        <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.16em] text-white/60">
          {label}
        </span>
      </span>
    </div>
  );
}

export default InventoryHero;
