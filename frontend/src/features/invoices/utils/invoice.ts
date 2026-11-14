/**
 * Invoices feature: constants + pure helpers.
 *
 * Anything a user reads is translated here via `i18n.t("invoices:…")`, the same
 * pattern the customer helpers use. Keeping the lookups at the call site was
 * what left the English UI full of Arabic labels — the components all reached
 * for Arabic literals and the helpers were the only neutral place to fix it.
 */
import i18n from "@/i18n";
import { formatCurrency as formatCurrencyShared } from "@/lib/core/utils";
import { getIntlLocale } from "@/lib/format/locale";

export type InvoiceStatus = "open" | "closed";

export interface InvoicePayment {
  payment_method?: string | null;
  amount?: number | string | null;
  shift_id?: number | null;
}

export interface InvoiceLine {
  id?: number | string | null;
  service_id?: number | null;
  product_id?: number | null;
  offer_id?: number | null;
  service_name?: string | null;
  serviceName?: string | null;
  product_name?: string | null;
  productName?: string | null;
  name?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  qty?: number | string | null;
  unit_price?: number | string | null;
  unitPrice?: number | string | null;
  price?: number | string | null;
  total_price?: number | string | null;
  totalPrice?: number | string | null;
  employee_id?: number | null;
  barber_name?: string | null;
  barberName?: string | null;
  employee_name?: string | null;
  employeeName?: string | null;
  [key: string]: unknown;
}

export interface InvoiceRecord {
  id?: number | string | null;
  invoice_id?: number | string | null;
  invoiceId?: number | string | null;
  invoice_no?: string | null;
  invoiceNo?: string | null;
  number?: string | null;
  appointment_id?: number | null;
  customer_id?: number | null;
  barber_id?: number | null;
  customer_name?: string | null;
  customerName?: string | null;
  client_name?: string | null;
  customer_name_snapshot?: string | null;
  barber_name?: string | null;
  barberName?: string | null;
  employee_name?: string | null;
  payment_method?: string | null;
  paymentMethod?: string | null;
  payment?: string | null;
  subtotal_amount?: number | string | null;
  subtotalAmount?: number | string | null;
  discount_amount?: number | string | null;
  discountAmount?: number | string | null;
  tax_rate?: number | string | null;
  taxRate?: number | string | null;
  tax_amount?: number | string | null;
  taxAmount?: number | string | null;
  total_amount?: number | string | null;
  totalAmount?: number | string | null;
  total?: number | string | null;
  net_total?: number | string | null;
  netTotal?: number | string | null;
  is_closed?: boolean | null;
  isClosed?: boolean | null;
  status?: string | null;
  invoice_status?: string | null;
  invoiceStatus?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  date?: string | null;
  invoice_date?: string | null;
  invoiceDate?: string | null;
  items?: unknown[] | null;
  invoice_items?: unknown[] | null;
  lines?: unknown[] | null;
  payments?: InvoicePayment[] | null;
  pdf_path?: string | null;
  [key: string]: unknown;
}

export const PAYMENT_METHOD_VALUES = [
  "cash",
  "card",
  "wallet",
  "bank_transfer",
  "split",
] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number];

export const STATUS_FILTER_VALUES = ["all", "open", "closed"] as const;
export type StatusFilterValue = (typeof STATUS_FILTER_VALUES)[number];

export function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value: unknown): string {
  return formatCurrencyShared(value);
}

export function paymentMethodLabel(method: string | undefined | null): string {
  const key = String(method ?? "").toLowerCase();
  const known = new Set([
    "cash",
    "card",
    "visa",
    "mada",
    "wallet",
    "bank_transfer",
    "instapay",
    "split",
  ]);
  return known.has(key) ? i18n.t(`invoices:payments.${key}`) : key || i18n.t("invoices:payments.unknown");
}

export function statusFilterLabel(value: string): string {
  return i18n.t(`invoices:statuses.${value}`);
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
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  const datePart = date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date: datePart, time: timePart, full: `${datePart} • ${timePart}` };
}

export function formatDate(value: unknown): string {
  return formatDateParts(value).full;
}

export function invoiceId(invoice: InvoiceRecord | null | undefined): number | string | undefined {
  return invoice?.id ?? invoice?.invoice_id ?? invoice?.invoiceId ?? undefined;
}

export function invoiceNo(invoice: InvoiceRecord | null | undefined): string {
  return String(
    invoice?.invoice_no ??
      invoice?.invoiceNo ??
      invoice?.number ??
      invoiceId(invoice) ??
      "—",
  );
}

export function invoiceCustomer(invoice: InvoiceRecord | null | undefined): string {
  const name =
    invoice?.customer_name ||
    invoice?.customerName ||
    invoice?.customer_name_snapshot ||
    (invoice?.customer as { name?: string | null } | undefined)?.name ||
    invoice?.client_name;
  if (!name || name === "N/A") return i18n.t("invoices:customer.walkIn");
  return String(name);
}

