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
  recipient_name: string;
  reference_type: string;
  reference_id: string;
  internal_notes: string;
}
