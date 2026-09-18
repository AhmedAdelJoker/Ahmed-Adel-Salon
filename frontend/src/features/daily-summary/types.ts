export interface DailySummaryUser {
  full_name?: string | null;
  username?: string | null;
}

export interface DailySummaryShift {
  id: number;
  status: string;
  opened_at: string;
  closed_at?: string | null;
  total_sales: number | string;
  invoice_count: number;
  user?: DailySummaryUser | null;
}

export interface DailySummaryExpense {
  id: number;
  description?: string | null;
  category?: string | null;
  amount: number | string;
}

export interface DailySummaryTotals {
  total_sales: number | string;
  invoice_count: number;
  total_expenses: number | string;
  shift_count: number;
}

export interface DailySummaryData {
  date: string;
  shifts: DailySummaryShift[];
  expenses: DailySummaryExpense[];
  summary: DailySummaryTotals;
}
