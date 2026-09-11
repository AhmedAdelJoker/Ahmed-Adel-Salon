import { useAuth } from "@/context/AuthContext";
import React from "react";
import { useNavigate } from "react-router-dom";





import { Card } from "@/components/ui";


import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
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
import SkeletonCard from "@/components/shared/SkeletonCard";
import { SkeletonBlock } from "@/components/shared/SkeletonBlock";

const EMPTY_CUSTOMER_FORM = {
  name: "",
  phone: "",
  phone2: "",
};
const pageSize = 10;

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
    totalCount,
    totalPages,
    duplicateGroups,
    filteredCustomers,
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


  function getInitials(name) {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

  function customerName(customer) {
    return (
      `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
      customer?.name ||
      "عميل"
    );
  }

  function secondPhone(customer) {
    return (
      customer?.phone2 ||
      customer?.alternate_phone ||
      customer?.secondary_phone ||
      null
    );
  }











  if (loading && customers.length === 0) {
    return (
      <div className="erp-page-container space-y-6 pb-6 sm:space-y-8" dir="rtl">
        <div className="page-header">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-gray-50 sm:text-4xl">
              سجل العملاء
            </h1>
            <p className="page-subtitle mt-2">
              إدارة قاعدة البيانات وبناء علاقات ولاء مستدامة
            </p>
          </div>
        </div>

        {/* Skeleton KPIs */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Skeleton Table */}
        <Card className="border-border p-4 shadow-sm">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <SkeletonBlock className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-1/4" />
                  <SkeletonBlock className="h-3 w-1/3" />
                </div>
                <SkeletonBlock className="h-6 w-20 shrink-0" />
                <SkeletonBlock className="h-6 w-24 shrink-0" />
                <SkeletonBlock className="h-8 w-24 shrink-0" />
              </div>
            ))}
          </div>
        </Card>

        {/* Skeleton Pagination */}
        <div className="flex flex-col gap-3 border-t border-black/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10">
          <SkeletonBlock className="h-4 w-32" />
          <div className="flex items-center justify-center gap-3 sm:justify-end">
            <SkeletonBlock className="h-8 w-8 rounded-xl" />
            <SkeletonBlock className="h-8 w-16 rounded-xl" />
            <SkeletonBlock className="h-8 w-8 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-6 pb-6 sm:space-y-8" dir="rtl">
      <CustomerHeader
        loading={loading}
        isManagerOrOwner={isManagerOrOwner}
        onExport={handleExport}
        onArchive={() => navigate("/owner/customers/archive")}
        onCreate={openCreateCustomer}
        onImported={fetchCustomers}
      />

      <CustomerKpis totalCount={totalCount} customers={customers} />

      <DuplicatesAlert groups={duplicateGroups} />

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
            rows={filteredCustomers}
            loading={loading}
            isOwner={isOwner}
            onOpenDetails={openDetails}
            onNavigate={(id) => navigate(`/customers/${id}`)}
            onDelete={(customer) => setDeleteTarget(customer)}
          />
        )}

        {/* Card View */}
        {viewMode === "cards" && (
          <CustomerCards
            rows={filteredCustomers}
            isOwner={isOwner}
            onOpenDetails={openDetails}
            onDelete={(customer) => setDeleteTarget(customer)}
          />
        )}
      {totalPages > 1 ? (
        <CustomerPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          filteredCount={filteredCustomers.length}
          onPage={setCurrentPage}
        />
      ) : null}
      </Card>

      <CustomerDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        customer={selectedCustomer}
        loading={loading}
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

function Kpi({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="p-6 border-border border-border shadow-sm hover:shadow-xl transition-all duration-500 group">
      <div className="flex items-center gap-5">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110 ${color}`}
        >
          <Icon size={24} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-2xl font-black text-main text-main">
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon }: any) {
  return (
    <div className="rounded-2xl border border-border bg-soft p-4 border-border bg-soft">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className="text-indigo-600 dark:text-sky-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </span>
      </div>
      <div className="truncate text-sm font-black text-main text-main">
        {value}
      </div>
    </div>
  );
}
