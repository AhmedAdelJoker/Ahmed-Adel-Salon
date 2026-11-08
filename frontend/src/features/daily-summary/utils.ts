import type {
  DailySummaryData,
  DailySummaryExpense,
  DailySummaryShift,
} from "./types";

export function todayKey() {
  return new Date().toISOString().split("T")[0];
}

/** صافي ربح اليوم = الإيرادات − المصروفات */
export function calcNetProfit(data: DailySummaryData | undefined): number {
  if (!data) return 0;
  return Number(data.summary?.total_sales || 0) - Number(data.summary?.total_expenses || 0);
}

export function getShiftDisplayName(shift: DailySummaryShift, fallback?: string): string {
  return shift.user?.full_name || shift.user?.username || fallback || `وردية #${shift.id}`;
}

export function getShiftInitial(shift: DailySummaryShift): string {
  const name = getShiftDisplayName(shift);
  return name.charAt(0) || "U";
}

export interface DailySummaryCsvLabels {
  headers: [string, string, string];
  date: string;
  revenue: string;
  invoices: string;
  expenses: string;
  shifts: string;
  netProfit: string;
  shiftSingular: string;
  shiftPlural: string;
  expenseFallback: string;
  shiftSalesLine: (total: number, count: number) => string;
  active: string;
  completed: string;
}

const DEFAULT_CSV_LABELS: DailySummaryCsvLabels = {
  headers: ["البند", "التفاصيل", "القيمة"],
  date: "التاريخ",
  revenue: "إجمالي الإيرادات",
  invoices: "عدد الفواتير",
  expenses: "إجمالي المصروفات",
  shifts: "عدد الورديات",
  netProfit: "صافي الربح",
  shiftSingular: "الورديات",
  shiftPlural: "المصروفات",
  expenseFallback: "مصروف",
  shiftSalesLine: (total, count) => `${total} / ${count} فاتورة`,
  active: "نشطة",
  completed: "مكتملة",
};

export function buildDailySummaryCsv(data: DailySummaryData, labels?: DailySummaryCsvLabels): string {
  const L = labels || DEFAULT_CSV_LABELS;
  const headers = L.headers;
  const lines: (string | number)[][] = [
    [L.date, data.date, ""],
    [L.revenue, "", data.summary.total_sales],
    [L.invoices, "", data.summary.invoice_count],
    [L.expenses, "", data.summary.total_expenses],
    [L.shifts, "", data.summary.shift_count],
    [L.netProfit, "", calcNetProfit(data)],
    [],
    [L.shiftSingular, "", ""],
    ...data.shifts.map((s) => [
      getShiftDisplayName(s),
      s.status === "open" ? L.active : L.completed,
      L.shiftSalesLine(Number(s.total_sales || 0), Number(s.invoice_count || 0)),
    ]),
    [],
    [L.shiftPlural, "", ""],
    ...(data.expenses.map((e: DailySummaryExpense) => [
      e.description || L.expenseFallback,
      e.category || "",
      e.amount,
    ]) as (string | number)[][]),
  ];
  const escape = (cell: unknown) =>
    `"${String(cell ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...lines.map((r) => r.map(escape).join(","))].join(
    "\n",
  );
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
