interface ActivityLogFilters {
  action?: string;
  entityType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

export function exportActivityLogCsv(items: Array<Record<string, any>> = [], filters: ActivityLogFilters = {}): void {
  const rows: string[] = [];
  // Filters section
  rows.push(["نوع السجل", "الحقل", "القيمة"].join(","));
  rows.push(["Filters", "Action", filters.action || "—"].join(","));
  rows.push(["Filters", "Entity Type", filters.entityType || "—"].join(","));
  rows.push(["Filters", "Search", filters.search || "—"].join(","));
  rows.push(["Filters", "Start Date", filters.startDate || "—"].join(","));
  rows.push(["Filters", "End Date", filters.endDate || "—"].join(","));

  rows.push("");
  // Data header
  rows.push(
    [
      "ID",
      "Action",
      "Entity Type",
      "Entity ID",
      "Description",
      "User",
      "Created At",
    ].join(","),
  );
  items.forEach((item) => {
    rows.push(
      [
        item.id ?? "",
        safeCsvValue(item.action),
        safeCsvValue(item.entity_type),
        safeCsvValue(item.entity_id),
        safeCsvValue(item.description),
        safeCsvValue(item.user_name),
        safeCsvValue(item.created_at),
      ].join(","),
    );
  });
  const csvContent = "\uFEFF" + rows.join("\n");
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `activity-log-${new Date().toISOString().slice(0, 10)}.csv`,
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
