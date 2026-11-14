import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  CreditCard,
  Eye,
  FileDown,
  FileText,
  Landmark,
  MessageCircle,
  MoreHorizontal,
  Printer,
  RefreshCw,
  ShieldCheck,
  Split,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/core/utils";
import {
  formatCurrency,
  formatDateParts,
  invoiceBarber,
  invoiceCreatedAt,
  invoiceCustomer,
  invoiceId,
  invoiceIsClosed,
  invoiceNo,
  invoicePayment,
  invoicePaymentLabel,
  invoiceStatusLabel,
  invoiceTotal,
  isInvoiceEditable,
  type InvoiceRecord,
} from "@/features/invoices/utils/invoice";

export interface InvoicesTableSortConfig {
  key: string;
  direction: string;
}

export interface InvoicesTableProps {
  loading: boolean;
  error?: string | null;
  filteredInvoices: InvoiceRecord[];
  visibleColumns: Record<string, boolean>;
  sortConfig: InvoicesTableSortConfig;
  handleSort: (key: string) => void;
  busyPdfId: number | string | null;
  busyWhatsappId?: number | string | null;
  hasFilters: boolean;
  onSelectInvoice: (invoice: InvoiceRecord) => void;
  onPrintInvoice: (invoice: InvoiceRecord) => void;
  onOpenPdf: (invoice: InvoiceRecord) => void;
  onSendWhatsapp: (invoice: InvoiceRecord) => void;
  onRequestAdjustment: (invoice: InvoiceRecord) => void;
  onResetFilters: () => void;
  onRetry?: () => void;
  onCreateFromPos?: () => void;
}

const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  wallet: Wallet,
  bank_transfer: Landmark,
  split: Split,
};

function PaymentBadge({ invoice }: { invoice: InvoiceRecord }) {
  const method = invoicePayment(invoice);
  const Icon = PAYMENT_ICONS[method] || Banknote;
  return (
    <Badge variant="secondary" size="sm" className="gap-1 font-bold">
      <Icon size={11} />
      {invoicePaymentLabel(invoice)}
    </Badge>
  );
}

function StatusBadge({ invoice }: { invoice: InvoiceRecord }) {
  const closed = invoiceIsClosed(invoice);
  return (
    <Badge
      variant={closed ? "danger" : "success"}
      size="sm"
      className="gap-1 font-bold"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          closed ? "bg-danger" : "bg-success",
        )}
      />
      {invoiceStatusLabel(invoice)}
    </Badge>
  );
}

