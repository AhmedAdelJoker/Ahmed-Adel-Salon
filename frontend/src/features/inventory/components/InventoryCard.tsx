import { Eye, History, Plus, Package, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber } from "@/lib/core/utils";
import {
  getAvailablePacks,
  formatQuantity,
  getUnitMeta,
} from "@/features/inventory/design-tokens";
import { StockBar } from "@/features/inventory/components/StockBar";
import {
  computeReorderSuggestion,
  isLowStock,
} from "@/features/inventory/insights";
import type { InventoryProductAny } from "@/features/inventory/hooks/useInventoryForm";
import type { CategoryTone } from "@/features/inventory/hooks/useInventoryData";

export interface InventoryCardProps {
  product: InventoryProductAny;
  /** Category icon/colors from useInventoryData's getCategoryTone. */
  tone: CategoryTone;
  /** Whether the row is in the current bulk-selection set. */
  selected: boolean;
  onToggleSelected: (id: number) => void;
  isManagement: boolean;
  onView: (product: InventoryProductAny) => void;
  onSupply: (product: InventoryProductAny) => void;
  onEdit: (product: InventoryProductAny) => void;
  onHistory: (product: InventoryProductAny) => void;
}

/**
 * One shelf line, card form.
 *
 * The checkbox is what turns eight cards into a bulk operation: it is a real
 * control with an accessible name, not a hover-only affordance, so it works
 * the same on a touch counter screen.
 */
export function InventoryCard({
  product,
  tone,
  selected,
  onToggleSelected,
  isManagement,
  onView,
  onSupply,
  onEdit,
  onHistory,
}: InventoryCardProps) {
  const { t } = useTranslation("owner");
  const qty = Number(product.quantity || 0);
  const minQty = Number(product.min_quantity_alert || 0);
  const isLow = isLowStock(qty, minQty);
  const hasPack = Number(product.weight || 0) > 0;
  const packs = hasPack ? getAvailablePacks(product) : null;
  const unit = getUnitMeta(product.unit);
  const suggestion = computeReorderSuggestion(qty, minQty);
  const archived = !!product.is_archived;
  const productId = Number(product.id);

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-all duration-300",
        selected
          ? "border-primary ring-2 ring-primary/25 shadow-soft"
          : "border-border hover:border-primary/30 hover:shadow-soft",
      )}
    >
      <label
        className={cn(
          "absolute start-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border transition-all",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-transparent hover:border-primary/50",
        )}
        title={t("inventory.selectItem", { name: product.name })}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={selected}
          onChange={() => onToggleSelected(productId)}
          aria-label={t("inventory.selectItem", { name: product.name })}
        />
        <Check size={14} strokeWidth={3.5} aria-hidden />
      </label>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              tone.iconClass,
            )}
          >
            <tone.Icon size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-main sm:text-base">
              {product.name}
            </h3>
            <p className="truncate text-[10px] font-medium text-muted">
              {product.category || t("inventory.categoryFallback")}
              {product.sku ? ` · ${product.sku}` : ""}
            </p>
          </div>
        </div>
        <Badge
          variant={archived ? "secondary" : isLow ? "danger" : "success"}
          className="shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-black"
        >
          {archived
            ? t("inventory.archived")
            : isLow
              ? t("inventory.low")
              : t("inventory.stable")}
        </Badge>
      </div>

      <div className="mt-3">
        <StockBar quantity={qty} threshold={minQty} archived={archived} />
      </div>

      <div className="mb-3 mt-3 grid grid-cols-3 gap-2 rounded-xl bg-soft/50 p-2.5">
        <div>
          <p className="text-[8px] font-bold uppercase text-muted">{t("inventory.stock")}</p>
          <p
            className={cn(
              "text-xs font-black tabular-nums",
              isLow && !archived ? "text-danger" : "text-main",
            )}
          >
            {formatQuantity(qty, product.unit)}
          </p>
        </div>
        <div>
          <p className="text-[8px] font-bold uppercase text-muted">{t("inventory.packs")}</p>
          <p className="text-xs font-black tabular-nums text-main">
            {packs === null ? "—" : formatNumber(packs)}
          </p>
        </div>
        <div>
          <p className="text-[8px] font-bold uppercase text-muted">{t("inventory.sell")}</p>
          <p className="text-xs font-black tabular-nums text-success">
            {formatCurrency(product.sell_price || 0)}
          </p>
        </div>
      </div>

      {suggestion > 0 && !archived && (
        <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-[9px] font-bold text-warning">
          <Package size={11} strokeWidth={2.5} aria-hidden />
          {t("inventory.suggestReorder", {
            qty: formatNumber(suggestion),
            unit: unit.shortLabel,
          })}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-lg p-0"
          onClick={() => onView(product)}
          title={t("inventory.viewDetails")}
          aria-label={t("inventory.viewDetails")}
        >
          <Eye size={13} />
        </Button>
        {!archived && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-[10px]"
            onClick={() => onSupply(product)}
          >
            <Plus size={12} className="me-1" />
            {t("inventory.supply")}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 rounded-lg px-2.5 text-[10px]"
          onClick={() => onEdit(product)}
        >
          {t("inventory.edit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-lg px-2 text-[10px]"
          onClick={() => onHistory(product)}
          title={t("inventory.movementTitle")}
          aria-label={t("inventory.movementTitle")}
        >
          <History size={13} />
        </Button>
      </div>
    </article>
  );
}

export default InventoryCard;
