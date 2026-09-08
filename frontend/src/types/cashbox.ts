/**
 * Cashbox domain types (moved from pages/owner/Cashbox.tsx).
 */
export interface CashboxSummary {
  total_in: number;
  total_out: number;
  cash_balance: number;
  today_sales: number;
  today_expenses: number;
  today_net: number;
}

export interface Transaction {
  id?: number | string;
  transaction_no?: string;
  reference_no?: string;
  type?: string;
  notes?: string;
  payment_method?: string;
  direction?: string;
  is_voided?: boolean | number;
  transaction_date?: string;
  created_at?: string;
  amount?: number;
  [key: string]: unknown;
}
