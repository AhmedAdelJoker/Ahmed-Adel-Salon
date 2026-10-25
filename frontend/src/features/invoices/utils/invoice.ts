/**
 * Invoices feature: constants + pure helpers.
 */
import { formatCurrency as formatCurrencyShared } from "@/lib/core/utils";

export type InvoiceStatus = "open" | "closed";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "شبكة / فيزا" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "split", label: "دفع مقسّم" },
] as const;

export const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  card: "شبكة",
  visa: "فيزا",
  mada: "مدى",
  wallet: "محفظة",
  bank_transfer: "تحويل بنكي",
  instapay: "انستا باي",
  split: "دفع مقسّم",
};

export const statusLabels: Record<string, string> = {
  open: "مكتملة",
  closed: "ملغاة",
  paid: "مدفوعة",
  completed: "مكتملة",
  pending: "معلقة",
  cancelled: "ملغاة",
  voided: "ملغاة",
  refunded: "مرتجعة",
};

export const statusOptions = [
  { value: "all", label: "كل الحالات" },
  { value: "open", label: "مكتملة" },
  { value: "closed", label: "ملغاة" },
] as const;

export function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value: unknown): string {
  return formatCurrencyShared(value);
}

export interface InvoiceDateParts {
  date: string;
  time: string;
  full: string;
}

export function formatDateParts(value: unknown): InvoiceDateParts {
  if (!value) return { date: "—", time: "", full: "—" };
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return { date: String(value), time: "", full: String(value) };
  }
  const datePart = date.toLocaleDateString("ar-EG-u-nu-latn", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("ar-EG-u-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date: datePart, time: timePart, full: `${datePart} • ${timePart}` };
}

export function formatDate(value: unknown): string {
  return formatDateParts(value).full;
}

export function invoiceId(invoice: any): number | string | undefined {
  return invoice?.id || invoice?.invoice_id || invoice?.invoiceId;
}

export function invoiceNo(invoice: any): string {
  return (
    invoice?.invoice_no ||
    invoice?.invoiceNo ||
    invoice?.number ||
    invoiceId(invoice) ||
    "—"
  );
}

export function invoiceCustomer(invoice: any): string {
  const name =
    invoice?.customer_name ||
    invoice?.customerName ||
    invoice?.customer?.name ||
    invoice?.client_name;
  if (!name || name === "N/A") return "عميل نقدي";
  return name;
}

export function invoicePayment(invoice: any): string {
  return String(
    invoice?.payment_method || invoice?.paymentMethod || invoice?.payment || "",
  ).toLowerCase();
}

export function invoicePaymentLabel(invoice: any): string {
  const method = invoicePayment(invoice);
  return paymentLabels[method] || method || "—";
}

export function invoiceIsClosed(invoice: any): boolean {
  if (!invoice) return false;
  if (typeof invoice.is_closed === "boolean") return invoice.is_closed;
  if (typeof invoice.isClosed === "boolean") return invoice.isClosed;
  const status = String(
    invoice?.status || invoice?.invoice_status || invoice?.invoiceStatus || "",
  ).toLowerCase();
  return ["closed", "cancelled", "canceled", "voided", "void", "refunded"].includes(
    status,
  );
}

export function invoiceStatus(invoice: any): InvoiceStatus {
  return invoiceIsClosed(invoice) ? "closed" : "open";
}

export function invoiceStatusLabel(invoice: any): string {
  return statusLabels[invoiceStatus(invoice)] || "مكتملة";
}

export function invoiceTotal(invoice: any): number {
  return asNumber(
    invoice?.total_amount ??
      invoice?.totalAmount ??
      invoice?.total ??
      invoice?.net_total ??
      invoice?.netTotal,
  );
}

export function invoiceSubtotal(invoice: any): number {
  return asNumber(invoice?.subtotal_amount ?? invoice?.subtotalAmount);
}

export function invoiceDiscount(invoice: any): number {
  return asNumber(invoice?.discount_amount ?? invoice?.discountAmount);
}

export function invoiceCreatedAt(invoice: any): string | undefined {
  return (
    invoice?.created_at ||
    invoice?.createdAt ||
    invoice?.date ||
    invoice?.invoice_date ||
    invoice?.invoiceDate
  );
}

export function rowsFromInvoice(invoice: any): any[] {
  return Array.isArray(invoice?.items)
    ? invoice.items
    : Array.isArray(invoice?.invoice_items)
      ? invoice.invoice_items
      : Array.isArray(invoice?.lines)
        ? invoice.lines
        : [];
}

export function itemName(item: any): string {
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

export function itemQty(item: any): number {
  return asNumber(item?.quantity ?? item?.qty ?? 1) || 1;
}

export function itemTotal(item: any): number {
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

export function invoiceBarber(invoice: any): string {
  const direct =
    invoice?.barber_name || invoice?.barberName || invoice?.employee_name;
  if (direct && direct !== "N/A") return direct;

  const items = rowsFromInvoice(invoice);
  if (!items.length) return "—";
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
        .filter((name) => Boolean(name) && name !== "N/A"),
    ),
  ];
  if (names.length === 0) return "—";
  if (names.length === 1) return String(names[0]);
  return "متعدد";
}

export function isInvoiceEditable(invoice: any): boolean {
  if (!invoice || invoiceIsClosed(invoice)) return false;
  const createdAt = invoiceCreatedAt(invoice);
  if (!createdAt) return true;

  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return false;
  return Date.now() - createdTime <= 60 * 60 * 1000;
}
