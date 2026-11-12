import {
  AlertTriangle,
  Archive,
  ArrowDownUp,
  Box,
  Database,
  Eye,
  FileDown,
  Gift,
  History,
  Package,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/PageShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrency, formatNumber, cn } from "@/lib/core/utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useInventoryData } from "@/features/inventory/hooks/useInventoryData";
import { useInventoryForm } from "@/features/inventory/hooks/useInventoryForm";
import {
  formatQuantity,
  getAvailablePacks,
  ProductFormModal,
  StockSupplyModal,
  HistoryModal,
  ProductDetailsModal,
} from "@/features/inventory";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { useState } from "react";

export default function Inventory() {
  const { t } = useTranslation("owner");
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const isManagement = ["owner", "admin", "manager"].includes(role);

  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const {
    loading,
    stats,
    uniqueCategories,
    filteredProducts,
    getCategoryTone,
    handleExport,
    fetchData,
    staticBaseUrl,
    page,
    setPage,
    total,
    totalPages,
  } = useInventoryData(searchTerm, activeTab, showLowStockOnly);

  const form = useInventoryForm({
    fetchProducts: async () => {
      await fetchData();
    },
    isManagement,
  });

  const {
    saving,
    isModalOpen,
    setIsModalOpen,
    isStockModalOpen,
    setIsStockModalOpen,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    editingProduct,
    formData,
    setFormData,
    stockFormData,
    setStockFormData,
    historyLogs,
    historyLoading,
    uploading,
    imagePreview,
    setImagePreview,
    viewProduct,
    isViewOpen,
    setIsViewOpen,
    showPriceAlert,
    newSellPrice,
    setNewSellPrice,
    selectedUnit,
    stockUnit,
    fileInputRef,
    openCreate,
    openEdit,
    openStockModal,
    openView,
    openHistory,
    handleImageUpload,
    handleSave,
    handleAddStock,
    handleUpdateSellPrice,
  } = form;

  if (loading && filteredProducts.length === 0) {
    return (
      <PageShell className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Package className="animate-pulse text-primary" size={36} />
          <p className="text-sm font-bold text-muted">{t("inventory.loading")}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="gap-4 sm:gap-6">
      <PageHeader
        title={t("inventory.title")}
        subtitle={t("inventory.subtitle")}
        badge={t("inventory.badge")}
        icon={Database}
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-2 px-3 text-xs sm:flex-none"
              onClick={() => void fetchData()}
            >
              <RefreshCw size={14} /> {t("inventory.refresh")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-2 px-3 text-xs sm:flex-none"
              onClick={() => navigate("/inventory/bundles")}
            >
              <Gift size={14} /> <span className="hidden sm:inline">{t("inventory.bundles")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-2 px-3 text-xs sm:flex-none"
              onClick={() => navigate("/inventory/archive")}
            >
              <History size={14} /> <span className="hidden sm:inline">{t("inventory.archive")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-2 px-3 text-xs sm:flex-none"
              onClick={() => handleExport("excel")}
              title={t("inventory.exportProducts")}
            >
              <FileDown size={14} /> <span className="hidden sm:inline">{t("inventory.export")}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="h-10 flex-[2] rounded-xl px-4 text-xs sm:flex-none"
              onClick={openCreate}
            >
              <Plus size={14} className="me-1.5" /> {t("inventory.addProduct")}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PremiumCard className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10">
              <Package size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{t("inventory.totalValue")}</p>
              <p className="truncate text-base font-black text-main sm:text-lg">{formatCurrency(stats.value)}</p>
            </div>
          </div>
        </PremiumCard>
        <PremiumCard className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning sm:h-10 sm:w-10">
              <ArrowDownUp size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{t("inventory.stockCost")}</p>
              <p className="truncate text-base font-black text-main sm:text-lg">{formatCurrency(stats.cost)}</p>
            </div>
          </div>
        </PremiumCard>
        <PremiumCard className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10", stats.lowStock > 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
              <AlertTriangle size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{t("inventory.lowStock")}</p>
              <p className={cn("text-base font-black sm:text-lg", stats.lowStock > 0 ? "text-danger" : "text-success")}>{formatNumber(stats.lowStock)}</p>
            </div>
          </div>
        </PremiumCard>
        <PremiumCard className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info sm:h-10 sm:w-10">
              <Box size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{t("inventory.totalItems")}</p>
              <p className="text-base font-black text-main sm:text-lg">{formatNumber(stats.active)}</p>
            </div>
          </div>
        </PremiumCard>
      </div>

      {stats.lowStock > 0 && (
        <button
          type="button"
          onClick={() => setShowLowStockOnly((v) => !v)}
          aria-pressed={showLowStockOnly}
          className="flex items-center gap-3 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm transition-colors hover:bg-danger/10"
        >
          <AlertTriangle size={16} className="shrink-0 text-danger" />
          <p className="font-bold text-danger">{t("inventory.lowStockAlert", { count: stats.lowStock })}</p>
          <span className="ms-auto rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-[10px] font-black text-danger">
            {showLowStockOnly ? t("inventory.showAllProducts") : t("inventory.showLowStockOnly")}
          </span>
        </button>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "active" | "archived"); setShowLowStockOnly(false); }} className="w-full lg:w-auto">
          <TabsList className="h-11 w-full rounded-2xl bg-soft/60 p-1 sm:w-auto">
            <TabsTrigger value="active" className="h-9 flex-1 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm sm:flex-none">
              {t("inventory.activeTab")} ({formatNumber(stats.active)})
            </TabsTrigger>
            <TabsTrigger value="archived" className="h-9 flex-1 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm sm:flex-none">
              <Archive size={13} className="me-1.5" /> {t("inventory.archivedTab")} ({formatNumber(stats.archived)})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("inventory.searchPlaceholder")}
            className="h-11 rounded-2xl border-border bg-card ps-10 pe-10 text-sm font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-soft hover:text-main"
              aria-label={t("inventory.clearSearch")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-bold text-muted">
        <span>{t("inventory.resultsCount", { count: total })}</span>
        {totalPages > 1 && <span>{t("inventory.showingPage", { page, pages: totalPages })}</span>}
      </div>

      {filteredProducts.length === 0 ? (
        <PremiumCard className="p-2 sm:p-4">
          <EmptyState
            title={activeTab === "archived" ? t("inventory.archivedNoResults") : t("inventory.noResults")}
            message={activeTab === "archived" ? t("inventory.archivedNoResultsHint") : t("inventory.noResultsHint")}
            icon={activeTab === "archived" ? Archive : Package}
          />
        </PremiumCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const tone = getCategoryTone(product.category);
            const qty = Number(product.quantity || 0);
            const minQty = Number(product.min_quantity_alert || 0);
            const isLow = qty <= minQty;
            const packs = getAvailablePacks(product);
            return (
              <article
                key={product.id}
                className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone.iconClass)}>
                      <tone.Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-main sm:text-base">{product.name}</h3>
                      <p className="truncate text-[11px] font-medium text-muted">
                        {product.category || t("inventory.categoryFallback")}
                        {product.sku ? ` • ${product.sku}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={product.is_archived ? "secondary" : isLow ? "danger" : "success"}
                    className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black"
                  >
                    {product.is_archived ? t("inventory.archived") : isLow ? t("inventory.low") : t("inventory.stable")}
                  </Badge>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-soft/50 p-2.5">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-muted">{t("inventory.stock")}</p>
                    <p className={cn("text-xs font-black", isLow && !product.is_archived ? "text-danger" : "text-main")}>
                      {formatQuantity(qty, product.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-muted">{t("inventory.packs")}</p>
                    <p className="text-xs font-black text-main">{formatNumber(packs)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-muted">{t("inventory.sell")}</p>
                    <p className="text-xs font-black text-success">{formatCurrency(product.sell_price || 0)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3 text-[11px]" onClick={() => openView(product)}>
                    <Eye size={13} className="me-1" /> {t("inventory.viewDetails")}
                  </Button>
                  {!product.is_archived && (
                    <Button type="button" variant="primary" size="sm" className="h-9 rounded-xl px-3 text-[11px]" onClick={() => openStockModal(product)}>
                      <Plus size={13} className="me-1" /> {t("inventory.supply")}
                    </Button>
                  )}
                  <Button type="button" variant="secondary" size="sm" className="h-9 rounded-xl px-3 text-[11px]" onClick={() => openEdit(product)}>
                    {t("inventory.edit")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl px-3 text-[11px]" onClick={() => openHistory(product)} title={t("inventory.movementTitle")}>
                    <History size={13} />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {t("common.back", { defaultValue: "السابق" })}
          </Button>
          <span className="px-2 text-sm font-bold text-muted">{t("inventory.showingPage", { page, pages: totalPages })}</span>
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            {t("common.next", { defaultValue: "التالي" })}
          </Button>
        </div>
      )}

      <ProductFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingProduct={editingProduct}
        formData={formData}
        setFormData={setFormData}
        uniqueCategories={uniqueCategories}
        imagePreview={imagePreview}
        staticBaseUrl={staticBaseUrl}
        onClearImage={() => {
          setImagePreview(null);
          form.setProductImage(null);
        }}
        fileInputRef={fileInputRef}
        onImageFile={handleImageUpload}
        uploading={uploading}
        selectedUnitLabel={selectedUnit.label}
        saving={saving}
        onSave={handleSave}
        isManagement={isManagement}
      />
      <StockSupplyModal
        open={isStockModalOpen}
        onOpenChange={setIsStockModalOpen}
        editingProduct={editingProduct}
        stockUnitValue={stockUnit.value}
        stockUnitShortLabel={stockUnit.shortLabel}
        stockFormData={stockFormData}
        setStockFormData={setStockFormData}
        showPriceAlert={showPriceAlert}
        newSellPrice={newSellPrice}
        setNewSellPrice={setNewSellPrice}
        saving={saving}
        onConfirmSupply={handleAddStock}
        onUpdateSellPrice={handleUpdateSellPrice}
        isManagement={isManagement}
      />
      <HistoryModal
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        productName={editingProduct?.name}
        historyLoading={historyLoading}
        historyLogs={historyLogs}
        unitShortLabel={stockUnit.shortLabel}
      />
      <ProductDetailsModal
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        product={viewProduct}
        staticBaseUrl={staticBaseUrl}
        onOpenHistory={(p) => {
          setIsViewOpen(false);
          openHistory(p);
        }}
      />
    </PageShell>
  );
}
