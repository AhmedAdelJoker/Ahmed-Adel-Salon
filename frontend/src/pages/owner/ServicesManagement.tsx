import React, { useState } from "react";


import {
  Zap,
} from "lucide-react";






import { ConfirmDialog } from "@/components/shared/ConfirmDialog";


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
  const loading = servicesLoading || categoriesLoading || offersLoading;

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Zap className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">
            جاري مزامنة لائحة الخدمات...
          </p>
        </div>
      </div>
    );

  return (
    <div className={`erp-page space-y-8 pb-12`} dir="rtl">
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
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        refreshing={refreshing}
        onRefresh={() => refreshAllData()}
        onCreate={openCreateDialog}
      />

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
