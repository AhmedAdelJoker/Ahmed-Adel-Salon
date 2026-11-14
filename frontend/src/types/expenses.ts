/**
 * Expenses domain types (moved from pages/owner/Expenses.tsx).
 */
export interface ExpenseCreator {
  id?: number | string;
  username?: string;
  full_name?: string;
  role?: string;
  profile_image_url?: string;
}

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
  recipient_name?: string;
  reference_type?: string | null;
  reference_id?: number | string | null;
  internal_notes?: string | null;
  created_by_user_id?: number | string | null;
  created_by?: ExpenseCreator | null;
  created_by_user?: ExpenseCreator | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ExpenseCategorySlice {
  name: string;
  /** Arabic label provided by the backend (`expense_label_ar`). */
  label_ar?: string | null;
  value: number;
}

export interface ExpensePaymentSlice {
  method: string;
  amount: number;
  count: number;
}

/**
 * Real `/expenses/summary` payload. Money totals are approved-only; pending
 * is reported separately via pending_total/pending_count. `status_breakdown`
 * is the only field that includes rejected/pending amounts.
 */
export interface ExpenseSummary {
  total_amount: number;
  count: number;
  categories: ExpenseCategorySlice[];
  payment_breakdown: ExpensePaymentSlice[];
  pending_total: number;
  pending_count: number;
  today_total: number;
  month_total: number;
  year_total: number;
  top_category?: string | null;
  top_category_ar?: string | null;
  top_amount: number;
  status_breakdown: Record<string, { amount: number; count: number }>;
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
  recipient_name: string;
  reference_type: string;
  reference_id: string;
  internal_notes: string;
}
