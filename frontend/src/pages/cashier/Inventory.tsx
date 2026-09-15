import {
  Activity,
  AlertTriangle,
  Box,
  Database,
  FileDown,
  History,
  Gift,
  Package,
  Plus,
  Search,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import EmptyState from "@/components/shared/EmptyState";
import { formatCurrency, cn } from "@/lib/core/utils";
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
import { formatNumber } from "@/lib/core/utils";

export default function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = ["OWNER", "ADMIN"].includes(
    String(user?.role || "").toUpperCase(),
  );
  const {
    loading,
    searchTerm,
    setSearchTerm,
    activeTab,
    setActiveTab,
    fetchProducts,
    filteredProducts,
    stats,
    uniqueCategories,
    STATIC_BASE_URL,
    getCategoryTone,
    handleExport,
  } = useInventoryData();
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
    setProductImage,
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
  } = useInventoryForm({ fetchProducts, isOwner });


  if (loading && filteredProducts.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-primary">
          <Activity className="h-8 w-8 animate-pulse" />
          <p className="text-xs font-bold text-muted">جاري تحميل المخزون...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <PageHeader className={undefined}
          title="إدارة المستودع"
          subtitle="نظام أتمتة المخزون والربط المالي الكامل"
          badge="لوحة المستودع"
          icon={Package}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl px-3 text-xs"
                onClick={() => navigate("/inventory/bundles")}
              >
                <Gift size={14} className="ml-1.5" />{" "}
                <span className="hidden sm:inline">حزم</span>
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl px-3 text-xs"
                onClick={() => navigate("/inventory/archive")}
              >
                <History size={14} className="ml-1.5" />{" "}
                <span className="hidden sm:inline">أرشيف</span>
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl px-3 text-xs"
                onClick={() => handleExport("excel")}
              >
                <FileDown size={14} className="ml-1.5" />{" "}
                <span className="hidden sm:inline">تصدير</span>
              </Button>
              <Button
                onClick={openCreate}
                className="h-10 rounded-xl px-4 text-xs"
              >
                <Plus size={14} className="ml-1.5" /> إضافة
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-soft sm:flex">
                <Database size={16} className="text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  إجمالي القيمة
                </p>
                <p className="truncate text-sm font-black text-main sm:text-lg">
                  {formatCurrency(stats.value)}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft sm:flex">
                <Package size={16} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  تكلفة المخزون
                </p>
                <p className="truncate text-sm font-black text-main sm:text-lg">
                  {formatCurrency(stats.cost)}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className={cn(
                  "hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex",
                  stats.lowStock > 0 ? "bg-danger-soft" : "bg-success-soft",
                )}
              >
                <AlertTriangle
                  size={16}
                  className={
                    stats.lowStock > 0 ? "text-danger" : "text-success"
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  نواقص
                </p>
                <p className="text-sm font-black text-main sm:text-lg">
                  {stats.lowStock}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="group p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-soft sm:flex">
                <Box size={16} className="text-info" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
                  إجمالي الأصناف
                </p>
                <p className="text-sm font-black text-main sm:text-lg">
                  {stats.total}
                </p>
              </div>
            </div>
          </PremiumCard>
        </div>

        <PremiumCard noPadding className={undefined}>
          <div className="border-b border-border/40 p-3 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث بالاسم أو التصنيف أو الكود..."
                  className="h-10 w-full rounded-xl bg-soft border-border pr-9 text-xs font-bold sm:h-12 sm:rounded-xl sm:text-sm"
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-10 rounded-xl bg-soft border border-border p-1 sm:h-12">
                  <TabsTrigger
                    value="active"
                    className="h-full rounded-lg px-3 text-[10px] font-black sm:px-5 sm:text-xs"
                  >
                    النشط ({stats.active})
                  </TabsTrigger>
                  <TabsTrigger
                    value="archived"
                    className="h-full rounded-lg px-3 text-[10px] font-black sm:px-5 sm:text-xs"
                  >
                    الأرشيف ({stats.archived})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {activeTab === "active" && stats.lowStock > 0 && (
            <div className="flex items-center gap-3 border-b border-danger/10 bg-danger/5 px-3 py-2.5 sm:px-5 sm:py-3">
              <AlertTriangle size={14} className="shrink-0 text-danger" />
              <p className="text-[10px] font-bold text-danger sm:text-xs">
                يوجد {stats.lowStock} أصناف قاربت على النفاد
              </p>
            </div>
          )}

          <div className="p-3 sm:p-5">
            {filteredProducts.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4">
                {filteredProducts.map((product) => {
                  const isLow =
                    Number(product.quantity || 0) <=
                    Number(product.min_quantity_alert || 0);
                  const availablePacks = getAvailablePacks(product);
                  const tone = getCategoryTone(product);

                  return (
                    <PremiumCard
                      key={product.id}
                      className={cn(
                        "group p-3 sm:p-4",
                        isLow &&
                          !product.is_archived &&
                          "border-danger/20 bg-danger/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden sm:h-10 sm:w-10",
                              tone.iconClass,
                              !product.image_url && "bg-soft",
                            )}
                          >
                            {product.image_url ? (
                              <img
                                src={
                                  product.image_url.startsWith("http")
                                    ? product.image_url
                                    : `${STATIC_BASE_URL}${product.image_url}`
                                }
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <>
                                <tone.Icon size={16} className="sm:hidden" />
                                <tone.Icon
                                  size={18}
                                  className="hidden sm:block"
                                />
                              </>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4
                              className="truncate text-sm font-black text-main sm:text-base"
                              title={product.name}
                            >
                              {product.name}
                            </h4>
                            <p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted sm:text-[10px]">
                              {product.company_name
                                ? `${product.company_name} • `
                                : ""}
                              {product.category || "عام"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            product.is_archived
                              ? "secondary"
                              : isLow
                                ? "danger"
                                : "success"
                          }
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[7px] font-black uppercase sm:px-2 sm:py-0.5 sm:text-[8px]"
                        >
                          {product.is_archived
                            ? "مؤرشف"
                            : isLow
                              ? "منخفض"
                              : "مستقر"}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-soft p-2 sm:p-3">
                          <p className="text-[8px] font-bold uppercase tracking-wider text-muted sm:text-[9px]">
                            الرصيد
                          </p>
                          <p className="mt-0.5 truncate text-[10px] font-black text-primary sm:text-xs">
                            {product.weight
                              ? `${formatNumber(availablePacks)} عبوة`
                              : formatQuantity(
                                  product.quantity || 0,
                                  product.unit,
                                )}
                          </p>
                        </div>
                        <div className="rounded-lg bg-soft p-2 sm:p-3">
                          <p className="text-[8px] font-bold uppercase tracking-wider text-muted sm:text-[9px]">
                            البيع
                          </p>
                          <p className="mt-0.5 truncate text-[10px] font-black text-success sm:text-xs">
                            {formatCurrency(product.sell_price ?? 0)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-soft/50 p-2 sm:p-3">
                        <div>
                          <p className="text-[8px] font-bold uppercase text-muted">
                            إجمالي الكمية
                          </p>
                          <p className="text-xs font-black text-main sm:text-sm">
                            {formatQuantity(
                              product.quantity || 0,
                              product.unit,
                            )}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => openHistory(product)}
                          title="سجل الحركات"
                        >
                          <History size={13} className="text-muted" />
                        </Button>
                      </div>

                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg border border-border bg-card text-muted hover:bg-slate-900 hover:text-white hover:border-slate-900 shrink-0 sm:h-10 sm:w-10"
                          onClick={() => openView(product)}
                          title="عرض التفاصيل (قراءة فقط)"
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 flex-1 rounded-lg text-[10px] font-black sm:h-10 sm:text-xs"
                          onClick={() => openEdit(product)}
                        >
                          تعديل
                        </Button>
                        <Button
                          variant="primary"
                          className="h-8 flex-1 rounded-lg text-[10px] font-black sm:h-10 sm:text-xs"
                          onClick={() => openStockModal(product)}
                        >
                          <Plus size={12} className="ml-1" /> توريد
                        </Button>
                      </div>
                    </PremiumCard>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="لا توجد نتائج"
                text="لم نجد أي أصناف في هذا القسم حالياً."
                icon={Package}
                action={
                  <Button
                    onClick={openCreate}
                    className="h-10 rounded-xl px-5 text-xs font-black"
                  >
                    إضافة صنف جديد
                  </Button>
                }
              />
            )}
          </div>
        </PremiumCard>

        <ProductFormModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          editingProduct={editingProduct}
          formData={formData}
          setFormData={setFormData}
          uniqueCategories={uniqueCategories}
          imagePreview={imagePreview}
          staticBaseUrl={STATIC_BASE_URL}
          onClearImage={() => {
            setProductImage(null);
            setImagePreview(null);
          }}
          fileInputRef={fileInputRef}
          onImageFile={(file) => handleImageUpload(file)}
          uploading={uploading}
          selectedUnitLabel={selectedUnit.label}
          saving={saving}
          onSave={handleSave}
          isOwner={isOwner}
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
          staticBaseUrl={STATIC_BASE_URL}
          onOpenHistory={openHistory}
        />
      </div>
    </div>
  );
}
