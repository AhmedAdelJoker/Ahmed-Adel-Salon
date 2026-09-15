export { useReportsDashboard } from "@/features/reports-dashboard/hooks/useReportsDashboard";
export type { UseReportsDashboardReturn } from "@/features/reports-dashboard/hooks/useReportsDashboard";
export {
  DEFAULT_STATS,
  DEMO_STATS,
  FALLBACK_SERVICES,
  FALLBACK_WEEKLY,
  KPI_CONFIG,
  PERIODS,
} from "@/features/reports-dashboard/constants";
export type {
  DashboardStats,
  KpiConfigEntry,
  PeriodOption,
  ServiceSlice,
  WeeklyRow,
} from "@/features/reports-dashboard/constants";
export { formatStatValue, getTrendVariant } from "@/features/reports-dashboard/utils";
export type { TrendVariant } from "@/features/reports-dashboard/utils";
export { InsightCard } from "@/features/reports-dashboard/components/InsightCard";
export type { InsightCardProps, InsightIconColor } from "@/features/reports-dashboard/components/InsightCard";
export { KpiStats } from "@/features/reports-dashboard/components/KpiStats";
export type { KpiStatsProps } from "@/features/reports-dashboard/components/KpiStats";
export { QuickActions } from "@/features/reports-dashboard/components/QuickActions";
export type { QuickActionsProps } from "@/features/reports-dashboard/components/QuickActions";
export { RevenueChart } from "@/features/reports-dashboard/components/RevenueChart";
export type { RevenueChartProps } from "@/features/reports-dashboard/components/RevenueChart";
export { ServiceDistribution } from "@/features/reports-dashboard/components/ServiceDistribution";
export type { ServiceDistributionProps } from "@/features/reports-dashboard/components/ServiceDistribution";
export { SmartInsights } from "@/features/reports-dashboard/components/SmartInsights";
export type { SmartInsightsProps } from "@/features/reports-dashboard/components/SmartInsights";
