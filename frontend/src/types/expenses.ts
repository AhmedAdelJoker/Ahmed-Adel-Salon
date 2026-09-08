/**
 * Expenses domain types (moved from pages/owner/Expenses.tsx).
 */
export interface ExpenseRecord {
  id?: number | string;
  title?: string;
  description?: string;
  amount?: number | string;
  category?: string;
  payment_method?: string;
  expense_date?: string;
  status?: string;
  invoice_image_url?: string;
  [key: string]: unknown;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  [key: string]: unknown;
}

export interface ExpenseFormData {
  title: string;
  description: string;
  amount: string;
  category: string;
  payment_method: string;
  expense_date: string;
  status: string;
  invoice_image_url: string;
}
