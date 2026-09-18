/**
 * Financial reports domain types (moved from pages/owner/FinancialReports.tsx).
 */

/** Generic row type for API responses that may contain any fields. */
export type RawRow = Record<string, any>;
export interface PaymentSlice {
  name: string;
  value: number;
}

export interface TrendPoint {
  name: string;
  date: string;
  label: string;
  rev: number;
  exp: number;
  net: number;
  /** True when this point aggregates several days (ranges > 45 days are bucketed weekly). */
  isBucket?: boolean;
  /** Inclusive end date (YYYY-MM-DD) when isBucket is true. */
  rangeEnd?: string;
}

export interface ExpenseSlice {
  name: string;
  value: number;
  count?: number;
  labelAr?: string;
}

export interface GrowthDelta {
  /** % change vs previous equal-length period, null when no baseline. */
  revenue: number | null;
  expenses: number | null;
  net: number | null;
  /** Margin change in percentage points, null when no baseline. */
  marginDelta: number | null;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface FinancialsState {
  revenue: number;
  expenses: number;
  netProfit: number;
  margin: number;
  payments: PaymentSlice[];
  expenseCategories: ExpenseSlice[];
  dailyTrends: TrendPoint[];
  prevDailyTrends: TrendPoint[];
  invoiceCount: number;
  expenseCount: number;
  avgTicket: number;
  expenseRatio: number;
  bestDay?: TrendPoint | null;
  growth: GrowthDelta;
  prevRange: DateRange | null;
  /** Server-side total invoices (may exceed fetched rows). */
  totalInvoices: number;
  /** True when rows were capped for performance. */
  truncated: boolean;
  /** Full invoice rows for drill-down (last fetch). */
  invoiceRows: RawRow[];
  /** Full expense rows for drill-down (last fetch). */
  expenseRows: RawRow[];
}
