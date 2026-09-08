interface ReportOverview {
  total_revenue?: number;
  total_invoices?: number;
  completed_unpaid?: number;
  done_sessions?: number;
  average_invoice?: number;
  recent_invoices?: Array<Record<string, any>>;
  [key: string]: any;
}

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  serviceId?: string;
  barberId?: string;
  search?: string;
  [key: string]: any;
}

export function exportReportCsv(reportOverview: ReportOverview = {}, filters: ReportFilters = {}): void {
  const lines: string[] = [];
  // Filters / Summary section
  lines.push(["نوع السجل", "الحقل", "القيمة"].join(","));
  lines.push(
    ["Summary", "إجمالي الإيراد", reportOverview.total_revenue || 0].join(","),
  );
  lines.push(
    ["Summary", "إجمالي الفواتير", reportOverview.total_invoices || 0].join(
      ",",
    ),
  );
  lines.push(
    [
      "Summary",
      "الخدمات المكتملة غير المسددة",
      reportOverview.completed_unpaid || 0,
    ].join(","),
  );
  lines.push(
    ["Summary", "الخدمات المنتهية", reportOverview.done_sessions || 0].join(
      ",",
    ),
  );
  lines.push(
    ["Summary", "متوسط الفاتورة", reportOverview.average_invoice || 0].join(
      ",",
    ),
  );

  lines.push(["Summary", "من تاريخ", filters.startDate || "—"].join(","));
  lines.push(["Summary", "إلى تاريخ", filters.endDate || "—"].join(","));
  lines.push(
    ["Summary", "طريقة الدفع", filters.paymentMethod || "الكل"].join(","),
  );
  lines.push(["Summary", "الخدمة", filters.serviceId || "الكل"].join(","));
  lines.push(["Summary", "الحلاق", filters.barberId || "الكل"].join(","));
  lines.push(["Summary", "البحث", filters.search || "—"].join(","));
  // Latest invoices section
  lines.push("");
  lines.push(
    [
      "رقم الفاتورة",
      "العميل",
      "الحلاق",
      "الخدمة",
      "الدفع",
      "الإجمالي",
      "التاريخ",
    ].join(","),
  );
  (reportOverview.recent_invoices || []).forEach((row) => {
    lines.push(
      [
        row.invoice_no || "",
        safeCsvValue(row.customer_name),
        safeCsvValue(row.barber_name),
        safeCsvValue(row.service_name),
        row.payment_method || "",
        row.total_amount || 0,
        row.issued_at || "",
      ].join(","),
    );
  });
  const csvContent = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `report-${new Date().toISOString().slice(0, 10)}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
function safeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}
