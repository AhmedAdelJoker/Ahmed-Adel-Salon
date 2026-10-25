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
  MoreHorizontal,
  Printer,
  RefreshCw,
  ShieldCheck,
  Split,
  Wallet,
} from "lucide-react";
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
  statusLabels,
  invoiceStatus,
  invoiceTotal,
  isInvoiceEditable,
} from "@/features/invoices/utils/invoice";

export interface InvoicesTableSortConfig {
  key: string;
  direction: string;
}

export interface InvoicesTableProps {
  loading: boolean;
  error?: string | null;
  filteredInvoices: any[];
  visibleColumns: Record<string, boolean>;
  sortConfig: InvoicesTableSortConfig;
  handleSort: (key: string) => void;
  busyPdfId: number | string | null;
  hasFilters: boolean;
  onSelectInvoice: (invoice: any) => void;
  onPrintInvoice: (invoice: any) => void;
  onOpenPdf: (invoice: any) => void;
  onRequestAdjustment: (invoice: any) => void;
  onResetFilters: () => void;
  onRetry?: () => void;
}

const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  wallet: Wallet,
  bank_transfer: Landmark,
  split: Split,
};

function PaymentBadge({ invoice }: { invoice: any }) {
  const method = invoicePayment(invoice);
  const Icon = PAYMENT_ICONS[method] || Banknote;
  return (
    <Badge variant="secondary" size="sm" className="gap-1 font-bold">
      <Icon size={11} />
      {invoicePaymentLabel(invoice)}
    </Badge>
  );
}

