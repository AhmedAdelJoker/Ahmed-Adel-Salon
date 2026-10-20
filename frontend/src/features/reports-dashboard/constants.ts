import {
  Banknote,
  Calendar,
  Receipt,
  TrendingDown,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface KpiConfigEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  variant: string;
  trendKey: string;
  isPercent?: boolean;
}

export interface PeriodOption {
  value: string;
  label: string;
}

export interface WeeklyRow {
  name: string;
  revenue: number;
  appointments: number;
}

export interface ServiceSlice {
  name: string;
  value: number;
}

export interface DashboardStats {
  todayRevenue: number;
  todayExpenses: number;
  netProfit: number;
  todayAppointments: number;
  avgInvoice: number;
  /** null when the server could not compute it. Distinct from 0. */
  occupancy: number | null;
  todayRevenueTrend: number;
  todayExpensesTrend: number;
  netProfitTrend: number;
  todayAppointmentsTrend: number;
  avgInvoiceTrend: number;
  occupancyTrend: number;
  newCustomersThisWeek?: number;
  // Widened to admit `null` for `occupancy`. Every other declared key stays a
  // plain number, so this only loosens the catch-all rather than making all
  // seven figures nullable at every call site.
  [key: string]: number | null | undefined;
}

export const KPI_CONFIG: KpiConfigEntry[] = [
  { key: "todayRevenue", label: "إيرادات اليوم", icon: Wallet, variant: "primary", trendKey: "todayRevenueTrend" },
  { key: "todayExpenses", label: "مصروفات اليوم", icon: TrendingDown, variant: "danger", trendKey: "todayExpensesTrend" },
  { key: "netProfit", label: "صافي الربح", icon: Banknote, variant: "success", trendKey: "netProfitTrend" },
  { key: "todayAppointments", label: "حجوزات اليوم", icon: Calendar, variant: "info", trendKey: "todayAppointmentsTrend" },
  { key: "avgInvoice", label: "متوسط الفاتورة", icon: Receipt, variant: "warning", trendKey: "avgInvoiceTrend" },
  { key: "occupancy", label: "معدل الإشغال", icon: Zap, variant: "secondary", isPercent: true, trendKey: "occupancyTrend" },
];

export const PERIODS: PeriodOption[] = [
  { value: "today", label: "اليوم" },
  { value: "yesterday", label: "أمس" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "year", label: "هذا العام" },
];

/**
 * What the dashboard shows before the request has answered.
 *
 * All zeros, and deliberately never a stand-in for real figures. Invented
 * numbers rendered as if earned lasted on screen exactly as long as the
 * request -- on a slow connection, an entire day of phantom revenue.
 *
 * `DEFAULT_STATS` is for the loading window: zeros, not a fabricated day.
 */
export const DEFAULT_STATS: DashboardStats = {
  todayRevenue: 0,
  todayExpenses: 0,
  netProfit: 0,
  todayAppointments: 0,
  avgInvoice: 0,
  occupancy: 0,
  todayRevenueTrend: 0,
  todayExpensesTrend: 0,
  netProfitTrend: 0,
  todayAppointmentsTrend: 0,
  avgInvoiceTrend: 0,
  occupancyTrend: 0,
};

