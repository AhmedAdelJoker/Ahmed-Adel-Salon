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
  occupancy: number;
  todayRevenueTrend: number;
  todayExpensesTrend: number;
  netProfitTrend: number;
  todayAppointmentsTrend: number;
  avgInvoiceTrend: number;
  occupancyTrend: number;
  newCustomersThisWeek?: number;
  [key: string]: number | undefined;
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

export const FALLBACK_WEEKLY: WeeklyRow[] = [
  { name: "السبت", revenue: 12500, appointments: 18 },
  { name: "الأحد", revenue: 8200, appointments: 12 },
  { name: "الإثنين", revenue: 9600, appointments: 14 },
  { name: "الثلاثاء", revenue: 11200, appointments: 16 },
  { name: "الأربعاء", revenue: 10800, appointments: 15 },
  { name: "الخميس", revenue: 14500, appointments: 20 },
  { name: "الجمعة", revenue: 16800, appointments: 22 },
];

export const FALLBACK_SERVICES: ServiceSlice[] = [
  { name: "حلاقة", value: 42 },
  { name: "عناية بالبشرة", value: 28 },
  { name: "صبغة", value: 18 },
  { name: "أخرى", value: 12 },
];

export const DEMO_STATS: DashboardStats = {
  todayRevenue: 18750,
  todayExpenses: 3420,
  netProfit: 15330,
  todayAppointments: 24,
  avgInvoice: 780,
  occupancy: 72,
  todayRevenueTrend: 12,
  todayExpensesTrend: -5,
  netProfitTrend: 18,
  todayAppointmentsTrend: 8,
  avgInvoiceTrend: 4,
  occupancyTrend: -2,
};

export const DEFAULT_STATS: DashboardStats = { ...DEMO_STATS };
