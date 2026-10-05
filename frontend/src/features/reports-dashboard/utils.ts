import { formatNumber } from "@/lib/core/utils";

export type TrendVariant = "positive" | "negative" | "neutral";

export function formatStatValue(key: string, value: unknown): string {
  // `null` means the server could not compute the figure. Coercing it to 0
  // would report an empty day, and `${null}%` renders the literal string
  // "null%". Same reasoning as getTrendVariant below: absence of data is a
  // state, not a value.
  if (value === null || value === undefined) return "—";

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