export function invoicePayment(invoice: InvoiceRecord | null | undefined): string {
  return String(
    invoice?.payment_method ??
      invoice?.paymentMethod ??
      invoice?.payment ??
      "",
  ).toLowerCase();
}

export function invoicePaymentLabel(invoice: InvoiceRecord | null | undefined): string {
  return paymentMethodLabel(invoicePayment(invoice));
}

export function invoiceIsClosed(invoice: InvoiceRecord | null | undefined): boolean {
  if (!invoice) return false;
  if (typeof invoice.is_closed === "boolean") return invoice.is_closed;
  if (typeof invoice.isClosed === "boolean") return invoice.isClosed;
  const status = String(
    invoice?.status ??
      invoice?.invoice_status ??
      invoice?.invoiceStatus ??
      "",
  ).toLowerCase();
  return ["closed", "cancelled", "canceled", "voided", "void", "refunded"].includes(status);
}

export function invoiceStatus(invoice: InvoiceRecord | null | undefined): InvoiceStatus {
  return invoiceIsClosed(invoice) ? "closed" : "open";
}

export function invoiceStatusLabel(invoice: InvoiceRecord | null | undefined): string {
  const key = invoiceStatus(invoice);
  return i18n.t(`invoices:statuses.${key}`);
}

export function invoiceTotal(invoice: InvoiceRecord | null | undefined): number {
  return asNumber(
    invoice?.total_amount ??
      invoice?.totalAmount ??
      invoice?.total ??
      invoice?.net_total ??
      invoice?.netTotal,
  );
}

export function invoiceSubtotal(invoice: InvoiceRecord | null | undefined): number {
  return asNumber(invoice?.subtotal_amount ?? invoice?.subtotalAmount);
}

export function invoiceDiscount(invoice: InvoiceRecord | null | undefined): number {
  return asNumber(invoice?.discount_amount ?? invoice?.discountAmount);
}

export function invoiceTaxAmount(invoice: InvoiceRecord | null | undefined): number {
  return asNumber(invoice?.tax_amount ?? invoice?.taxAmount);
}

export function invoiceTaxRate(invoice: InvoiceRecord | null | undefined): number {
  return asNumber(invoice?.tax_rate ?? invoice?.taxRate);
}

/** Payment rows of a split-payment invoice. Empty for single-method sales. */
export function invoicePaymentRows(
  invoice: InvoiceRecord | null | undefined,
): InvoicePayment[] {
  return Array.isArray(invoice?.payments) ? (invoice?.payments as InvoicePayment[]) : [];
}

export function invoiceCreatedAt(
  invoice: InvoiceRecord | null | undefined,
): string | undefined | null {
  return (
    invoice?.created_at ??
    invoice?.createdAt ??
    invoice?.date ??
    invoice?.invoice_date ??
    invoice?.invoiceDate ??
    undefined
  );
}

export function rowsFromInvoice(
  invoice: InvoiceRecord | null | undefined,
): InvoiceLine[] {
  return Array.isArray(invoice?.items)
    ? (invoice?.items as InvoiceLine[])
    : Array.isArray(invoice?.invoice_items)
      ? (invoice?.invoice_items as InvoiceLine[])
      : Array.isArray(invoice?.lines)
        ? (invoice?.lines as InvoiceLine[])
        : [];
}

export function itemName(item: InvoiceLine | null | undefined): string {
  return (
    item?.service_name ||
    item?.serviceName ||
    item?.product_name ||
    item?.productName ||
    item?.name ||
    item?.description ||
    i18n.t("invoices:item.fallback")
  );
}

export function itemQty(item: InvoiceLine | null | undefined): number {
  return asNumber(item?.quantity ?? item?.qty ?? 1) || 1;
}

export function itemTotal(item: InvoiceLine | null | undefined): number {
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

export function itemUnitPrice(item: InvoiceLine | null | undefined): number {
  return asNumber(
    item?.unit_price ?? item?.unitPrice ?? item?.price ?? item?.total_price ?? item?.totalPrice,
  );
}

export function invoiceBarber(invoice: InvoiceRecord | null | undefined): string {
  const direct =
    invoice?.barber_name || invoice?.barberName || invoice?.employee_name;
  if (direct && direct !== "N/A") return String(direct);

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
            (i.employee as { full_name?: string | null } | undefined)?.full_name ||
            (i.employee as { fullName?: string | null } | undefined)?.fullName,
        )
        .filter((name) => Boolean(name) && name !== "N/A"),
    ),
  ];
  if (names.length === 0) return "—";
  if (names.length === 1) return String(names[0]);
  return i18n.t("invoices:customer.multipleBarbers");
}

export function isInvoiceEditable(invoice: InvoiceRecord | null | undefined): boolean {
  if (!invoice || invoiceIsClosed(invoice)) return false;
  const createdAt = invoiceCreatedAt(invoice);
  if (!createdAt) return true;

  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return false;
  return Date.now() - createdTime <= 60 * 60 * 1000;
}
