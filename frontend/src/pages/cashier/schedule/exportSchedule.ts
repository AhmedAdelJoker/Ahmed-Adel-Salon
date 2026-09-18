import { formatTime12h } from "@/lib/core/utils";
import { getStatusConfig } from "@/pages/cashier/schedule/scheduleUtils";

export async function exportSchedulePDF({ appointments, selectedDate }: any): Promise<void> {
  // Lazy-load the heavy PDF libs only when the user actually exports (~430KB saved).
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const dateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString(
    "ar-EG",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("مخطط المواعيد اليومي", 40, 50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`التاريخ: ${dateLabel}`, 40, 70);

  const dayAppts = appointments
    .filter((a) => (a.appointment_date || a.appointmentDate) === selectedDate)
    .sort((a, b) =>
      (a.appointment_time || a.appointmentTime || "").localeCompare(
        b.appointment_time || b.appointmentTime || "",
      ),
    );

  const rows = dayAppts.map((a) => {
    const status = getStatusConfig(a.status);
    return [
      formatTime12h(
        String(a.appointment_time || a.appointmentTime || "").slice(0, 5),
      ),
      a.customer_name || "—",
      a.customer_phone || "—",
      a.barber_name || a.employee_name || "—",
      status.label,
      a.notes || "—",
    ];
  });

  autoTable(doc, {
    startY: 90,
    head: [["الوقت", "اسم العميل", "الهاتف", "الموظف", "الحالة", "ملاحظات"]],
    body: rows,
    styles: {
      fontSize: 9,
      cellPadding: 6,
      halign: "right",
    },
    headStyles: {
      fillColor: [41, 37, 36],
      textColor: [212, 175, 55],
      fontStyle: "bold",
      halign: "right",
    },
    alternateRowStyles: { fillColor: [245, 243, 240] },
    margin: { top: 80 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `صفحة ${i} من ${pageCount}`,
      doc.internal.pageSize.getWidth() - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" },
    );
  }

  doc.save(`schedule-${selectedDate}.pdf`);
}

export function exportScheduleCSV({ appointments, selectedDate }: any) {
  const dayAppts = appointments.filter(
    (a) => (a.appointment_date || a.appointmentDate) === selectedDate,
  );

  const header = [
    "time",
    "customer_name",
    "customer_phone",
    "barber_name",
    "status",
    "notes",
    "booking_source",
  ];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const lines = [
    header.map(escape).join(","),
    ...dayAppts.map((a) =>
      [
        a.appointment_time || a.appointmentTime || "",
        a.customer_name || "",
        a.customer_phone || "",
        a.barber_name || a.employee_name || "",
        getStatusConfig(a.status).label,
        a.notes || "",
        a.booking_source || "",
      ]
        .map(escape)
        .join(","),
    ),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `schedule-${selectedDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
