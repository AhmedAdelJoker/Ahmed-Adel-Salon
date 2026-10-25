export type ArchiveMonthStatus = "open" | "partial" | "locked";

export interface ArchiveMonth {
  key: string;
  label: string;
  label_ar: string;
  year: number;
  month: number;
  invoice_count: number;
  draft_count: number;
  /** فواتير أُلغيت أو أُقفلت منفردة — ليست قفل الشهر. */
  voided_count: number;
  total_amount: number;
  paid_count: number;
  /** الشهر مقفل في جدول `month_closures` (مصدر الحقيقة الوحيد). */
  is_locked: boolean;
  locked_at: string | null;
  status: ArchiveMonthStatus;
  change_percent: number | null;
}

export interface ArchiveSummary {
  totalRevenue: number;
  totalInvoices: number;
  totalDrafts: number;
  totalVoidedInvoices: number;
  lockedMonths: number;
  partialMonths: number;
  avg: number;
  avgInvoice: number;
  voidRate: number;
  best: ArchiveMonth;
}

export interface ArchiveComparison {
  current: ArchiveMonth;
  previous: ArchiveMonth;
  diff: number;
  pct: number | null;
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
  subtotal_amount?: number;
  discount_amount?: number;
  is_closed?: boolean;
  status?: string;
  items?: unknown[];
  [key: string]: unknown;
}

export interface MonthInvoicePage {
  items: MonthInvoice[];
  total: number;
}
