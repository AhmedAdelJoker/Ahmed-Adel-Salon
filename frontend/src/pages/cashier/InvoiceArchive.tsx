import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  Printer,
  Receipt,
  Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSalon } from "@/context/SalonContext";
import { printThermalReceipt } from "@/lib/print/receipt";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PremiumUI";
import { PageShell } from "@/components/shared/PageShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import InlineNotice from "@/components/shared/InlineNotice";
import { InvoiceDetailsDialog } from "@/features/invoices";
import {
  ArchiveInsights,
  ArchiveSummaryCards,
  ArchiveToolbar,
  CloseReopenDialogs,
  DeleteDraftDialog,
  MonthArchiveRow,
  useInvoiceArchive,
} from "@/features/invoice-archive";

function InvoiceArchive() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSalon();
  const {
    months,
    loading,
    error,
    refresh,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    expandedKey,
    monthInvoices,
    monthDrafts,
    draftsLoading,
    busyDraftId,
    confirmDeleteDraft,
    setConfirmDeleteDraft,
    invoicesLoading,
    loadingMoreKey,
    confirmClose,
    setConfirmClose,
    confirmReopen,
    setConfirmReopen,
    closingMonth,
    reopeningMonth,
    toggleExpand,
    loadMoreInvoices,
    handleReopenMonth,
    handleCloseMonth,
    handleFinalizeDraft,
    handleDeleteDraft,
    summary,
    comparison,
    filteredMonths,
    handleExportPDF,
    daysInMonth,
    selectedInvoice,
    setSelectedInvoice,
    openInvoicePdf,
  } = useInvoiceArchive();

  const canManageArchive = ["OWNER", "ADMIN", "MANAGER"].includes(
    String(user?.role ?? "").toUpperCase(),
  );

  return (
    <PageShell contained>
      <PageHeader
        title="أرشيف الفواتير"
        subtitle={
          <span className="hidden sm:inline">
            دفتر الأشهر المنتهية — راجع الفواتير، اقفل الشهر، أو أعد فتحه
            للمراجعة
          </span>
        }
        badge="الأرشيف المالي"
        icon={Archive}
        className="mb-4 sm:mb-6"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl px-3"
              onClick={() => navigate("/invoices")}
            >
              <Receipt size={15} className="ms-1.5" />
              الفواتير الحالية
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl px-3"
              onClick={handleExportPDF}
              disabled={loading || filteredMonths.length === 0}
            >
              <Printer size={15} className="ms-1.5" />
              طباعة / PDF
            </Button>
          </div>
        }
      />

      <ArchiveSummaryCards
        loading={loading}
        summary={summary}
        months={months}
        comparison={comparison}
      />

      <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0">
          <ArchiveToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onRefresh={() => refresh()}
            refreshing={loading}
            resultCount={filteredMonths.length}
            totalCount={months.length}
          />

          {error && months.length > 0 && (
            <div className="mt-2">
              <InlineNotice tone="warning">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => refresh()}
                  className="ms-2 font-black underline"
                >
                  إعادة المحاولة
                </button>
              </InlineNotice>
            </div>
          )}

          <div className="mt-3">
            {loading && months.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-28 animate-pulse rounded-3xl border border-border/70 bg-card"
                  />
                ))}
              </div>
            ) : error && months.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-danger/20 bg-danger-soft/40 px-5 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
                  <AlertTriangle size={22} />
                </div>
                <p className="mt-3 text-sm font-black text-main">
                  تعذر تحميل الأرشيف
                </p>
                <p className="mt-1 max-w-sm text-[11px] font-bold text-muted">
                  {error}
                </p>
                <Button
                  className="mt-4 h-10 rounded-xl px-5"
                  onClick={() => refresh()}
                >
                  إعادة المحاولة
                </Button>
              </div>
            ) : months.length === 0 ? (
              <EmptyState
                variant="page"
                icon={Archive}
                title="لا توجد أشهر مؤرشفة بعد"
                message="ستنتقل الفواتير تلقائيًا إلى الأرشيف بعد انتهاء الشهر."
                action={
                  <Button
                    onClick={() => navigate("/invoices")}
                    className="h-11 rounded-xl px-6"
                  >
                    عرض فواتير الشهر الحالي
                  </Button>
                }
              />
            ) : filteredMonths.length === 0 ? (
              <EmptyState
                variant="page"
                icon={Search}
                title="لا نتائج مطابقة"
                message="جرّب تعديل كلمة البحث أو فلتر الحالة."
              />
            ) : (
              <div className="space-y-3">
                {filteredMonths.map((month, index) => (
                  <MonthArchiveRow
                    key={month.key}
                    month={month}
                    index={index}
                    isExpanded={expandedKey === month.key}
                    monthData={monthInvoices[month.key]}
                    drafts={monthDrafts[month.key] || []}
                    draftsLoading={draftsLoading}
                    busyDraftId={busyDraftId}
                    invoicesLoading={invoicesLoading}
                    loadingMoreKey={loadingMoreKey}
                    closingMonth={closingMonth}
                    reopeningMonth={reopeningMonth}
                    canManage={canManageArchive}
                    onToggleExpand={toggleExpand}
                    onLoadMore={loadMoreInvoices}
                    onConfirmClose={setConfirmClose}
                    onConfirmReopen={setConfirmReopen}
                    onSelectInvoice={setSelectedInvoice}
                    onFinalizeDraft={handleFinalizeDraft}
                    onDeleteDraft={(monthKey, draft) =>
                      setConfirmDeleteDraft({ monthKey, draft })
                    }
                    onOpenLedger={(monthKey) => navigate(`/invoices?month=${monthKey}`)}
                    daysInMonth={daysInMonth}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-4">
            <ArchiveInsights summary={summary} comparison={comparison} />
          </div>
        </div>
      </div>

      <InvoiceDetailsDialog
        selectedInvoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onPrintSelected={() => {
          if (selectedInvoice) {
            printThermalReceipt(selectedInvoice, settings);
          }
        }}
        onOpenPdfSelected={() => {
          if (selectedInvoice) {
            openInvoicePdf(selectedInvoice);
          }
        }}
      />

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

      <DeleteDraftDialog
        draft={confirmDeleteDraft?.draft ?? null}
        busy={busyDraftId === confirmDeleteDraft?.draft?.id}
        onCancel={() => setConfirmDeleteDraft(null)}
        onConfirm={() => {
          if (confirmDeleteDraft) {
            handleDeleteDraft(confirmDeleteDraft.monthKey, confirmDeleteDraft.draft);
          }
        }}
      />
    </PageShell>
  );
}

export default function InvoiceArchiveSafe() {
  return (
    <ErrorBoundary>
      <InvoiceArchive />
    </ErrorBoundary>
  );
}
