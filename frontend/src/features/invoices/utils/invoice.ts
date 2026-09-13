/**
 * Invoices feature: constants + pure helpers (moved from Invoices page).
 */
import { formatCurrency as formatCurrencyShared } from "@/lib/core/utils";

export const paymentLabels = {
  cash: "نقدي",
  card: "شبكة",
  visa: "فيزا",
  mada: "مدى",
  wallet: "محفظة",
  instapay: "انستا باي",
};

export const statusLabels = {
  paid: "مدفوعة",
  completed: "مكتملة",
  pending: "معلقة",
  cancelled: "ملغاة",
  voided: "ملغاة",
  refunded: "مرتجعة",
};

export function asNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value) {
  return formatCurrencyShared(value);
}

export function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ar-EG", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    return String(value);
  }
}

export function invoiceId(invoice) {
  return invoice?.id || invoice?.invoice_id || invoice?.invoiceId;
}

export function invoiceNo(invoice) {
  return (
    invoice?.invoice_no ||
    invoice?.invoiceNo ||
    invoice?.number ||
    invoiceId(invoice) ||
    "-"
  );
}

export function invoiceCustomer(invoice) {
  return (
    invoice?.customer_name ||
    invoice?.customerName ||
    invoice?.customer?.name ||
    invoice?.client_name ||
    "عميل نقدي"
  );
}

export function invoicePayment(invoice) {
  return String(
    invoice?.payment_method || invoice?.paymentMethod || invoice?.payment || "",
  ).toLowerCase();
}

export function invoiceStatus(invoice) {
  return String(
    invoice?.status ||
      invoice?.invoice_status ||
      invoice?.invoiceStatus ||
      "paid",
  ).toLowerCase();
}

export function invoiceTotal(invoice) {
  return asNumber(
    invoice?.total_amount ??
      invoice?.totalAmount ??
      invoice?.total ??
      invoice?.net_total ??
      invoice?.netTotal,
  );
}

export function invoiceCreatedAt(invoice) {
  return (
    invoice?.created_at ||
    invoice?.createdAt ||
    invoice?.date ||
    invoice?.invoice_date ||
    invoice?.invoiceDate
  );
}

export function rowsFromInvoice(invoice) {
  return Array.isArray(invoice?.items)
    ? invoice.items
    : Array.isArray(invoice?.invoice_items)
      ? invoice.invoice_items
      : Array.isArray(invoice?.lines)
        ? invoice.lines
        : [];
}

export function itemName(item) {
  return (
    item?.service_name ||
    item?.serviceName ||
    item?.product_name ||
    item?.productName ||
    item?.name ||
    item?.description ||
    "بند"
  );
}

export function itemQty(item) {
  return asNumber(item?.quantity ?? item?.qty ?? 1) || 1;
}

export function itemTotal(item) {
  const unit = asNumber(
    item?.unit_price ??
      item?.unitPrice ??
      item?.price ??
      item?.total_price ??
      item?.totalPrice,
  );
  return asNumber(
    item?.total_price ?? item?.totalPrice ?? unit * itemQty(item),
  );
}

export function invoiceBarber(invoice) {
  if (invoice?.barber_name) return invoice.barber_name;
  if (invoice?.barberName) return invoice.barberName;
  if (invoice?.employee_name) return invoice?.employee_name;

  const items = rowsFromInvoice(invoice);
  if (!items.length) return "-";
  const names = [
    ...new Set(
      items
        .map(
          (i) =>
            i.barber_name ||
            i.barberName ||
            i.employee_name ||
            i.employeeName ||
            i.employee?.full_name ||
            i.employee?.fullName,
        )
        .filter(Boolean),
    ),
  ];
  if (names.length === 0) return "-";
  if (names.length === 1) return names[0];
  return "متعدد";
}

export function isInvoiceEditable(invoice) {
  if (!invoice) return false;
  const createdAt = invoice.created_at || invoice.createdAt || invoice.date;
  if (!createdAt) return true;

  const createdTime = new Date(createdAt).getTime();
  const now = new Date().getTime();
  const oneHourInMs = 60 * 60 * 1000;

  return now - createdTime <= oneHourInMs;
}
