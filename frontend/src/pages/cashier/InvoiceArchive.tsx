import { motion } from "framer-motion";
import {
  Archive,
  Receipt,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PremiumUI";
import { AnimatePresence } from "framer-motion";
import {
  useInvoiceArchive,
  ArchiveSummaryCards,
  ArchiveToolbar,
  MonthArchiveRow,
  CloseReopenDialogs,
} from "@/features/invoice-archive";

function InvoiceArchive() {
  const navigate = useNavigate();
  const {
    months,
    loading,
    closingMonth,
    confirmClose,
    setConfirmClose,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    expandedKey,
    monthInvoices,
    invoicesLoading,
    loadingMoreKey,
    confirmReopen,
    setConfirmReopen,
    reopeningMonth,
    toggleExpand,
    loadMoreInvoices,
    handleReopenMonth,
    summary,
    maxRevenue,
    comparison,
    filteredMonths,
    handleExportPDF,
    handleCloseMonth,
    daysInMonth,
    PAYMENT_LABELS,
    fmtTime,
  } = useInvoiceArchive();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
        <PageHeader className={undefined}
          title="الأرشيف الشهري للفواتير"
          subtitle="استعرض وأغلق فواتير الأشهر المنتهية أو أعدها للمراجعة — كل الفلاتر والإجراءات من هنا"
          badge="الأرشيف المالي"
          icon={Archive}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-xl px-4"
                onClick={() => navigate("/invoices")}
              >
                <Receipt size={16} className="ml-2" /> الفواتير الحالية
              </Button>
              <Button
                onClick={handleExportPDF}
                className="h-10 rounded-xl bg-emerald-600 px-4 hover:bg-emerald-700"
              >
                <DownloadIcon /> تصدير PDF
              </Button>
            </div>
          }
        />

        <ArchiveSummaryCards
          loading={loading}
          summary={summary}
          months={months}
          maxRevenue={maxRevenue}
          comparison={comparison}
          expandedKey={expandedKey}
          onToggleExpand={toggleExpand}
        />

        {months.length > 0 && (
          <ArchiveToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl bg-card border border-border/70 p-5"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-12 w-12 rounded-xl bg-soft animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-2/3 rounded bg-soft animate-pulse" />
                    <div className="h-2 w-1/3 rounded bg-soft animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="h-16 rounded-xl bg-soft animate-pulse" />
                  <div className="h-16 rounded-xl bg-soft animate-pulse" />
                </div>
                <div className="h-9 w-full rounded-lg bg-soft animate-pulse" />
              </div>
            ))}
          </div>
        ) : months.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-24 text-center"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-soft">
              <Archive size={40} className="text-muted" />
            </div>
            <h3 className="mb-2 text-xl font-black text-main">
              لا توجد أشهر مؤرشفة بعد
            </h3>
            <p className="mb-6 text-sm font-bold text-muted">
              ستنتقل الفواتير تلقائيًا إلى الأرشيف بعد انتهاء الشهر.
            </p>
            <Button
              onClick={() => navigate("/invoices")}
              className="h-11 rounded-xl px-6"
            >
              عرض فواتير الشهر الحالي
            </Button>
          </motion.div>
        ) : filteredMonths.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
            <Search size={32} className="mb-3 text-muted" />
            <h3 className="mb-1 text-lg font-black text-main">
              لا نتائج مطابقة
            </h3>
            <p className="text-sm font-bold text-muted">
              جرّب تعديل البحث أو الفلتر.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredMonths.map((month, idx) => (
                <MonthArchiveRow
                  key={month.key}
                  month={month}
                  index={idx}
                  isExpanded={expandedKey === month.key}
                  monthData={monthInvoices[month.key]}
                  invoicesLoading={invoicesLoading}
                  loadingMoreKey={loadingMoreKey}
                  closingMonth={closingMonth}
                  reopeningMonth={reopeningMonth}
                  paymentLabels={PAYMENT_LABELS}
                  onToggleExpand={toggleExpand}
                  onLoadMore={loadMoreInvoices}
                  onConfirmClose={setConfirmClose}
                  onConfirmReopen={setConfirmReopen}
                  daysInMonth={daysInMonth}
                  formatTime={fmtTime}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CloseReopenDialogs
        confirmClose={confirmClose}
        confirmReopen={confirmReopen}
        closingMonth={closingMonth}
        reopeningMonth={reopeningMonth}
        onCancelClose={() => setConfirmClose(null)}
        onCancelReopen={() => setConfirmReopen(null)}
        onConfirmClose={handleCloseMonth}
        onConfirmReopen={handleReopenMonth}
      />
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

export default function InvoiceArchiveSafe() {
  return (
    <ErrorBoundary>
      <InvoiceArchive />
    </ErrorBoundary>
  );
}
