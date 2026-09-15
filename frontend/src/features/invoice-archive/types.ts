export interface ArchiveMonth {
  key: string;
  label_ar: string;
  total_amount: number;
  invoice_count: number;
  paid_count: number;
  is_closed: boolean;
  change_percent?: number;
}

export interface ArchiveSummary {
  totalRevenue: number;
  totalInvoices: number;
  totalPaid: number;
  closedCount: number;
  avg: number;
  best: ArchiveMonth;
}

export interface ArchiveComparison {
  current: ArchiveMonth;
  previous: ArchiveMonth;
  diff: number;
  pct: string | number;
  invDiff: number;
}

export interface MonthInvoice {
  id: string | number;
  invoice_no: string;
  customer_name: string;
  barber_name: string;
  created_at: string;
  payment_method: string;
  total_amount: number;
}

export interface MonthInvoicePage {
  items: MonthInvoice[];
  total: number;
}
