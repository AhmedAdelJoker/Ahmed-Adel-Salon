import { formatTime12h } from "@/lib/core/utils";
import { getStatusConfig } from "@/pages/cashier/schedule/scheduleUtils";
import i18n from "@/i18n";
import api from "@/services/api";

const translateBookingSource = (src: string | undefined) => {
  if (!src) return "—";
  const translated = i18n.t(`export.bookingSource.${src}`);
  return translated === `export.bookingSource.${src}` ? src : translated;
};

export async function exportSchedulePDF({ appointments, selectedDate }: any): Promise<void> {
  // Prefer backend endpoint for proper Arabic PDF (reportlab + Arabic font).
  try {
    const res = await api.get("/appointments/export/pdf", {
      params: { date: selectedDate },
      responseType: "blob",
    });
    const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `schedule-${selectedDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  } catch (err) {
    // Backend endpoint may not be deployed yet — fall back to client-side jspdf.
    console.warn(
      "Backend schedule-pdf unavailable, falling back to client PDF:",
      err,
    );
  }

  // Lazy-load the heavy PDF libs only when the user actually exports (~430KB saved).
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const dateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString(
    i18n.language === "ar" ? "ar-EG" : "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(i18n.t("export.title"), 40, 50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(i18n.t("export.date", { date: dateLabel }), 40, 70);

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
      translateBookingSource(a.booking_source),
    ];
  });

  autoTable(doc, {
    startY: 90,
    head: [[
      i18n.t("export.time"),
      i18n.t("export.customerName"),
      i18n.t("export.phone"),
      i18n.t("export.barber"),
      i18n.t("export.status"),
      i18n.t("export.notes"),
      i18n.t("export.source"),
    ]],
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
      i18n.t("export.page", { page: i, total: pageCount }),
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
    i18n.t("export.time"),
    i18n.t("export.customerName"),
    i18n.t("export.phone"),
    i18n.t("export.barber"),
    i18n.t("export.status"),
    i18n.t("export.notes"),
    i18n.t("export.source"),
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
        i18n.t("schedule:" + getStatusConfig(a.status).label),
        a.notes || "",
        translateBookingSource(a.booking_source),
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
