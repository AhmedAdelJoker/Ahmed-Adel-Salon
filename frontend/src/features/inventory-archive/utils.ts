import { formatDateTime } from "@/lib/core/utils";
import type { InventoryLog, ProductMap, ProductMini } from "./types";

/** Stable Latin-digit clock time (HH:MM) with an invalid-date guard. */
export function formatTimeOnly(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function resolveProductImage(
  imageUrl: string | null | undefined,
  staticBaseUrl: string,
): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${staticBaseUrl}${imageUrl}`;
}

/**
 * Creator display label: server-joined name → `مستخدم #id` → `النظام`.
 */
export function resolveCreatorName(log: InventoryLog): string {
  if (log.created_by_name && String(log.created_by_name).trim() !== "") {
    return String(log.created_by_name);
  }
  if (log.created_by_user_id !== null && log.created_by_user_id !== undefined) {
    return `مستخدم #${log.created_by_user_id}`;
  }
  return "النظام";
}

/**
 * Prefer server-enriched product fields (GET /products/logs/all),
 * fall back to the client-side ProductMap (used for images).
 */
export function resolveLogProduct(
  log: InventoryLog,
  productMap: ProductMap,
): ProductMini {
  const mapped = productMap[log.product_id];
  return {
    id: log.product_id,
    name: log.product_name || mapped?.name || `صنف #${log.product_id}`,
    category: log.product_category || mapped?.category,
    company_name: mapped?.company_name,
    image_url: mapped?.image_url,
    unit: log.product_unit || mapped?.unit,
  };
}

export function buildInventoryLogsCsv(
  logs: InventoryLog[],
  productMap: ProductMap,
): string {
  const headers = ["رقم الحركة", "النوع", "الصنف", "التصنيف", "الوحدة", "الكمية", "الرصيد قبل", "الرصيد بعد", "المنشئ", "الملاحظات", "التاريخ"];
  const typeLabel: Record<string, string> = {
    add: "توريد",
    remove: "صرف",
    adjust: "تعديل",
  };
  const rows = logs.map((log) => [
    log.id,
    typeLabel[log.type] || log.type,
    log.product_name ||
      productMap[log.product_id]?.name ||
      `صنف #${log.product_id}`,
    log.product_category || productMap[log.product_id]?.category || "",
    log.product_unit || productMap[log.product_id]?.unit || "",
    log.change_amount,
    log.stock_before ?? "",
    log.stock_after ?? "",
    resolveCreatorName(log),
    (log.note || "").replace(/\n/g, " "),
    log.created_at ? formatDateTime(log.created_at) : "",
  ]);
  const escape = (cell: unknown) =>
    `"${String(cell ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join(
    "\n",
  );
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
