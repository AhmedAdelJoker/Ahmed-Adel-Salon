export const CHART_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit_card: "بطاقة ائتمان",
  card: "بطاقة",
  visa: "فيزا",
  mastercard: "ماستركارد",
  wallet: "محفظة إلكترونية",
  instapay: "انستاباي",
  bank_transfer: "تحويل بنكي",
  vodafone_cash: "فودافون كاش",
  orange_money: "أورانج موني",
};

export type PresetId = "today" | "week" | "month" | "quarter";

export const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "7 أيام" },
  { id: "month", label: "الشهر" },
  { id: "quarter", label: "90 يوم" },
];
