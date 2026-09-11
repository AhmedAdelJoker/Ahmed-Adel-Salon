/**
 * @deprecated Merged into `./InvoiceArchivePage`.
 * This legacy 1770-line local-filter archive was superseded by the
 * backend-backed monthly archive (`GET /invoices/archive/monthly` + close/reopen).
 * Kept as a thin re-export so any stale import keeps working and routes to
 * the single canonical implementation at `/invoices/archive`.
 */
export { default } from "./InvoiceArchivePage";
