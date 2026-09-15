import { formatNumber } from "@/lib/core/utils";

export type TrendVariant = "positive" | "negative" | "neutral";

export function formatStatValue(key: string, value: unknown): string {
  const isMoney = ["todayRevenue", "todayExpenses", "netProfit", "avgInvoice"].includes(key);
  const isPercent = key === "occupancy";
  if (isPercent) return `${value}%`;
  if (isMoney) {
    return new Intl.NumberFormat("ar-EG-u-nu-latn", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
  return formatNumber(value);
}

export function getTrendVariant(trendValue: number | null | undefined): TrendVariant {
  if (trendValue === undefined || trendValue === null) return "neutral";
  return trendValue >= 0 ? "positive" : "negative";
}
