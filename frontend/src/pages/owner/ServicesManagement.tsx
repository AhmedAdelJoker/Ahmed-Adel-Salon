import React, { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SkeletonCard } from "@/components/shared/PremiumUI";


import {
  useCatalogData,
  useCatalogForms,
  CatalogHeader,
  ServicesPanel,
  CategoriesPanel,
  OffersPanel,
  ServiceFormModal,
  CategoryFormModal,
  OfferFormModal,
} from "@/features/catalog";

const ServicesManagement = ({ hideHeader = false }: { hideHeader?: boolean }) => {
  const [activeTab, setActiveTab] = useState("services");
  const [searchTerm, setSearchTerm] = useState("");
  const {
    services,
    categories,
    products,
    servicesLoading,
    categoriesLoading,
    offersLoading,
    refreshing,
    refreshAllData,
    filteredServiceRows,
    filteredCategoryRows,
    filteredOfferRows,
    serviceSummary,
    pricing,
  } = useCatalogData(searchTerm);
  const {
    formData,
    setFormData,
    editingService,
    isModalOpen,
    setIsModalOpen,
    catForm,
    setCatForm,
    editingCat,
    isCatModalOpen,
    setIsCatModalOpen,
    offerForm,
    setOfferForm,
    editingOffer,
    isOfferModalOpen,
    setIsOfferModalOpen,
    deleteTarget,
    setDeleteTarget,
    isActionLoading,
    openCreateDialog,
    handleSubmit,
    startEdit,
    addIngredient,
    removeIngredient,
    updateIngredient,
    handleCatSubmit,
    startCatEdit,
    handleOfferSubmit,
    startOfferEdit,
    toggleOfferService,
    confirmDelete,
  } = useCatalogForms(activeTab, refreshAllData);
  const isInitialLoading = servicesLoading && categoriesLoading && offersLoading;
  const isTabLoading =
    (activeTab === "services" && servicesLoading) ||
    (activeTab === "categories" && categoriesLoading) ||
    (activeTab === "offers" && offersLoading);

  if (isInitialLoading)
    return (
      <div className={hideHeader ? "space-y-6" : "erp-page space-y-8 pb-12"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" height={320} />
      </div>
    );

  return (
    <div className={hideHeader ? "space-y-6" : "erp-page space-y-8 pb-12"}>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.type === "service"
            ? "حذف الخدمة؟"
            : deleteTarget?.type === "category"
              ? "حذف التصنيف؟"
              : "حذف العرض؟"
        }
        description="هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذا الإجراء."
        onConfirm={confirmDelete}
        loading={isActionLoading}
      />

      <CatalogHeader
        hideHeader={hideHeader}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        refreshing={refreshing}
        onRefresh={() => refreshAllData()}
        onCreate={openCreateDialog}
      />

      {isTabLoading ? (
        <SkeletonCard variant="content" height={320} />
      ) : (
        <>
          {/* ====== TAB: SERVICES ====== */}
          {activeTab === "services" && (
            <ServicesPanel
              summary={serviceSummary}
              rows={filteredServiceRows}
              onEdit={startEdit}
              onDelete={(id) => setDeleteTarget({ id, type: "service" })}
              pricing={pricing}
            />
          )}

      {/* ====== TAB: CATEGORIES ====== */}
        {activeTab === "categories" && (
          <CategoriesPanel
            rows={filteredCategoryRows}
            onEdit={startCatEdit}
            onDelete={(id) => setDeleteTarget({ id, type: "category" })}
          />
        )}

        {/* ====== TAB: OFFERS ====== */}
          {activeTab === "offers" && (
            <OffersPanel
              rows={filteredOfferRows}
              onEdit={startOfferEdit}
              onDelete={(id) => setDeleteTarget({ id, type: "offer" })}
            />
          )}
        </>
      )}

      <ServiceFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editing={editingService}
        formData={formData}
        setFormData={setFormData}
        categories={categories}
        products={products}
        isActionLoading={isActionLoading}
        onSubmit={handleSubmit}
        onAddIngredient={addIngredient}
        onRemoveIngredient={removeIngredient}
        onUpdateIngredient={updateIngredient}
      />

      <CategoryFormModal
        open={isCatModalOpen}
        onOpenChange={setIsCatModalOpen}
        editing={editingCat}
        form={catForm}
        setForm={setCatForm}
        isActionLoading={isActionLoading}
        onSubmit={handleCatSubmit}
      />

      <OfferFormModal
        open={isOfferModalOpen}
        onOpenChange={setIsOfferModalOpen}
        editing={editingOffer}
        form={offerForm}
        setForm={setOfferForm}
        services={services}
        isActionLoading={isActionLoading}
        onSubmit={handleOfferSubmit}
        onToggleService={toggleOfferService}
      />
    </div>
  );
};

export default ServicesManagement;
