/**
 * Financial reports domain types (moved from pages/owner/FinancialReports.tsx).
 */
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
}
