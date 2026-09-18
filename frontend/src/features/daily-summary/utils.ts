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

export function getShiftDisplayName(shift: DailySummaryShift): string {
  return shift.user?.full_name || shift.user?.username || `وردية #${shift.id}`;
}

export function getShiftInitial(shift: DailySummaryShift): string {
  const name = getShiftDisplayName(shift);
  return name.charAt(0) || "U";
}

export function buildDailySummaryCsv(data: DailySummaryData): string {
  const headers = ["البند", "التفاصيل", "القيمة"];
  const lines: (string | number)[][] = [
    ["التاريخ", data.date, ""],
    ["إجمالي الإيرادات", "", data.summary.total_sales],
    ["عدد الفواتير", "", data.summary.invoice_count],
    ["إجمالي المصروفات", "", data.summary.total_expenses],
    ["عدد الورديات", "", data.summary.shift_count],
    ["صافي الربح", "", calcNetProfit(data)],
    [],
    ["الورديات", "", ""],
    ...data.shifts.map((s) => [
      getShiftDisplayName(s),
      s.status === "open" ? "نشطة" : "مكتملة",
      `${s.total_sales} / ${s.invoice_count} فاتورة`,
    ]),
    [],
    ["المصروفات", "", ""],
    ...(data.expenses.map((e: DailySummaryExpense) => [
      e.description || "مصروف",
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
