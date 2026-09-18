export type InventoryLogType = "add" | "remove" | "adjust" | string;

export interface InventoryLog {
  id: number;
  product_id: number;
  type: InventoryLogType;
  change_amount: number;
  note?: string | null;
  created_at: string;
  created_by_user_id?: number | null;
  /** Enriched by GET /products/logs/all — falls back to ProductMap when absent. */
  product_name?: string | null;
  product_category?: string | null;
  product_unit?: string | null;
  /** Creator display name (server-joined). Falls back to `مستخدم #id`. */
  created_by_name?: string | null;
  /** Stock level right before / after this movement (server-computed). */
  stock_before?: number | string | null;
  stock_after?: number | string | null;
}

export interface ProductMini {
  id: number;
  name?: string;
  category?: string;
  company_name?: string;
  image_url?: string | null;
  unit?: string;
}

export type ProductMap = Record<number, ProductMini>;

export interface InventoryLogSummary {
  total: number;
  adds: number;
  removes: number;
  net: number;
}
