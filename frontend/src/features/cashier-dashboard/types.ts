export interface CashierSummary {
  today_sales?: number;
  today_expenses?: number;
  present_employees_count?: number;
  waiting_customers?: number;
  today_appointments?: number;
  invoices_count?: number;
  todayCancellationsCount?: number;
  cancellationRate?: number;
  has_open_shift?: boolean;
  current_shift_id?: string | number;
  customers_count?: number;
  low_stock_count?: number;
}

export interface TodayInvoiceItem {
  service_name?: string;
  quantity?: number;
  total_price?: number;
}

export interface TodayInvoice {
  id: string | number;
  invoice_no?: string;
  customer_name?: string;
  total_amount?: number;
  payment_method?: string;
  barber_name?: string;
  items?: TodayInvoiceItem[];
}

export interface InvoiceDialogState {
  open: boolean;
  data: TodayInvoice | null;
}

export interface AdjustmentFormState {
  type: string;
  reason: string;
  newValue: string;
  managerPin: string;
}
