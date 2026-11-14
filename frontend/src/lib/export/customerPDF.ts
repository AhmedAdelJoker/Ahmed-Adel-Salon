/**
 * Customer PDF Export — generates a printable customer profile PDF.
 *
 * Uses the browser's native window.print() with a dedicated print stylesheet,
 * so it works offline and in Electron without requiring jsPDF or any server
 * endpoint. The output is a clean A4 page with the customer's profile,
 * stats, appointment history and invoice history.
 */
import { formatCurrency } from "@/lib/core/utils";

export interface ExportCustomerPDFParams {
  customer: any;
  appointments: any[];
  invoices: any[];
  stats: any;
  tierInfo: any;
  salonName: string;
}

export function exportCustomerPDF(params: ExportCustomerPDFParams): void {
  const {
    customer,
    appointments,
    invoices,
    stats,
    tierInfo,
    salonName,
  } = params;

  const completedAppointments = appointments.filter((a) =>
    ["completed", "done", "checked_out", "paid"].includes(
      String(a.status || "").toLowerCase(),
    ),
  );

  const upcomingAppointments = appointments.filter((a) =>
    ["pending", "confirmed", "waiting"].includes(
      String(a.status || "").toLowerCase(),
    ),
  );

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>بيانات العميل - ${customer.first_name} ${customer.last_name || ""}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Tahoma, Arial, "Cairo", sans-serif;
      font-size: 12px;
      color: #111827;
      line-height: 1.5;
      direction: rtl;
      text-align: right;
    }
    .no-print { display: none; }
    .header {
      border-bottom: 3px solid #D4AF37;
      padding-bottom: 15px;
      margin-bottom: 25px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 900;
      color: #111827;
    }
    .header-subtitle {
      font-size: 14px;
      color: #6b7280;
      margin-top: 8px;
    }
    .customer-card {
      border: 2px solid #e5e7eb;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 25px;
      background: #f9fafb;
    }
    .customer-name {
      font-size: 22px;
      font-weight: 900;
      color: #111827;
      margin-bottom: 10px;
    }
    .customer-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 15px;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #4b5563;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 25px;
    }
    .stat-card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 15px;
      text-align: center;
      background: #fff;
    }
    .stat-label {
      font-size: 10px;
      font-weight: 900;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 900;
      color: #111827;
    }
    .stat-value.text-success { color: #059669; }
    .stat-value.text-warning { color: #d97706; }
    .stat-value.text-info { color: #0284c7; }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 900;
      color: #D4AF37;
      text-transform: uppercase;
      margin-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      background: #f3f4f6;
      color: #6b7280;
      font-weight: 900;
      text-align: right;
      padding: 8px;
      border: 1px solid #e5e7eb;
    }
    td {
      padding: 8px;
      border: 1px solid #e5e7eb;
      color: #111827;
    }
    tr:nth-child(even) td { background: #f9fafb; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 9px;
      font-weight: 900;
    }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    .badge-rose { background: #fee2e2; color: #991b1b; }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px dashed #e5e7eb;
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
    }
    .text-main { color: #111827; }
    .text-muted { color: #6b7280; }
    .text-success { color: #059669; }
    .text-warning { color: #d97706; }
    .text-info { color: #0284c7; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${salonName}</h1>
    <div class="header-subtitle">بيانات العميل وتفاصيل التعاملات</div>
  </div>

  <div class="customer-card">
    <div class="customer-name">
      ${customer.first_name} ${customer.last_name || ""}
      <span class="badge ${tierInfo.color.replace('text-', 'bg-') + '/' + '10'}">${tierInfo.label}</span>
    </div>
    <div class="customer-meta">
      ${customer.phone ? `<div class="meta-item">📱 ${customer.phone}</div>` : ""}
      ${customer.second_phone ? `<div class="meta-item">📞 ${customer.second_phone}</div>` : ""}
      ${customer.email ? `<div class="meta-item">✉️ ${customer.email}</div>` : ""}
      ${customer.created_at ? `<div class="meta-item">📅 عميل منذ: ${new Date(customer.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short" })}</div>` : ""}
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">إجمالي الإنفاق</div>
      <div class="stat-value">${formatCurrency(stats.totalSpend || 0)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">عدد الزيارات</div>
      <div class="stat-value text-info">${stats.visits || 0}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">نقاط الولاء</div>
      <div class="stat-value text-warning">${stats.points || 0}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">المبلغ المدفوع</div>
      <div class="stat-value text-success">${formatCurrency(stats.totalPaid || 0)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">متوسط الإنفاق/زيارة</div>
      <div class="stat-value text-info">${formatCurrency(stats.avgSpend || 0)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">معدل عدم الحضور</div>
      <div class="stat-value text-warning">${stats.noShowRate || 0}%</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">سجل المواعيد (${completedAppointments.length + upcomingAppointments.length})</h2>
    ${appointments.length === 0 ? `<p style="text-align:center;color:#6b7280;">لا توجد مواعيد مسجلة لهذا العميل</p>` : `
    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الوقت</th>
          <th>الخدمة</th>
          <th>الخبير</th>
          <th>الحالة</th>
          <th>المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${appointments.slice(0, 20).map((appt) => `
          <tr>
            <td>${new Date(appt.appointment_date).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short" })}</td>
            <td>${appt.appointment_time || appt.appointmentTime || "—"}</td>
            <td>${appt.service_name_snapshot || appt.service_name || "—"}</td>
            <td>${appt.barber_name || appt.employee_name || "—"}</td>
            <td><span class="badge badge-${appt.status === "COMPLETED" || appt.status === "DONE" ? "success" : appt.status === "CANCELLED" ? "rose" : "info"}">${appt.status}</span></td>
            <td>${formatCurrency(appt.total_estimated_price || appt.total_price || 0)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${appointments.length > 20 ? `<p style="text-align:center;color:#6b7280;font-size:11px;">عرض أول 20 موعد من أصل ${appointments.length}</p>` : ""}
    `}
  </div>

  <div class="section">
    <h2 class="section-title">الفواتير (${invoices.length})</h2>
    ${invoices.length === 0 ? `<p style="text-align:center;color:#6b7280;">لا توجد فواتير مسجلة لهذا العميل</p>` : `
    <table>
      <thead>
        <tr>
          <th>رقم الفاتورة</th>
          <th>التاريخ</th>
          <th>المبلغ</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${invoices.map((inv) => `
          <tr>
            <td>${inv.invoice_no || `#${inv.id}`}</td>
            <td>${new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
            <td>${formatCurrency(inv.total_amount || inv.amount || 0)}</td>
            <td><span class="badge ${inv.is_closed ? "badge-rose" : "badge-success"}">${inv.is_closed ? "ملغاة" : "صادرة"}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    `}
  </div>

  <div class="footer">
    ${salonName} - نظام صالون برو - ${new Date().getFullYear()} © جميع الحقوق محفوظة<br>
    تم استخراج هذا التقرير آلياً لعميل: ${customer.first_name} ${customer.last_name || ""}
  </div>
</body>
</html>
  `;

  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) {
    // Fallback: create a hidden iframe and print
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        (iframe.contentWindow as Window).focus();
        (iframe.contentWindow as Window).print();
        document.body.removeChild(iframe);
      };
    }
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}
