import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Eye,
  History,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber } from "@/lib/core/utils";
import {
  getAvailablePacks,
  getEstimatedUnitPrice,
  formatQuantity,
  getUnitMeta,
} from "@/features/inventory";
import { StockBar } from "@/features/inventory/components/StockBar";
import {
  computeReorderSuggestion,
  isLowStock,
} from "@/features/inventory/insights";
import type { InventoryProductAny } from "@/features/inventory/hooks/useInventoryForm";

export interface InventoryTableProps {
  products: InventoryProductAny[];
  selection: ReadonlySet<number>;
  onToggleOne: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
  isManagement: boolean;
  sort: string;
  onSortChange: (sort: string) => void;
  onView: (product: InventoryProductAny) => void;
  onSupply: (product: InventoryProductAny) => void;
  onEdit: (product: InventoryProductAny) => void;
  onHistory: (product: InventoryProductAny) => void;
}

/**
 * The shelf as a spreadsheet: the same rows the cards show, with the numbers
 * lined up beside each other so mis-set thresholds and overstocked lines
 * surface on the scan.
 *
 * Sorting lives on the two columns the backend can order for real
 * (`name`, `quantity`); value and margin are derived per row and stay put.
 */
export function InventoryTable({
  products,
  selection,
  onToggleOne,
  onToggleAll,
  isManagement,
  sort,
  onSortChange,
  onView,
  onSupply,
  onEdit,
  onHistory,
}: InventoryTableProps) {
  const { t } = useTranslation("owner");
  const allSelected =
    products.length > 0 && products.every((product) => selection.has(Number(product.id)));
  const someSelected = products.some((product) => selection.has(Number(product.id)));

  const toggleSort = (field: string) => {
    if (sort === field) onSortChange(`-${field}`);
    else if (sort === `-${field}`) onSortChange(field);
    else onSortChange(field === "quantity" ? "-quantity" : "name");
  };

  const sortIcon = (field: string) => {
    if (sort === field) return <ArrowUp size={11} strokeWidth={3} aria-hidden />;
    if (sort === `-${field}`) return <ArrowDown size={11} strokeWidth={3} aria-hidden />;
    return <ArrowUpDown size={11} strokeWidth={2.5} aria-hidden className="opacity-50" />;
  };

  const sortHeader = (field: string, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 text-start font-black uppercase tracking-wide text-muted transition-colors hover:text-main"
    >
      {label}
      {sortIcon(field)}
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[820px] border-collapse text-start">
        <thead>
          <tr className="border-b border-border bg-soft/40 text-[10px]">
            <th scope="col" className="w-12 p-3">
              <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-transparent hover:border-primary/50">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  aria-label={t("inventory.selectAllOnPage")}
                />
                <Check
                  size={14}
                  strokeWidth={3.5}
                  aria-hidden
                  className={cn(
                    allSelected || someSelected ? "text-primary" : "text-transparent",
                  )}
                />
              </label>
            </th>
            <th
              scope="col"
              className="p-3"
              aria-sort={sort === "name" ? "ascending" : sort === "-name" ? "descending" : "none"}
            >
              {sortHeader("name", t("inventory.colName"))}
            </th>
            <th scope="col" className="p-3 text-start font-black uppercase tracking-wide text-muted">
              {t("inventory.colCategory")}
            </th>
            <th
              scope="col"
              className="p-3"
              aria-sort={
                sort === "quantity"
                  ? "ascending"
                  : sort === "-quantity"
                    ? "descending"
                    : "none"
              }
            >
              {sortHeader("quantity", t("inventory.colStock"))}
            </th>
            <th scope="col" className="p-3 text-start font-black uppercase tracking-wide text-muted">
              {t("inventory.colPacks")}
            </th>
            <th scope="col" className="p-3 text-start font-black uppercase tracking-wide text-muted">
              {t("inventory.colValue")}
            </th>
            <th scope="col" className="p-3 text-start font-black uppercase tracking-wide text-muted">
              {t("inventory.colSuggestion")}
            </th>
            <th scope="col" className="w-32 p-3 text-start font-black uppercase tracking-wide text-muted">
              <span className="sr-only">{t("inventory.colActions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const qty = Number(product.quantity || 0);
            const minQty = Number(product.min_quantity_alert || 0);
            const isLow = isLowStock(qty, minQty);
            const hasPack = Number(product.weight || 0) > 0;
            const packs = hasPack ? getAvailablePacks(product) : null;
            const unit = getUnitMeta(product.unit);
            const value = getEstimatedUnitPrice(product) * qty;
            const suggestion = computeReorderSuggestion(qty, minQty);
            const archived = !!product.is_archived;
            const id = Number(product.id);
            const checked = selection.has(id);

            return (
              <tr
                key={product.id}
                onClick={() => onView(product)}
                className={cn(
                  "cursor-pointer border-b border-border/60 align-middle text-xs transition-colors last:border-0 odd:bg-soft/30 hover:bg-primary/5",
                  checked && "bg-primary/5",
                )}
              >
                <td className="p-3" onClick={(event) => event.stopPropagation()}>
                  <label
                    className={cn(
                      "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border transition-all",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-transparent hover:border-primary/50",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => onToggleOne(id)}
                      aria-label={t("inventory.selectItem", { name: product.name })}
                    />
                    <Check size={14} strokeWidth={3.5} aria-hidden />
                  </label>
                </td>
                <td className="max-w-[15rem] p-3">
                  <p className="truncate font-black text-main" title={product.name}>
                    {product.name}
                  </p>
                  <p className="truncate text-[10px] font-medium text-muted">
                    {product.sku ? `${product.sku}` : "—"}
                    {archived ? ` · ${t("inventory.archived")}` : ""}
                  </p>
                </td>
                <td className="max-w-[10rem] truncate p-3 font-bold text-muted">
                  {product.category || t("inventory.categoryFallback")}
                </td>
                <td className="p-3">
                  <div className="w-32">
                    <p
                      className={cn(
                        "font-black tabular-nums text-main",
                        isLow && !archived && "text-danger",
                      )}
                    >
                      {formatQuantity(qty, product.unit)}
                    </p>
                    <StockBar
                      quantity={qty}
                      threshold={minQty}
                      archived={archived}
                      className="mt-1 h-1"
                    />
                  </div>
                </td>
                <td className="p-3 tabular-nums text-muted">
                  {packs === null ? "—" : formatNumber(packs)}
                </td>
                <td className="p-3 font-black tabular-nums text-main">
                  {formatCurrency(value)}
                </td>
                <td className="p-3">
                  {suggestion > 0 && !archived ? (
                    <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[9px] font-black tabular-nums text-warning">
                      +{formatNumber(suggestion)} {unit.shortLabel}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-muted">—</span>
                  )}
                </td>
                <td className="p-3">
                  <div
                    className="flex items-center gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-lg p-0 text-muted hover:text-main"
                      onClick={() => onView(product)}
                      title={t("inventory.viewDetails")}
                      aria-label={t("inventory.viewDetails")}
                    >
                      <Eye size={14} />
                    </Button>
                    {!archived && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-0 text-primary hover:text-primary"
                        onClick={() => onSupply(product)}
                        title={t("inventory.supply")}
                        aria-label={t("inventory.supply")}
                      >
                        <Plus size={14} />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-lg p-0 text-muted hover:text-main"
                      onClick={() => onHistory(product)}
                      title={t("inventory.movementTitle")}
                      aria-label={t("inventory.movementTitle")}
                    >
                      <History size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default InventoryTable;