function StatusBadge({ invoice }: { invoice: any }) {
  const closed = invoiceIsClosed(invoice);
  return (
    <Badge
      variant={closed ? "danger" : "success"}
      size="sm"
      className="font-bold"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          closed ? "bg-danger" : "bg-success",
        )}
      />
      {statusLabels[invoiceStatus(invoice)] || "مكتملة"}
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
  const active = sortConfig.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
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
  onSelectInvoice,
  onPrintInvoice,
  onOpenPdf,
  onRequestAdjustment,
  compact = false,
}: {
  invoice: any;
  busyPdfId: number | string | null;
  onSelectInvoice: (invoice: any) => void;
  onPrintInvoice: (invoice: any) => void;
  onOpenPdf: (invoice: any) => void;
  onRequestAdjustment: (invoice: any) => void;
  compact?: boolean;
}) {
  const editable = isInvoiceEditable(invoice);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-lg", compact ? "h-7 w-7" : "h-8 w-8")}
          aria-label={`إجراءات الفاتورة ${invoiceNo(invoice)}`}
          title="إجراءات"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal size={15} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => onSelectInvoice(invoice)}>
          <Eye size={14} /> تفاصيل الفاتورة
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPrintInvoice(invoice)}>
          <Printer size={14} /> طباعة إيصال
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busyPdfId === invoiceId(invoice)}
          onSelect={() => onOpenPdf(invoice)}
        >
          <FileDown size={14} /> تحميل PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!editable}
          onSelect={() => onRequestAdjustment(invoice)}
          className="text-warning focus:text-warning"
        >
          <ShieldCheck size={14} /> طلب تعديل
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
          <div key={row} className="rounded-2xl border border-border/50 p-3">
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
  hasFilters,
  onSelectInvoice,
  onPrintInvoice,
  onOpenPdf,
  onRequestAdjustment,
  onResetFilters,
  onRetry,
}: InvoicesTableProps) {
  if (loading) return <LoadingSkeleton />;

  if (error && filteredInvoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <AlertTriangle size={24} />
        </div>
        <div>
          <p className="text-base font-black text-main">تعذر تحميل الفواتير</p>
          <p className="mt-1 max-w-sm text-xs font-bold text-muted">{error}</p>
        </div>
        {onRetry && (
          <Button variant="outline" className="h-9 rounded-xl" onClick={onRetry}>
            <RefreshCw size={13} className="ms-1.5" /> إعادة المحاولة
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
            {hasFilters ? "لا توجد فواتير مطابقة" : "لا توجد فواتير بعد"}
          </p>
          <p className="mt-1 text-xs font-bold text-muted">
            {hasFilters
              ? "جرّب تغيير الفترة أو مسح الفلاتر"
              : "أول فاتورة تُصدر من نقطة البيع ستظهر هنا"}
          </p>
        </div>
        {hasFilters && (
          <Button
            variant="outline"
            className="h-9 rounded-xl"
            onClick={onResetFilters}
          >
            <RefreshCw size={13} className="ms-1.5" /> مسح الفلاتر
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="hidden lg:block">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              {visibleColumns.invoiceNo && (
                <TableHead className="w-[150px]">
                  <SortLabel
                    label="الفاتورة"
                    sortKey="invoiceNo"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </TableHead>
              )}
              {visibleColumns.customer && (
                <TableHead className="min-w-[190px]">
                  <span className="text-[11px] font-black text-muted">
                    العميل والخبير
                  </span>
                </TableHead>
              )}
              {visibleColumns.date && (
                <TableHead className="w-[125px]">
                  <SortLabel
                    label="التاريخ"
                    sortKey="date"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </TableHead>
              )}
              {visibleColumns.payment && (
                <TableHead className="w-[120px]">
                  <span className="text-[11px] font-black text-muted">
                    الدفع
                  </span>
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead className="w-[95px]">
                  <span className="text-[11px] font-black text-muted">
                    الحالة
                  </span>
                </TableHead>
              )}
              {visibleColumns.amount && (
                <TableHead className="w-[135px] text-end">
                  <SortLabel
                    label="القيمة"
                    sortKey="amount"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="end"
                  />
                </TableHead>
              )}
              {visibleColumns.actions && (
                <TableHead className="w-[54px]">
                  <span className="sr-only">إجراءات</span>
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
                  aria-label={`فاتورة ${invoiceNo(invoice)} - ${invoiceCustomer(invoice)}`}
                  className="group/row cursor-pointer border-border/40 transition-colors hover:bg-primary-soft/25 focus-visible:bg-primary-soft/30 focus-visible:outline-none"
                  onClick={() => onSelectInvoice(invoice)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectInvoice(invoice);
                    }
                  }}
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
                        الخبير: {invoiceBarber(invoice)}
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
                        onSelectInvoice={onSelectInvoice}
                        onPrintInvoice={onPrintInvoice}
                        onOpenPdf={onOpenPdf}
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
              <div
                role="button"
                tabIndex={0}
                aria-label={`فاتورة ${invoiceNo(invoice)} - ${invoiceCustomer(invoice)}`}
                className="cursor-pointer p-3.5 transition-colors hover:bg-primary-soft/20 focus-visible:bg-primary-soft/30 focus-visible:outline-none"
                onClick={() => onSelectInvoice(invoice)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectInvoice(invoice);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      dir="ltr"
                      className="truncate font-mono text-[10px] font-bold text-muted"
                    >
                      {invoiceNo(invoice)}
                    </p>
                    <p className="mt-1 truncate text-sm font-black text-main">
                      {invoiceCustomer(invoice)}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-bold text-muted">
                      الخبير: {invoiceBarber(invoice)}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-base font-black tabular-nums text-primary">
                      {formatCurrency(invoiceTotal(invoice))}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold text-muted">
                      {created.date} • {created.time}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <PaymentBadge invoice={invoice} />
                  <StatusBadge invoice={invoice} />
                  <div
                    className="ms-auto flex items-center gap-0.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      aria-label={`عرض تفاصيل ${invoiceNo(invoice)}`}
                      onClick={() => onSelectInvoice(invoice)}
                    >
                      <Eye size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      aria-label={`طباعة ${invoiceNo(invoice)}`}
                      onClick={() => onPrintInvoice(invoice)}
                    >
                      <Printer size={14} />
                    </Button>
                    <RowActions
                      invoice={invoice}
                      busyPdfId={busyPdfId}
                      onSelectInvoice={onSelectInvoice}
                      onPrintInvoice={onPrintInvoice}
                      onOpenPdf={onOpenPdf}
                      onRequestAdjustment={onRequestAdjustment}
                      compact
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
