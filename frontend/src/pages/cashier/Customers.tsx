import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

import { Card } from "@/components/ui";

import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { PageHeader, SkeletonCard } from "@/components/shared/PremiumUI";
import {
  useCustomersList,
  useCustomerDialogs,
  CustomerHeader,
  CustomerKpis,
  DuplicatesAlert,
  CustomerToolbar,
  CustomerTable,
  CustomerCards,
  CustomerPagination,
  CustomerDetailsDialog,
  CustomerFormDialog,
  CustomerDeleteDialog,
} from "@/features/customers";

export default function Customers() {
  return (
    <ErrorBoundary>
      <CustomersInner />
    </ErrorBoundary>
  );
}

function CustomersInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const isManagerOrOwner =
    isOwner || user?.role === "manager" || user?.role === "accountant";
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
    fetchCustomers,
    removeCustomer,
    handleExport,
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
  } = useCustomerDialogs(fetchCustomers, removeCustomer);

  const isFiltering = searchTerm.trim() !== "" || activeFilter !== "الكل";
  const emptyTitle =
    stats.total === 0 ? "لا يوجد عملاء" : "لا توجد نتائج مطابقة";
  const emptyHint =
    stats.total === 0
      ? "أضف أول عميل من زر إضافة عميل"
      : "جرّب كلمة بحث مختلفة أو غيّر الفلتر";

  if (loading && customers.length === 0) {
    return (
      <div className="erp-page-container space-y-6 pb-6 sm:space-y-8">
        <PageHeader
          title="سجل العملاء"
          subtitle="إدارة قاعدة البيانات وبناء علاقات ولاء مستدامة"
        />

        <div data-stats-grid="true">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>

        <SkeletonCard variant="content" />
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-6 pb-6 sm:space-y-8">
      <CustomerHeader
        loading={loading}
        isManagerOrOwner={isManagerOrOwner}
        onExport={handleExport}
        onArchive={() => navigate("/owner/customers/archive")}
        onCreate={openCreateCustomer}
        onImported={fetchCustomers}
      />

      <CustomerKpis stats={stats} />

      <DuplicatesAlert
        groupCount={stats.duplicate_group_count}
        customerCount={stats.duplicate_customer_count}
      />

      <CustomerToolbar
        activeFilter={activeFilter}
        onFilter={setActiveFilter}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        viewMode={viewMode}
        onViewMode={setViewMode}
        loading={loading}
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
    </div>
  );
}
