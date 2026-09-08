/**
 * Financial reports domain types (moved from pages/owner/FinancialReports.tsx).
 */
export interface PaymentSlice {
  name: string;
  value: number;
}

export interface TrendPoint {
  name: string;
  rev: number;
  exp: number;
}

export interface FinancialsState {
  revenue: number;
  expenses: number;
  netProfit: number;
  margin: number;
  payments: PaymentSlice[];
  expenseCategories?: unknown[];
  dailyTrends: TrendPoint[];
}
