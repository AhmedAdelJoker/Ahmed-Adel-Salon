/**
 * Cashbox domain types — strict, professional. خزنة المحل المركزية (كاش + غير كاش)
 */

export type CashDirection = "in" | "out";
export type CashPaymentMethod = "cash" | "card" | "bank_transfer" | "wallet";
export type CashTransactionType =
  | "invoice_payment"
  | "expense_payment"
  | "manual_deposit"
  | "manual_withdraw"
  | "opening_balance"
  | "closing_balance"
  | "refund"
  | "payroll_payment"
  | "salary_advance"
  | string;

export interface CashboxSummary {
  total_in: number;
  total_out: number;
  cash_balance: number;
  today_sales: number;
  today_expenses: number;
  today_net: number;
  // فصل الكاش عن غير الكاش
  cash_in: number;
  cash_out: number;
  cash_balance_detail: number;
  non_cash_in: number;
  non_cash_out: number;
  non_cash_balance: number;
  cash_today_sales: number;
  cash_today_expenses: number;
  cash_today_net: number;
  non_cash_today_sales: number;
  non_cash_today_expenses: number;
  non_cash_today_net: number;
  drawer_balance: number;
  drawer_open_shifts: number;
  by_payment_method: Record<string, number>;
  // المدة (يوم/أسبوع/شهر/سنة) — حساب شخصي + تقرير حركة
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  period_in: number;
  period_out: number;
  period_net: number;
  period_cash_in: number;
  period_cash_out: number;
  period_cash_net: number;
  period_non_cash_in: number;
  period_non_cash_out: number;
  period_non_cash_net: number;
}

export interface VaultUserBrief {
  id: number;
  username?: string | null;
  full_name?: string | null;
  role?: string | null;
  profile_image_url?: string | null;
}

export interface Transaction {
  id: number;
  transaction_no: string | null;
  reference_no: string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  type: CashTransactionType;
  notes: string | null;
  payment_method: CashPaymentMethod | string | null;
  direction: CashDirection;
  is_voided: boolean | number;
  transaction_date: string;
  created_at: string;
  amount: number;
  balance_after: number | null;
  created_by_user_id?: number | null;
  user_id?: number | null;
  created_by_user?: VaultUserBrief | null;
  user?: VaultUserBrief | null;
  recipient_name?: string | null;
}

export interface CashboxTrendPoint {
  date: string;
  label: string;
  in: number;
  out: number;
  net: number;
  cash_in?: number;
  non_cash_in?: number;
}

export interface CashboxTypeBreakdown {
  type: string;
  value: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  value: number;
}

export interface CashboxStats {
  summary: CashboxSummary;
  trend: CashboxTrendPoint[];
  breakdown: CashboxTypeBreakdown[];
  by_method?: PaymentMethodBreakdown[];
  drawer?: { balance: number; open_shifts: number };
}

export interface CashboxBalanceResponse {
  balance: number;
  cash_balance: number;
  non_cash_balance: number;
  filtered_balance: number;
}

export interface CashboxListParams {
  q?: string;
  search?: string;
  direction?: CashDirection | "all";
  type?: string;
  payment_method?: string;
  is_voided?: boolean;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface CreateCashTransactionPayload {
  direction: CashDirection;
  amount: number;
  payment_method?: CashPaymentMethod | string;
  notes?: string;
  reference_no?: string | null;
  recipient_name?: string | null;
}
