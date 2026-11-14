import {
  Archive,
  Database,
  FileDown,
  Gift,
  History,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/PageShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { formatNumber, cn } from "@/lib/core/utils";
import { NATIVE_SELECT_CLASS } from "@/features/inventory/components/inventoryClasses";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { baseURL } from "@/services/api";
import { useTranslation } from "react-i18next";
import {
  getUnitMeta,
  useInventoryData,
  useInventoryForm,
  useInventoryInsights,
  ProductFormModal,
  StockSupplyModal,
  HistoryModal,
  ProductDetailsModal,
  InventoryHero,
  InsightsPanel,
  CategoryChips,
  InventoryCard,
  InventoryTable,
  BulkActionBar,
} from "@/features/inventory";
import { PageHeader } from "@/components/shared/PremiumUI";

type ViewMode = "cards" | "table";

const SORT_OPTIONS = ["", "name", "-name", "-quantity", "quantity"] as const;

export default function Inventory() {
  const { t } = useTranslation("owner");
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const isManagement = ["owner", "admin", "manager"].includes(role);

  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [sort, setSort] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem("inventory:view") as ViewMode) || "cards";
    } catch {
      return "cards";
    }
  });
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // The upload and details modals still carry the legacy static-base-url prop.
  const staticBaseUrl = baseURL.replace("/api/v1", "");

  const { insights, loading: insightsLoading, refresh: refreshInsights } =
    useInventoryInsights(60, 4);

  const {
    loading,
    stats,
    summaryReady,
    filteredProducts,
    getCategoryTone,
    handleExport,
    fetchData,
    page,
    setPage,
    total,
    totalPages,
  } = useInventoryData(searchTerm, activeTab, showLowStockOnly, sort, category);

  /** Refresh everything the screen shows: the list, the KPIs and the insights. */
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchData(), refreshInsights()]);
  }, [fetchData, refreshInsights]);

  const form = useInventoryForm({
    fetchProducts: refreshAll,
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

  const datalistCategories = useMemo(
    () =>
      (insights?.categories ?? [])
        .map((c) => c.category)
        .filter((c) => c && c !== "?"),
    [insights],
  );

  // The selection is tied to the current page/filters; keeping it across a
  // filter change is how a bulk action lands on the wrong rows.
  useEffect(() => {
    setSelection(new Set());
  }, [activeTab, searchTerm, showLowStockOnly, sort, category, page]);

  const setViewAndPersist = useCallback((next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem("inventory:view", next);
    } catch {
      /* private mode -- the choice just does not persist */
    }
  }, []);

  const toggleOne = useCallback((id: number) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(
    (checked: boolean) => {
      setSelection((prev) => {
        const next = new Set(prev);
        for (const product of filteredProducts) {
          const id = Number(product.id);
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [filteredProducts],
  );

  const handleBulkArchiveOrRestore = useCallback(async () => {
    if (selection.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    let done = 0;
    for (const id of selection) {
      try {
        await api.post(`/products/${id}/toggle-archive`);
        done += 1;
      } catch {
        // Keep going; the summary toast reports how many succeeded.
      }
    }
    setBulkBusy(false);
    setSelection(new Set());
    toast.success(
      t(
        activeTab === "archived"
          ? "inventory.bulkRestoreDone"
          : "inventory.bulkArchiveDone",
        { count: done },
      ),
    );
    await refreshAll();
  }, [selection, bulkBusy, activeTab, t, refreshAll]);

  const handleCopyPurchaseList = useCallback(async () => {
    const suggestions = (insights?.low_stock ?? []).filter((row) =>
      selection.has(row.id),
    );
    if (suggestions.length === 0) {
      toast.error(t("inventory.purchaseNothing"));
      return;
    }
    const lines = suggestions.map(
      (row) =>
        `${row.name}: +${formatNumber(row.suggested)} ${getUnitMeta(row.unit ?? "g").shortLabel}`,
    );
    const text = [t("inventory.purchaseCopyTitle"), ...lines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("inventory.purchaseCopied"));
    } catch {
      toast.error(t("inventory.purchaseCopyFailed"));
    }
  }, [insights, selection, t]);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setCategory("");
    setShowLowStockOnly(false);
    setSort("");
  }, []);

  const hasFilters = !!(
    searchTerm ||
    category ||
    showLowStockOnly ||
    sort
  );

  if (loading && filteredProducts.length === 0) {
    return (
      <PageShell className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw className="animate-spin text-primary" size={30} />
          <p className="text-sm font-bold text-muted">{t("inventory.loading")}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="gap-4 sm:gap-5">
      <PageHeader
        title={t("inventory.title")}
        subtitle={t("inventory.subtitle")}
        badge={t("inventory.badge")}
        icon={Database}
        className="mb-0"
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-2 px-3 text-xs sm:flex-none"
              onClick={() => void refreshAll()}
              title={t("inventory.refresh")}
              aria-label={t("inventory.refresh")}
            >
              <RefreshCw size={14} /> <span className="hidden md:inline">{t("inventory.refresh")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-2 px-3 text-xs sm:flex-none"
              onClick={() => navigate("/inventory/bundles")}
              title={t("inventory.bundles")}
              aria-label={t("inventory.bundles")}
            >
              <Gift size={14} /> <span className="hidden md:inline">{t("inventory.bundles")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-2 px-3 text-xs sm:flex-none"
              onClick={() => navigate("/inventory/archive")}
              title={t("inventory.archive")}
              aria-label={t("inventory.archive")}
            >
              <History size={14} /> <span className="hidden md:inline">{t("inventory.archive")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-2 px-3 text-xs sm:flex-none"
              onClick={() => handleExport("excel")}
              title={t("inventory.exportProducts")}
              aria-label={t("inventory.exportProducts")}
            >
              <FileDown size={14} /> <span className="hidden md:inline">{t("inventory.export")}</span>
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

      {/* Hero: the money on the shelf + the analytics behind it */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <InventoryHero
            value={stats.value}
            cost={stats.cost}
            totals={insights?.totals ?? null}
            loading={!summaryReady}
            lowStock={stats.lowStock}
            showLowStockOnly={showLowStockOnly}
            onToggleLowStock={() => setShowLowStockOnly((v) => !v)}
            categories={insights?.categories ?? []}
          />
        </div>
        <div className="lg:col-span-4">
          <InsightsPanel insights={insights ?? null} loading={insightsLoading} />
        </div>
      </div>

      {/* Tabs + search + sort + view toggle */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as "active" | "archived");
            setShowLowStockOnly(false);
            setCategory("");
          }}
          className="w-full lg:w-auto"
        >
          <TabsList className="h-11 w-full rounded-2xl bg-soft/60 p-1 sm:w-auto">
            <TabsTrigger
              value="active"
              className="h-9 flex-1 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm sm:flex-none"
            >
              {t("inventory.activeTab")} ({formatNumber(stats.active)})
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="h-9 flex-1 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm sm:flex-none"
            >
              <Archive size={13} className="me-1.5" /> {t("inventory.archivedTab")} ({formatNumber(stats.archived)})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
              size={15}
            />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("inventory.searchPlaceholder")}
              className="h-11 rounded-2xl border-border bg-card ps-10 pe-10 text-sm font-medium"
              aria-label={t("inventory.searchPlaceholder")}
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
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className={cn(NATIVE_SELECT_CLASS, "h-11 w-auto rounded-2xl px-3 text-xs font-bold")}
            aria-label={t("inventory.sortLabel")}
          >
            <option value="">{t("inventory.sortRecent")}</option>
            <option value="name">{t("inventory.sortName")}</option>
            <option value="-name">{t("inventory.sortNameDesc")}</option>
            <option value="-quantity">{t("inventory.sortQuantityDesc")}</option>
            <option value="quantity">{t("inventory.sortLowFirst")}</option>
          </select>
          <div
            role="group"
            aria-label={t("inventory.viewToggle")}
            className="flex h-11 items-center rounded-2xl border border-border bg-card p-1"
          >
            <button
              type="button"
              aria-pressed={view === "cards"}
              onClick={() => setViewAndPersist("cards")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                view === "cards" ? "bg-primary text-primary-foreground" : "text-muted hover:text-main",
              )}
              title={t("inventory.viewCards")}
              aria-label={t("inventory.viewCards")}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              aria-pressed={view === "table"}
              onClick={() => setViewAndPersist("table")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                view === "table" ? "bg-primary text-primary-foreground" : "text-muted hover:text-main",
              )}
              title={t("inventory.viewTable")}
              aria-label={t("inventory.viewTable")}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Category filters (active tab, named categories only) */}
      {activeTab === "active" && (
        <CategoryChips
          options={insights?.categories ?? []}
          active={category}
          onChange={setCategory}
          totalCount={stats.active}
        />
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-muted">
        <span>{t("inventory.resultsCount", { count: total })}</span>
        {totalPages > 1 && (
          <span>{t("inventory.showingPage", { page, pages: totalPages })}</span>
        )}
      </div>

      {/* Results */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-2 shadow-soft sm:p-4">
          <EmptyState
            variant="section"
            title={
              activeTab === "archived"
                ? t("inventory.archivedNoResults")
                : t("inventory.noResults")
            }
            message={
              activeTab === "archived"
                ? t("inventory.archivedNoResultsHint")
                : t("inventory.noResultsHint")
            }
            icon={Database}
            action={
              hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={clearFilters}
                >
                  {t("inventory.showAllProducts")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <InventoryCard
              key={product.id}
              product={product}
              tone={getCategoryTone(product.category)}
              selected={selection.has(Number(product.id))}
              onToggleSelected={toggleOne}
              isManagement={isManagement}
              onView={openView}
              onSupply={openStockModal}
              onEdit={openEdit}
              onHistory={openHistory}
            />
          ))}
        </div>
      ) : (
        <InventoryTable
          products={filteredProducts}
          selection={selection}
          onToggleOne={toggleOne}
          onToggleAll={toggleAllOnPage}
          isManagement={isManagement}
          sort={sort}
          onSortChange={setSort}
          onView={openView}
          onSupply={openStockModal}
          onEdit={openEdit}
          onHistory={openHistory}
        />
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl px-4"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("common.back", { defaultValue: "??????" })}
          </Button>
          <span className="px-2 text-sm font-bold text-muted tabular-nums">
            {t("inventory.showingPage", { page, pages: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl px-4"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t("common.next", { defaultValue: "??????" })}
          </Button>
        </div>
      )}

      <BulkActionBar
        count={selection.size}
        mode={activeTab}
        busy={bulkBusy}
        onArchiveOrRestore={() => void handleBulkArchiveOrRestore()}
        onCopyPurchaseList={() => void handleCopyPurchaseList()}
        onClear={() => setSelection(new Set())}
      />

      {/* Modals */}
      <ProductFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingProduct={editingProduct}
        formData={formData}
        setFormData={setFormData}
        uniqueCategories={datalistCategories}
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
