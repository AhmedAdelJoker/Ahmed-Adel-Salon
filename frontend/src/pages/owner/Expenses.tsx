import { useRef, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Wallet,
  RefreshCw,
  Save,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import { useTranslation } from "react-i18next";
import {
  useExpensesData,
  ExpensesHero,
  ExpensesSummaryCards,
  ExpensesToolbar,
  ExpenseLedger,
  ExpenseFormSections,
  ExpenseDetailsPanel,
} from "@/features/expenses";

const ExpensesPage = () => {
  const { t, i18n } = useTranslation("owner");
  const paginationLocale = (i18n.resolvedLanguage || i18n.language || "ar").toLowerCase().startsWith("en") ? "en" : "ar";
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = ["OWNER", "ADMIN"].includes(String(user?.role || "").toUpperCase());
  const ledgerRef = useRef<HTMLDivElement | null>(null);

  const {
    loading,
    currentPage,
    setCurrentPage,
    totalPages,
    expenseRows,
    categoryData,
    paymentData,
    trend,
    totalAmount,
    pendingTotal,
    pendingCount,
    hasActiveFilters,
    totalCount,
    summary,
    isModalOpen,
    setIsModalOpen,
    isEditing,
    isSubmitting,
    deleteId,
    setDeleteId,
    uploading,
    viewItem,
    isViewOpen,
    setIsViewOpen,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    paymentFilter,
    setPaymentFilter,
    statusFilter,
    setStatusFilter,
    sort,
    setSort,
    quickRange,
    onQuickRange,
    formData,
    setFormData,
    invoiceInputRef,
    fetchData,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleView,
    handleApprove,
    handleReject,
    duplicateExpense,
    handleInvoiceUpload,
    resetForm,
    exportToCSV,
  } = useExpensesData(isOwner);

  const [rejectId, setRejectId] = useState<number | string | null>(null);
  const [exporting, setExporting] = useState(false);

  const clearAllFilters = () => {
    setCategoryFilter("all");
    setPaymentFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
    onQuickRange("all");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToCSV();
    } finally {
      setExporting(false);
    }
  };

  const handleReviewPending = () => {
    setStatusFilter("pending_audit");
    setCurrentPage(1);
    ledgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="erp-page space-y-5 pb-10">
      <ExpensesHero
        summary={summary}
        pendingCount={pendingCount}
        pendingTotal={pendingTotal}
        exporting={exporting}
        onAdd={() => { resetForm(); setIsModalOpen(true); }}
        onExport={handleExport}
        onArchive={() => navigate("/expenses/archive")}
        onRefresh={fetchData}
      />

      <ExpensesSummaryCards
        summary={summary}
        hasActiveFilters={hasActiveFilters}
        categoryData={categoryData}
        paymentData={paymentData}
        trend={trend}
        onSystemLinkClick={(href) => navigate(href)}
        onReviewPending={handleReviewPending}
      />

      <div ref={ledgerRef} id="expenses-ledger" className="scroll-mt-24 space-y-4">
        <ExpensesToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          sort={sort}
          setSort={setSort}
          setCurrentPage={setCurrentPage}
          hasActiveFilters={hasActiveFilters}
          quickRange={quickRange}
          onQuickRange={onQuickRange}
          totalCount={totalCount}
          totalAmount={totalAmount}
          expenseRowsCount={expenseRows.length}
          onRefresh={fetchData}
        />

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <PremiumCard key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-soft animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-soft animate-pulse" />
                    <div className="h-2 w-1/5 rounded bg-soft animate-pulse" />
                  </div>
                  <div className="h-6 w-28 rounded-xl bg-soft animate-pulse" />
                </div>
              </PremiumCard>
            ))}
          </div>
        ) : expenseRows.length === 0 ? (
          <EmptyState
            variant="section"
            icon={FileText}
            title={t("expenses.emptyTitle")}
            message={t("expenses.emptyMessage")}
            action={
              <div className="flex gap-2 mt-2">
                <Button
                  onClick={() => { resetForm(); setIsModalOpen(true); }}
                  className="h-11 rounded-xl px-6 font-black"
                >
                  <Plus size={14} className="ms-1.5" /> {t("expenses.addExpenseBtn")}
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="h-11 rounded-xl"
                  >
                    {t("expenses.clearFilters")}
                  </Button>
                )}
              </div>
            }
          />
        ) : (
          <ExpenseLedger
            rows={expenseRows}
            isOwner={isOwner}
            onView={handleView}
            onEdit={handleEdit}
            onDuplicate={duplicateExpense}
            onApprove={(id) => handleApprove(id)}
            onReject={(id) => setRejectId(id)}
            onDelete={(id) => setDeleteId(id)}
          />
        )}

        {totalPages > 1 && (() => {
          const paginator = createPaginationState({
            page: currentPage,
            size: totalCount > 0 ? Math.ceil(totalCount / totalPages) : 25,
            total: totalCount,
          });
          return (
            <PremiumCard className="p-3">
              <Pagination
                paginator={paginator}
                onPageChange={(p) => setCurrentPage(p)}
                showSizeChanger={false}
                locale={paginationLocale}
              />
              <p className="mt-1 text-center text-[10px] font-bold text-muted">
                {t("expenses.pageOf", { page: currentPage, total: totalPages, count: totalCount })}
              </p>
            </PremiumCard>
          );
        })()}
      </div>

      {/* View panel */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg rounded-[2rem] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.35)]">
          <ExpenseDetailsPanel
            viewItem={viewItem}
            isOwner={isOwner}
            onClose={() => setIsViewOpen(false)}
            onEdit={handleEdit}
            onNavigate={(href) => navigate(href)}
          />
        </DialogContent>
      </Dialog>

      {/* Add / edit modal — deep header with gold accent, sections numbered */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="max-w-lg rounded-[1.75rem] p-0 overflow-hidden border-border bg-card shadow-premium" aria-describedby="expense-dialog-desc">
          <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-gradient-to-br from-soft/60 to-card">
            <DialogTitle className="text-base font-black text-main flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-amber-300"><Wallet size={17} /></span>
              {isEditing ? (isOwner ? t("expenses.editExpense") : t("expenses.viewExpense")) : t("expenses.addExpenseModal")}
            </DialogTitle>
            <DialogDescription id="expense-dialog-desc" className="sr-only">{t("expenses.formDesc")}</DialogDescription>
            {!isOwner && isEditing && <Badge className="mt-2 bg-amber-500 text-white rounded-full w-fit">{t("expenses.readOnly")}</Badge>}
          </DialogHeader>
          <div className="p-6 space-y-5 max-h-[62vh] overflow-y-auto">
            <ExpenseFormSections
              formData={formData}
              setFormData={setFormData}
              isEditing={isEditing}
              isOwner={isOwner}
              uploading={uploading}
              invoiceInputRef={invoiceInputRef}
              onInvoiceUpload={handleInvoiceUpload}
            />
          </div>
          <DialogFooter className="p-5 pt-4 border-t border-border bg-soft/40 gap-2 flex-row">
            <Button variant="outline" onClick={() => { resetForm(); setIsModalOpen(false); }} className="h-11 flex-1 rounded-xl font-black">{t("expenses.cancel")}</Button>
            {(!isEditing || isOwner) && (
              <Button onClick={handleSubmit} disabled={isSubmitting || uploading} className="h-11 flex-1 rounded-xl bg-zinc-950 text-amber-200 font-black hover:bg-zinc-800">
                {isSubmitting ? <RefreshCw size={14} className="ms-1.5 animate-spin" /> : <Save size={14} className="ms-1.5" />} {isEditing ? t("expenses.saveEdit") : t("expenses.add")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)} title={t("expenses.deleteTitle")} description={t("expenses.deleteDesc")} onConfirm={handleDelete} confirmText={t("expenses.tryDelete")} cancelText={t("expenses.close")} variant="danger" />
      <ConfirmDialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)} title={t("expenses.rejectTitle")} description={t("expenses.rejectDesc")} onConfirm={() => { if (rejectId != null) handleReject(rejectId); setRejectId(null); }} confirmText={t("expenses.rejectConfirm")} cancelText={t("expenses.close")} variant="danger" />
    </div>
  );
};

export default ExpensesPage;