function SortLabel({
  label,
  sortKey,
  sortConfig,
  onSort,
  align = "start",
}: {
  label: string;
  sortKey: string;
  sortConfig: InvoicesTableSortConfig;
  onSort: (key: string) => void;
  align?: "start" | "end";
}) {
  const { t } = useTranslation("invoices");
  const active = sortConfig.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={t("table.sortBy", { column: label })}
      className={cn(
        "inline-flex w-full items-center gap-1 rounded-md text-[11px] font-black text-muted transition-colors hover:text-main",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      {label}
      {active ? (
        sortConfig.direction === "asc" ? (
          <ArrowUp size={11} className="text-primary" />
        ) : (
          <ArrowDown size={11} className="text-primary" />
        )
      ) : (
        <ArrowUp size={11} className="opacity-0 transition-opacity group-hover/th:opacity-30" />
      )}
    </button>
  );
}

function RowActions({
  invoice,
  busyPdfId,
  busyWhatsappId,
  onSelectInvoice,
  onPrintInvoice,
  onOpenPdf,
  onSendWhatsapp,
  onRequestAdjustment,
  compact = false,
}: {
  invoice: InvoiceRecord;
  busyPdfId: number | string | null;
  busyWhatsappId?: number | string | null;
  onSelectInvoice: (invoice: InvoiceRecord) => void;
  onPrintInvoice: (invoice: InvoiceRecord) => void;
  onOpenPdf: (invoice: InvoiceRecord) => void;
  onSendWhatsapp: (invoice: InvoiceRecord) => void;
  onRequestAdjustment: (invoice: InvoiceRecord) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation("invoices");
  const editable = isInvoiceEditable(invoice);
  const id = invoiceId(invoice);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-lg", compact ? "h-7 w-7" : "h-8 w-8")}
          aria-label={t("table.actionsLabel", { no: invoiceNo(invoice) })}
          title={t("actions.viewDetails")}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal size={15} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => onSelectInvoice(invoice)}>
          <Eye size={14} /> {t("actions.viewDetails")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPrintInvoice(invoice)}>
          <Printer size={14} /> {t("actions.printReceipt")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busyPdfId === id}
          onSelect={() => onOpenPdf(invoice)}
        >
          <FileDown size={14} /> {t("actions.downloadPdf")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busyWhatsappId === id}
          onSelect={() => onSendWhatsapp(invoice)}
        >
          <MessageCircle size={14} /> {t("actions.sendWhatsapp")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!editable}
          onSelect={() => onRequestAdjustment(invoice)}
          className="text-warning focus:text-warning"
        >
          <ShieldCheck size={14} /> {t("actions.requestAdjustment")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <div className="hidden space-y-1.5 p-3 lg:block">
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            className="grid grid-cols-[150px_1fr_110px_110px_90px_120px_44px] items-center gap-3 rounded-xl px-3 py-2.5"
            aria-hidden="true"
          >
            <div className="h-3 w-24 animate-pulse rounded bg-soft" />
            <div className="space-y-1.5">
              <div className="h-3 w-40 animate-pulse rounded bg-soft" />
              <div className="h-2 w-24 animate-pulse rounded bg-soft" />
            </div>
            <div className="h-3 w-16 animate-pulse rounded bg-soft" />
            <div className="h-5 w-16 animate-pulse rounded bg-soft" />
            <div className="h-5 w-14 animate-pulse rounded bg-soft" />
            <div className="ms-auto h-4 w-20 animate-pulse rounded bg-soft" />
            <div className="h-7 w-7 animate-pulse rounded-lg bg-soft" />
          </div>
        ))}
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="rounded-2xl border border-border/50 p-3" aria-hidden="true">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-2.5 w-28 animate-pulse rounded bg-soft" />
                <div className="h-3.5 w-36 animate-pulse rounded bg-soft" />
                <div className="h-2 w-24 animate-pulse rounded bg-soft" />
              </div>
              <div className="space-y-2">
                <div className="ms-auto h-4 w-20 animate-pulse rounded bg-soft" />
                <div className="ms-auto h-2.5 w-24 animate-pulse rounded bg-soft" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function InvoicesTable({
  loading,
  error,
  filteredInvoices,
  visibleColumns,
  sortConfig,
  handleSort,
  busyPdfId,
  busyWhatsappId,
  hasFilters,
  onSelectInvoice,
  onPrintInvoice,
  onOpenPdf,
  onSendWhatsapp,
  onRequestAdjustment,
  onResetFilters,
  onRetry,
  onCreateFromPos,
}: InvoicesTableProps) {
  const { t } = useTranslation("invoices");
  // aria-sort belongs on the columnheader (<th>), not on the button inside it.
  const ariaSort = (key: string) =>
    sortConfig.key === key
      ? (sortConfig.direction === "asc" ? "ascending" : "descending")
      : undefined;

  if (loading && filteredInvoices.length === 0) return <LoadingSkeleton />;

  if (error && filteredInvoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <AlertTriangle size={24} />
        </div>
        <div>
          <p className="text-base font-black text-main">{t("table.errorTitle")}</p>
          <p className="mt-1 max-w-sm text-xs font-bold text-muted">{error}</p>
        </div>
        {onRetry && (
          <Button variant="outline" className="h-9 rounded-xl" onClick={onRetry}>
            <RefreshCw size={13} className="ms-1.5" /> {t("table.retry")}
          </Button>
        )}
      </div>
    );
  }

  if (filteredInvoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center sm:py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-soft text-muted">
          <FileText size={28} />
        </div>
        <div>
          <p className="text-base font-black text-main">
            {hasFilters ? t("table.emptyTitleFiltered") : t("table.emptyTitleDefault")}
          </p>
          <p className="mt-1 text-xs font-bold text-muted">
            {hasFilters ? t("table.emptyDescFiltered") : t("table.emptyDescDefault")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {hasFilters && (
            <Button
              variant="outline"
              className="h-9 rounded-xl"
              onClick={onResetFilters}
            >
              <RefreshCw size={13} className="ms-1.5" /> {t("table.clearFilters")}
            </Button>
          )}
          {!hasFilters && onCreateFromPos && (
            <Button className="h-9 rounded-xl" onClick={onCreateFromPos}>
              {t("table.createFromPos")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    invoice: InvoiceRecord,
  ) => {
    // The row is keyboard-activatable, but the inner buttons (row actions)
    // bubble their own key events up. Without this guard, Enter on the
    // actions menu opened the invoice details instead of the menu.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectInvoice(invoice);
    }
  };

  return (
    <div aria-busy={loading || undefined} role={loading ? "status" : undefined}>
      <div className="hidden lg:block">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              {visibleColumns.invoiceNo && (
                <TableHead scope="col" aria-sort={ariaSort("invoiceNo")} className="w-[150px]">
                  <SortLabel
                    label={t("table.invoice")}
                    sortKey="invoiceNo"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </TableHead>
              )}
              {visibleColumns.customer && (
                <TableHead scope="col" className="min-w-[190px]">
                  <span className="text-[11px] font-black text-muted">
                    {t("table.customerBarber")}
                  </span>
                </TableHead>
              )}
              {visibleColumns.date && (
                <TableHead scope="col" aria-sort={ariaSort("date")} className="w-[125px]">
                  <SortLabel
                    label={t("table.date")}
                    sortKey="date"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </TableHead>
              )}
              {visibleColumns.payment && (
                <TableHead scope="col" className="w-[120px]">
                  <span className="text-[11px] font-black text-muted">
                    {t("table.payment")}
                  </span>
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead scope="col" className="w-[95px]">
                  <span className="text-[11px] font-black text-muted">
                    {t("table.status")}
                  </span>
                </TableHead>
              )}
              {visibleColumns.amount && (
                <TableHead scope="col" aria-sort={ariaSort("amount")} className="w-[135px] text-end">
                  <SortLabel
                    label={t("table.amount")}
                    sortKey="amount"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="end"
                  />
                </TableHead>
              )}
              {visibleColumns.actions && (
                <TableHead scope="col" className="w-[54px]">
                  <span className="sr-only">{t("table.actionsSr")}</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice, index) => {
              const created = formatDateParts(invoiceCreatedAt(invoice));
              return (
                <TableRow
                  key={invoiceId(invoice) ?? index}
                  tabIndex={0}
                  role="button"
                  aria-label={`${t("table.invoice")} ${invoiceNo(invoice)} - ${invoiceCustomer(invoice)}`}
                  className="group/row cursor-pointer border-border/40 transition-colors hover:bg-primary-soft/25 focus-visible:bg-primary-soft/30 focus-visible:outline-none"
                  onClick={() => onSelectInvoice(invoice)}
                  onKeyDown={(event) => handleRowKeyDown(event, invoice)}
                >
                  {visibleColumns.invoiceNo && (
                    <TableCell className="py-2.5">
                      <span
                        dir="ltr"
                        className="whitespace-nowrap font-mono text-[11px] font-bold tracking-tight text-main"
                      >
                        {invoiceNo(invoice)}
                      </span>
                    </TableCell>
                  )}
                  {visibleColumns.customer && (
                    <TableCell className="py-2.5">
                      <div className="truncate text-[13px] font-black text-main">
                        {invoiceCustomer(invoice)}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-bold text-muted">
                        {t("table.barberPrefix", {
                          name: invoiceBarber(invoice),
                        })}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.date && (
                    <TableCell className="whitespace-nowrap py-2.5">
                      <div className="text-[11px] font-black text-main">
                        {created.date}
                      </div>
                      <div className="mt-0.5 text-[10px] font-bold text-muted">
                        {created.time}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.payment && (
                    <TableCell className="py-2.5">
                      <PaymentBadge invoice={invoice} />
                    </TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell className="py-2.5">
                      <StatusBadge invoice={invoice} />
                    </TableCell>
                  )}
                  {visibleColumns.amount && (
                    <TableCell className="py-2.5 text-end">
                      <span className="whitespace-nowrap text-[13px] font-black tabular-nums text-primary">
                        {formatCurrency(invoiceTotal(invoice))}
                      </span>
                    </TableCell>
                  )}
                  {visibleColumns.actions && (
                    <TableCell
                      className="py-2.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <RowActions
                        invoice={invoice}
                        busyPdfId={busyPdfId}
                        busyWhatsappId={busyWhatsappId}
                        onSelectInvoice={onSelectInvoice}
                        onPrintInvoice={onPrintInvoice}
                        onOpenPdf={onOpenPdf}
                        onSendWhatsapp={onSendWhatsapp}
                        onRequestAdjustment={onRequestAdjustment}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border/50 lg:hidden">
        {filteredInvoices.map((invoice, index) => {
          const created = formatDateParts(invoiceCreatedAt(invoice));
          return (
            <li key={invoiceId(invoice) ?? index}>
              <div className="p-3.5">
                <button
                  type="button"
                  aria-label={`${t("table.invoice")} ${invoiceNo(invoice)} - ${invoiceCustomer(invoice)}`}
                  className="block w-full text-start transition-colors hover:bg-primary-soft/10 focus-visible:bg-primary-soft/30 focus-visible:outline-none rounded-xl p-1"
                  onClick={() => onSelectInvoice(invoice)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {visibleColumns.invoiceNo && (
                        <p
                          dir="ltr"
                          className="truncate font-mono text-[10px] font-bold text-muted"
                        >
                          {invoiceNo(invoice)}
                        </p>
                      )}
                      {visibleColumns.customer && (
                        <>
                          <p className="mt-1 truncate text-sm font-black text-main">
                            {invoiceCustomer(invoice)}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] font-bold text-muted">
                            {t("table.barberPrefix", {
                              name: invoiceBarber(invoice),
                            })}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="shrink-0 text-end">
                      {visibleColumns.amount && (
                        <p className="text-base font-black tabular-nums text-primary">
                          {formatCurrency(invoiceTotal(invoice))}
                        </p>
                      )}
                      {visibleColumns.date && (
                        <p className="mt-0.5 text-[10px] font-bold text-muted">
                          {created.date} • {created.time}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                {(visibleColumns.payment || visibleColumns.status || visibleColumns.actions) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {visibleColumns.payment && <PaymentBadge invoice={invoice} />}
                    {visibleColumns.status && <StatusBadge invoice={invoice} />}
                    {visibleColumns.actions && (
                      <div className="ms-auto flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          aria-label={t("actions.viewDetails")}
                          onClick={() => onSelectInvoice(invoice)}
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          aria-label={t("actions.printReceipt")}
                          onClick={() => onPrintInvoice(invoice)}
                        >
                          <Printer size={14} />
                        </Button>
                        <RowActions
                          invoice={invoice}
                          busyPdfId={busyPdfId}
                          busyWhatsappId={busyWhatsappId}
                          onSelectInvoice={onSelectInvoice}
                          onPrintInvoice={onPrintInvoice}
                          onOpenPdf={onOpenPdf}
                          onSendWhatsapp={onSendWhatsapp}
                          onRequestAdjustment={onRequestAdjustment}
                          compact
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
