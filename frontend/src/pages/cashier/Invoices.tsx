import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  FileText,
  Filter,
  RefreshCw,
  ShieldCheck,
  Activity,
  CreditCard,
  Zap,
  Receipt,
  Archive,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSalon } from "@/context/SalonContext";
import { printThermalReceipt } from "@/lib/print/receipt";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import {
  useInvoicesData,
  formatCurrency,
  isInvoiceEditable,
  InvoicesToolbar,
  InvoicesTable,
  InvoicesPagination,
  InvoiceDetailsDialog,
  AdjustmentRequestDialog,
} from "@/features/invoices";


export default function Invoices() {
  const { settings } = useSalon();
  const { user } = useAuth();

  const navigate = useNavigate();
  const {
    invoices,
    adjustments,
    invoicesLoading,
    adjustmentsLoading,
    loading,
    query,
    setQuery,
    paymentFilter,
    setPaymentFilter,
    statusFilter,
    setStatusFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    currentPage,
    setCurrentPage,
    timePreset,
    setTimePreset,
    sortConfig,
    showColumnPicker,
    setShowColumnPicker,
    pageSize,
    totalCount,
    visibleColumns,
    toggleColumn,
    handleSort,
    fetchInvoices,
    filteredInvoices,
    summary,
    exportToCSV,
    adjustmentDialog,
    setAdjustmentDialog,
    adjustmentSubmitting,
    busyPdfId,
    selectedInvoice,
    setSelectedInvoice,
    averageInvoice,
    totalPages,
    pendingAdjustments,
    openInvoicePdf,
    submitAdjustmentRequest,
  } = useInvoicesData();

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5 px-3 pt-4 sm:px-4 lg:px-6 lg:space-y-6">
        <PageHeader className={undefined}
          title="الفواتير"
          subtitle="تتبع المبيعات وإدارة الفواتير والمدفوعات"
          badge="العمليات المالية"
          icon={Receipt}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {["OWNER", "ADMIN", "MANAGER"].includes(user?.role ?? "") && (
                <Button
                  variant="outline"
                  className="h-10 rounded-xl px-3"
                  onClick={() => navigate("/owner/adjustment-requests")}
                >
                  <ShieldCheck size={14} className="ml-1.5" />
                  <span className="hidden sm:inline">طلبات التعديل</span>
                </Button>
              )}
              <Button
                variant="outline"
                className="h-10 rounded-xl px-3"
                onClick={() => navigate("/invoices/archive")}
              >
                <Archive size={14} className="ml-1.5" />
                <span className="hidden sm:inline">الأرشيف</span>
              </Button>
              <Button
                onClick={fetchInvoices}
                disabled={loading}
                className="h-10 rounded-xl px-3"
              >
                <RefreshCw
                  size={14}
                  className={cn("ml-1.5", loading && "animate-spin")}
                />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform group-hover:scale-105 sm:flex">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  إجمالي الفواتير
                </div>
                <div className="text-lg font-black tabular-nums text-main sm:text-xl">
                  {summary.count}
                </div>
              </div>
              <span className="shrink-0 text-[8px] font-black text-muted sm:text-[9px]">
                {filteredInvoices.length}
              </span>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success transition-transform group-hover:scale-105 sm:flex">
                <Zap size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  الصافي النقدي
                </div>
                <div className="truncate text-lg font-black tabular-nums text-main sm:text-xl">
                  {formatCurrency(summary.total)}
                </div>
              </div>
              <span className="hidden shrink-0 rounded-md bg-success-soft px-1.5 py-0.5 text-[8px] font-black text-success sm:inline-block">
                {summary.paid} مدفوعة
              </span>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info transition-transform group-hover:scale-105 sm:flex">
                <CreditCard size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  متوسط الفاتورة
                </div>
                <div className="truncate text-lg font-black tabular-nums text-main sm:text-xl">
                  {formatCurrency(averageInvoice)}
                </div>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning transition-transform group-hover:scale-105 sm:flex">
                <Filter size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  نتائج البحث
                </div>
                <div className="text-lg font-black tabular-nums text-main sm:text-xl">
                  {filteredInvoices.length}
                </div>
              </div>
              {pendingAdjustments > 0 && (
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-[8px] font-black text-danger">
                  <Activity size={8} /> {pendingAdjustments}
                </span>
              )}
            </div>
          </PremiumCard>
        </div>

        <InvoicesToolbar
          query={query}
          setQuery={setQuery}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          timePreset={timePreset}
          setTimePreset={setTimePreset}
          setCurrentPage={setCurrentPage}
          showColumnPicker={showColumnPicker}
          setShowColumnPicker={setShowColumnPicker}
          visibleColumns={visibleColumns}
          toggleColumn={toggleColumn}
          exportToCSV={exportToCSV}
        />

        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <InvoicesTable
            loading={loading}
            filteredInvoices={filteredInvoices}
            visibleColumns={visibleColumns}
            sortConfig={sortConfig}
            handleSort={handleSort}
            busyPdfId={busyPdfId}
            onSelectInvoice={(invoice) => setSelectedInvoice(invoice)}
            onPrintInvoice={(invoice) => printThermalReceipt(invoice, settings)}
            onOpenPdf={(invoice) => openInvoicePdf(invoice)}
            onRequestAdjustment={(invoice) => {
              if (!isInvoiceEditable(invoice)) {
                toast.error("انتهت فترة التعديل (ساعة)");
                return;
              }
              setAdjustmentDialog({
                ...adjustmentDialog,
                open: true,
                invoice,
              });
            }}
            onResetFilters={() => {
              setQuery("");
              setPaymentFilter("all");
              setStatusFilter("all");
              setTimePreset("month");
            }}
          />

          {!loading && filteredInvoices.length > 0 && (
            <InvoicesPagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              filteredCount={filteredInvoices.length}
              invoicesCount={invoices.length}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </div>

        <InvoiceDetailsDialog
          selectedInvoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPrintSelected={() => printThermalReceipt(selectedInvoice, settings)}
        />

        <AdjustmentRequestDialog
          adjustmentDialog={adjustmentDialog}
          onAdjustmentDialogChange={setAdjustmentDialog}
          adjustmentSubmitting={adjustmentSubmitting}
          onSubmit={submitAdjustmentRequest}
        />
      </div>
    </div>
  );
}
