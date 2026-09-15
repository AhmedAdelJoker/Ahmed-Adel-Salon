import {
  ChevronDown,
  ChevronUp,
  Eye,
  FileDown,
  FileText,
  Printer,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  formatDate,
  invoiceBarber,
  invoiceCreatedAt,
  invoiceCustomer,
  invoiceId,
  invoiceNo,
  invoicePayment,
  invoiceStatus,
  invoiceTotal,
  isInvoiceEditable,
  paymentLabels,
  statusLabels,
} from "@/features/invoices";

export interface InvoicesTableSortConfig {
  key: string;
  direction: string;
}

export interface InvoicesTableProps {
  loading: boolean;
  filteredInvoices: Record<string, unknown>[];
  visibleColumns: Record<string, boolean>;
  sortConfig: InvoicesTableSortConfig;
  handleSort: (key: string) => void;
  busyPdfId: number | string | null;
  onSelectInvoice: (invoice: Record<string, unknown>) => void;
  onPrintInvoice: (invoice: Record<string, unknown>) => void;
  onOpenPdf: (invoice: Record<string, unknown>) => void;
  onRequestAdjustment: (invoice: Record<string, unknown>) => void;
  onResetFilters: () => void;
}

export function InvoicesTable({
  loading,
  filteredInvoices,
  visibleColumns,
  sortConfig,
  handleSort,
  busyPdfId,
  onSelectInvoice,
  onPrintInvoice,
  onOpenPdf,
  onRequestAdjustment,
  onResetFilters,
}: InvoicesTableProps) {
  return (
    <>
      {loading ? (
        <div className="space-y-2 p-3 sm:p-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border/30 bg-soft/30 p-3 sm:gap-4"
            >
              <div className="h-8 w-14 shrink-0 rounded-lg bg-soft animate-pulse sm:w-16" />
              <div className="hidden h-4 w-20 rounded-lg bg-soft animate-pulse sm:block" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-soft animate-pulse sm:w-1/2" />
                <div className="h-2 w-1/3 rounded bg-soft animate-pulse" />
              </div>
              <div className="h-6 w-16 rounded-lg bg-soft animate-pulse" />
              <div className="h-6 w-20 rounded-lg bg-soft animate-pulse" />
              <div className="hidden h-8 w-32 rounded-xl bg-soft animate-pulse sm:block" />
            </div>
          ))}
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-soft sm:h-20 sm:w-20">
            <FileText size={28} className="text-muted sm:hidden" />
            <FileText size={36} className="hidden text-muted sm:block" />
          </div>
          <div>
            <p className="text-base font-black text-main sm:text-lg">
              لم يتم العثور على أي فواتير
            </p>
            <p className="mt-1 text-xs font-bold text-muted sm:text-sm">
              جرّب تغيير نطاق التاريخ أو معايير البحث
            </p>
          </div>
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={onResetFilters}
          >
            <RefreshCw size={14} className="ml-1.5" /> إعادة تعيين الفلاتر
          </Button>
        </div>
      ) : (
        <div className="table-wrapper overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                {visibleColumns.invoiceNo && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-soft/50 transition-colors"
                    onClick={() => handleSort("invoiceNo")}
                  >
                    <div className="flex items-center gap-1">
                      <span className="hidden xs:inline">رقم </span>الفاتورة
                      {sortConfig.key === "invoiceNo" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronUp size={11} className="text-primary" />
                        ) : (
                          <ChevronDown size={11} className="text-primary" />
                        ))}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.customer && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-soft/50 transition-colors"
                    onClick={() => handleSort("customer")}
                  >
                    <div className="flex items-center gap-1">
                      العميل
                      {sortConfig.key === "customer" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronUp size={11} className="text-primary" />
                        ) : (
                          <ChevronDown size={11} className="text-primary" />
                        ))}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.date && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-soft/50 transition-colors"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      التاريخ
                      {sortConfig.key === "date" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronUp size={11} className="text-primary" />
                        ) : (
                          <ChevronDown size={11} className="text-primary" />
                        ))}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.payment && <TableHead>الدفع</TableHead>}
                {visibleColumns.status && <TableHead>الحالة</TableHead>}
                {visibleColumns.amount && (
                  <TableHead
                    className="text-left cursor-pointer select-none hover:bg-soft/50 transition-colors"
                    onClick={() => handleSort("amount")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      القيمة
                      {sortConfig.key === "amount" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronUp size={11} className="text-primary" />
                        ) : (
                          <ChevronDown size={11} className="text-primary" />
                        ))}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.actions && (
                  <TableHead className="text-center">إجراءات</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow
                  key={invoiceId(invoice)}
                  className="group/row cursor-pointer transition-colors hover:bg-primary-soft/30"
                  onClick={() => onSelectInvoice(invoice)}
                >
                  {visibleColumns.invoiceNo && (
                    <TableCell className="w-[80px] font-black text-main tabular-nums">
                      #{invoiceNo(invoice)}
                    </TableCell>
                  )}
                  {visibleColumns.customer && (
                    <TableCell className="min-w-[140px]">
                      <div
                        className="max-w-[200px] truncate font-black text-main"
                        title={invoiceCustomer(invoice)}
                      >
                        {invoiceCustomer(invoice)}
                      </div>
                      <div className="text-[9px] font-bold text-primary">
                        الخبير: {invoiceBarber(invoice)}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.date && (
                    <TableCell className="whitespace-nowrap text-[10px] font-bold text-muted">
                      {formatDate(invoiceCreatedAt(invoice))}
                    </TableCell>
                  )}
                  {visibleColumns.payment && (
                    <TableCell>
                      <Badge size="sm" className="h-5 font-bold uppercase">
                        {paymentLabels[invoicePayment(invoice)] ||
                          invoicePayment(invoice)}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell>
                      <Badge
                        variant={
                          invoiceStatus(invoice) === "cancelled"
                            ? "danger"
                            : "success"
                        }
                        size="sm"
                        className="h-5 font-bold"
                      >
                        {statusLabels[invoiceStatus(invoice)] ||
                          invoiceStatus(invoice)}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.amount && (
                    <TableCell className="whitespace-nowrap text-left">
                      <span className="font-black tabular-nums text-primary">
                        {formatCurrency(invoiceTotal(invoice))}
                      </span>
                    </TableCell>
                  )}
                  {visibleColumns.actions && (
                    <TableCell
                      className="w-[1%] whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-60 sm:opacity-40 transition-opacity hover:opacity-100 hover:text-primary group-hover/row:opacity-100 sm:group-hover/row:opacity-80 sm:h-8 sm:w-8"
                          onClick={() => onSelectInvoice(invoice)}
                          title="تفاصيل"
                        >
                          <Eye size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-60 sm:opacity-40 transition-opacity hover:opacity-100 hover:text-primary group-hover/row:opacity-100 sm:group-hover/row:opacity-80 sm:h-8 sm:w-8"
                          onClick={() => onPrintInvoice(invoice)}
                          title="طباعة"
                        >
                          <Printer size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-60 sm:opacity-40 transition-opacity hover:opacity-100 hover:text-primary group-hover/row:opacity-100 sm:group-hover/row:opacity-80 sm:h-8 sm:w-8"
                          onClick={() => onOpenPdf(invoice)}
                          disabled={busyPdfId === invoiceId(invoice)}
                          title="PDF"
                        >
                          <FileDown size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-7 w-7 transition-all group-hover/row:opacity-80 sm:h-8 sm:w-8",
                            isInvoiceEditable(invoice)
                              ? "opacity-40 text-warning hover:bg-warning-soft hover:opacity-100"
                              : "cursor-not-allowed opacity-20 text-muted",
                          )}
                          onClick={() => onRequestAdjustment(invoice)}
                          title={
                            !isInvoiceEditable(invoice)
                              ? "انتهت فترة التعديل"
                              : "طلب تعديل"
                          }
                        >
                          <ShieldCheck size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
