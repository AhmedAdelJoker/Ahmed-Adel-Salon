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

// ✅ PDF Export (Improved Arabic Support)
export function exportToPDF(title, rows) {
  const tableRows = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");

  const html = `
  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Alexandria', sans-serif;
        padding: 40px;
        color: #1a1a1a;
        line-height: 1.6;
      }
      .header {
        text-align: center;
        margin-bottom: 40px;
        border-bottom: 3px solid #6D28D9;
        padding-bottom: 20px;
      }
      h1 {
        margin: 0;
        font-weight: 900;
        color: #6D28D9;
      }
      .date {
        color: #666;
        font-size: 0.9em;
        margin-top: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      th {
        background-color: #f8fafc;
        color: #475569;
        font-weight: 900;
        text-align: right;
        padding: 12px;
        border: 1px solid #e2e8f0;
      }
      td {
        padding: 12px;
        border: 1px solid #e2e8f0;
        font-weight: 700;
        color: #334155;
      }
      tr:nth-child(even) {
        background-color: #f1f5f9;
      }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>${title}</h1>
      <div class="date">تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}</div>
    </div>

    <table>
      <thead>
        ${rows.length > 0 ? `<tr>${rows[0].map((h) => `<th>${h}</th>`).join("")}</tr>` : ""}
      </thead>
      <tbody>
        ${rows
          .slice(1)
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  </body>
  </html>
  `;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();

  // Wait for fonts to load before printing
  w.onload = () => {
    setTimeout(() => {
      w.print();
      // Optional: w.close();
    }, 500);
  };
}
