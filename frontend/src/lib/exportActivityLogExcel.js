import ExcelJS from "exceljs";

function autoWidth(worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 12;

    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value ? String(cell.value) : "";
      maxLength = Math.max(maxLength, value.length + 2);
    });

    column.width = Math.min(Math.max(maxLength, 12), 45);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function normalizeValue(value) {
  if (value === null || value === undefined || value === "") {
    return "---";
  }

  if (value instanceof Date) {
    return value.toLocaleString("ar-EG");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return value;
}

function buildRowsFromObjects(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      columns: [{ header: "لا توجد بيانات", key: "empty" }],
      rows: [{ empty: "لا توجد بيانات للتصدير" }],
    };
  }

  const keys = Array.from(
    items.reduce((set, item) => {
      Object.keys(item || {}).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );

  const columns = keys.map((key) => ({
    header: key,
    key,
  }));

  const rows = items.map((item) => {
    const row = {};
    keys.forEach((key) => {
      row[key] = normalizeValue(item?.[key]);
    });
    return row;
  });

  return { columns, rows };
}

function styleHeaderRow(worksheet) {
  const headerRow = worksheet.getRow(1);

  headerRow.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };

  headerRow.alignment = {
    horizontal: "center",
    vertical: "middle",
  };
}

export async function exportActivityLogExcel(activityLogs = [], filters = {}) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Salon Management Pro";
  workbook.created = new Date();

  const filtersSheet = workbook.addWorksheet("Filters", {
    views: [{ rightToLeft: true }],
  });

  filtersSheet.columns = [
    { header: "المفتاح", key: "key", width: 25 },
    { header: "القيمة", key: "value", width: 35 },
  ];

  const filterRows = Object.entries(filters || {}).map(([key, value]) => ({
    key,
    value: normalizeValue(value),
  }));

  if (filterRows.length === 0) {
    filtersSheet.addRow({
      key: "filters",
      value: "لا توجد فلاتر مطبقة",
    });
  } else {
    filterRows.forEach((row) => filtersSheet.addRow(row));
  }

  styleHeaderRow(filtersSheet);

  const dataSheet = workbook.addWorksheet("ActivityLog", {
    views: [{ rightToLeft: true }],
  });

  const { columns, rows } = buildRowsFromObjects(activityLogs);

  dataSheet.columns = columns;
  rows.forEach((row) => dataSheet.addRow(row));

  styleHeaderRow(dataSheet);
  autoWidth(dataSheet);
  autoWidth(filtersSheet);

  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const filename = `activity-log-${new Date().toISOString().slice(0, 10)}.xlsx`;

  downloadBlob(blob, filename);
}

export default exportActivityLogExcel;
