/**
 * Pure helpers behind the redesigned inventory screen.
 *
 * Everything here is derived from data the API already returns (or can be
 * derived from it alone), so the numbers the screen shows can be unit-tested
 * without booting the app.
 */

export interface InsightRow {
  id: number;
  name: string;
  category?: string | null;
  unit?: string;
  quantity: number;
  min_quantity_alert?: number;
  cost: number;
  value: number;
}

export interface ConsumedRow {
  id: number;
  name: string;
  unit?: string;
  consumed: number;
}

export interface StagnantRow {
  id: number;
  name: string;
  unit?: string;
  quantity: number;
  value: number;
  last_movement_at: string | null;
}

export interface CategoryAggregate {
  category: string;
  count: number;
  value: number;
  cost: number;
}

export interface LowStockSuggestion {
  id: number;
  name: string;
  unit?: string;
  quantity: number;
  min_quantity_alert: number;
  suggested: number;
}

export interface InventoryInsights {
  days: number;
  totals: { units: number; packs: number; lines: number; missing_pack_size: number };
  top_by_value: InsightRow[];
  most_consumed: ConsumedRow[];
  stagnant: StagnantRow[];
  categories: CategoryAggregate[];
  low_stock: LowStockSuggestion[];
}

export interface CategoryShare extends CategoryAggregate {
  share: number;
}

/** Pseudo-key for the bucket holding everything after the top slices. */
export const OTHER_CATEGORY = "__other__";

/**
 * The value distribution of the shelf, as shares that sum to 1.
 *
 * Slices are sorted by value, capped at `maxSlices`, and everything past the
 * cap is merged into a single "other" bucket -- otherwise a shelf dominated by
 * an uncategorised mass renders nine unreadable slivers.
 */
export function computeCategoryShares(
  categories: CategoryAggregate[] | undefined | null,
  maxSlices = 4,
): CategoryShare[] {
  const rows = (categories ?? [])
    .filter((c) => Number(c?.value) > 0)
    .map((c) => ({ ...c, count: Number(c.count || 0), value: Number(c.value), cost: Number(c.cost || 0) }));
  const total = rows.reduce((sum, c) => sum + c.value, 0);
  if (total <= 0) return [];

  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  if (rest.length > 0) {
    head.push({
      category: OTHER_CATEGORY,
      count: rest.reduce((sum, c) => sum + c.count, 0),
      value: rest.reduce((sum, c) => sum + c.value, 0),
      cost: rest.reduce((sum, c) => sum + c.cost, 0),
    });
  }
  return head.map((c) => ({ ...c, share: c.value / total }));
}

/** Out of stock / at or below the alert threshold -- mirrors the backend KPI. */
export function isLowStock(quantity: number, threshold: number): boolean {
  return Number(quantity || 0) <= Number(threshold || 0);
}

/**
 * How much to order to reach twice the alert threshold.
 *
 * Only products with a real threshold get a suggestion; a threshold of zero
 * means "not monitored", and suggesting an amount there is guessing.
 */
export function computeReorderSuggestion(
  quantity: number,
  threshold: number,
): number {
  const min = Number(threshold || 0);
  if (min <= 0) return 0;
  const current = Number(quantity || 0);
  return Math.max(0, Math.ceil(2 * min - current));
}
