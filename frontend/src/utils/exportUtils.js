// ✅ CSV Export
export function exportToCSV(filename, rows) {
  const csv = rows.map((r) => r.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

// ✅ PDF Export (Styled)
export function exportToPDF(title, rows) {
  const tableRows = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");

  const html = `
  <html dir="rtl">
  <body style="font-family:Arial;padding:20px">
    <h2>${title}</h2>

    <table border="1" width="100%" cellpadding="6">
      ${tableRows}
    </table>
  </body>
  </html>
  `;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.print();
}
