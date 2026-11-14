import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui";
import InlineNotice from "@/components/shared/InlineNotice";

import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { PageShell } from "@/components/shared/PageShell";
import { PageHeader } from "@/components/shared/PremiumUI";
import { LoadingState } from "@/components/shared";
import {
  useCustomersList,
  useCustomerDialogs,
  CustomerHeader,
  CustomerKpis,
  DuplicatesAlert,
  MergeCustomersDialog,
  CustomerToolbar,
  CustomerTable,
  CustomerCards,
  CustomerPagination,
  CustomerDetailsDialog,
  CustomerFormDialog,
  CustomerDeleteDialog,
} from "@/features/customers";
import { customerId } from "@/features/customers/utils/customer";

export default function Customers() {
  return (
    <ErrorBoundary>
      <CustomersInner />
    </ErrorBoundary>
  );
}

function CustomersInner() {
  const { t } = useTranslation("customers");
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const isManagerOrOwner =
    isOwner || user?.role === "manager" || user?.role === "accountant";
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const {
    searchTerm,
    setSearchTerm,
    activeFilter,
    setActiveFilter,
    viewMode,
    setViewMode,
    customers,
    loading,
    currentPage,
    setCurrentPage,
    totalPages,
    stats,
    refreshAll,
    removeCustomer,
    handleExport,
    statsError,
  } = useCustomersList();
  const {
    selectedCustomer,
    isDetailsOpen,
    setIsDetailsOpen,
    setIsCustomerFormOpen,
    deleteTarget,
    setDeleteTarget,
    isCustomerFormOpen,
    isSavingCustomer,
    editingCustomer,
    customerForm,
    setCustomerForm,
    openDetails,
    closeCustomerForm,
    openCreateCustomer,
    openEditCustomer,
    handleCustomerFormSubmit,
    handleDelete,
  } = useCustomerDialogs(refreshAll, removeCustomer);

  const isFiltering = searchTerm.trim() !== "" || activeFilter !== "الكل";

  const toggleSelect = (id: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => customerId(c)).filter(Boolean)));
    }
  };
  const isAllSelected = customers.length > 0 && selectedIds.size === customers.length;
  const isSomeSelected = selectedIds.size > 0;

  const handleBulkDelete = () => {
    if (!window.confirm(t("bulk.deleteConfirm", { count: selectedIds.size }))) return;
    selectedIds.forEach((id) => removeCustomer(id));
    setSelectedIds(new Set());
  };

  const emptyTitle =
    stats.total === 0 ? t("empty.noCustomers") : t("empty.noResults");
  const emptyHint =
    stats.total === 0
      ? t("empty.noCustomersHint")
      : t("empty.noResultsHint");

  if (loading && customers.length === 0) {
    return (
      <PageShell>
        <PageHeader
          title={t("page.title")}
          subtitle={t("page.subtitle")}
        />
        <LoadingState variant="page" label={t("page.loading")} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <CustomerHeader
        isManagerOrOwner={isManagerOrOwner}
        onExport={handleExport}
        onArchive={() => navigate("/owner/customers/archive")}
        onCreate={openCreateCustomer}
        onImported={refreshAll}
      />

        {isSomeSelected && (
          <div className="p-4 bg-soft border border-border/40 rounded-xl flex items-center justify-between">
            <span className="font-bold text-main">
              {t("bulk.selected", { count: selectedIds.size })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="h-8 text-xs"
              >
                {isAllSelected ? t("bulk.selectNone") : t("bulk.selectAll")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDelete}
                className="h-8 text-xs"
                aria-label={t("bulk.deleteSelected")}
              >
                {t("bulk.delete")}
              </Button>
            </div>
          </div>
        )}
        {statsError && !loading && (
          <InlineNotice tone="warning">{statsError}</InlineNotice>
        )}

      <CustomerKpis stats={stats} />

      <DuplicatesAlert
        groupCount={stats.duplicate_group_count}
        customerCount={stats.duplicate_customer_count}
        onMerge={() => setIsMergeOpen(true)}
      />

      <CustomerToolbar
        activeFilter={activeFilter}
        onFilter={setActiveFilter}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        viewMode={viewMode}
        onViewMode={setViewMode}
        loading={loading}
        counts={{
          total: stats.total,
          vip_count: stats.vip_count,
          regular_count: stats.regular_count,
          new_count: stats.new_count,
        }}
      />

      <Card className="overflow-hidden border-none bg-transparent shadow-none lg:border lg:bg-card lg:shadow-sm">
        {/* Table View */}
        {viewMode === "table" && (
          <CustomerTable
            rows={customers}
            loading={loading}
            isOwner={isOwner}
            onOpenDetails={openDetails}
            onNavigate={(id) => navigate(`/customers/${id}`)}
            onDelete={(customer) => setDeleteTarget(customer)}
            emptyTitle={emptyTitle}
            emptyHint={emptyHint}
            showClearFilter={isFiltering}
            onClearFilter={() => {
              setSearchTerm("");
              setActiveFilter("الكل");
            }}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            onSelectAll={toggleSelectAll}
            isAllSelected={isAllSelected}
          />
        )}

        {/* Card View */}
        {viewMode === "cards" && (
          <CustomerCards
            rows={customers}
            isOwner={isOwner}
            onOpenDetails={openDetails}
            onDelete={(customer) => setDeleteTarget(customer)}
            emptyTitle={emptyTitle}
            emptyHint={emptyHint}
            showClearFilter={isFiltering}
            onClearFilter={() => {
              setSearchTerm("");
              setActiveFilter("الكل");
            }}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
          />
        )}
        {totalPages > 1 ? (
          <CustomerPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={stats.total}
            filteredCount={customers.length}
            onPage={setCurrentPage}
          />
        ) : null}
      </Card>

      <CustomerDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        customer={selectedCustomer}
        loading={false}
        onEdit={() => selectedCustomer && openEditCustomer(selectedCustomer)}
        onClose={() => setIsDetailsOpen(false)}
      />

      <CustomerFormDialog
        open={isCustomerFormOpen}
        onOpenChange={setIsCustomerFormOpen}
        editing={editingCustomer}
        form={customerForm}
        setForm={setCustomerForm}
        loading={loading}
        isSaving={isSavingCustomer}
        onSubmit={handleCustomerFormSubmit}
        onClose={closeCustomerForm}
      />

      <CustomerDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        customer={deleteTarget}
        loading={loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <MergeCustomersDialog
        open={isMergeOpen}
        onOpenChange={setIsMergeOpen}
        onMerged={refreshAll}
      />
    </PageShell>
  );
}
