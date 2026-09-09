import React, { useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  Database,
  Droplets,
  FileDown,
  History,
  Gift,
  Package,
  Plus,
  Save,
  Search,
  ArrowRight,
  Clock,
  Camera,
  X,
  Eye,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { baseURL } from "@/services/api";
import { exportService } from "@/services/exportService";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  UNIT_OPTIONS,
  normalizeUnit,
  getUnitMeta,
  formatQuantity,
  getAvailablePacks,
  getEstimatedUnitCost,
} from "@/features/inventory";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/core/utils";
import { AnimatePresence } from "framer-motion";

const STATIC_BASE_URL = baseURL.replace("/api/v1", "");
const NATIVE_SELECT_CLASS =
  "h-11 w-full rounded-xl bg-soft border border-border px-4 font-bold";
const TEXTAREA_CLASS =
  "w-full min-h-[84px] rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none focus:border-slate-900 focus:ring-0 outline-none";

function getCategoryTone(product: Record<string, unknown>) {
  const normalized = String(product?.category || "").toLowerCase();
  if (
    normalized.includes("زيت") ||
    normalized.includes("serum") ||
    normalized.includes("سيروم")
  ) {
    return {
      Icon: Droplets,
      badge: "زيوت وسيروم",
      iconClass: "bg-info-soft text-info",
    };
  }
  return {
    Icon: Box,
    badge: "مستلزمات وتشغيل",
    iconClass: "bg-primary-soft text-primary",
  };
}

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
   
  const fileInputRef = useRef<any>(null);

  async function handleExport(type = "excel") {
    const filename = `inventory_${new Date().toISOString().split("T")[0]}`;
    if (type === "excel") {
      await exportService.downloadExcel("/exports/products/excel", filename, {
        q: searchTerm,
      });
      return;
    }
    await exportService.downloadCsv("/exports/products/csv", filename, {
      q: searchTerm,
    });
  }


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

        {/* Create/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent
            className="max-w-2xl rounded-2xl p-0 border-border bg-card shadow-premium sm:max-w-3xl sm:rounded-2xl"
            dir="rtl"
          >
            <DialogHeader className="border-b border-border/40 p-4 pb-3 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 sm:h-10 sm:w-10 sm:rounded-xl">
                  <Box size={16} className="text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black sm:text-lg">
                    {editingProduct ? "تحديث الصنف" : "إدراج صنف جديد"}
                  </DialogTitle>
                  <DialogDescription className="text-[10px] font-medium text-muted">
                    بيانات الصنف الأساسية
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={`اسم الصنف${editingProduct?.id && !isOwner ? " (المالك فقط)" : ""}`}
                >
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                    placeholder="اسم المنتج..."
                    disabled={!!editingProduct?.id && !isOwner}
                  />
                </Field>
                <Field label="كود المنتج">
                  <Input
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, sku: e.target.value }))
                    }
                    className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                    placeholder="Barcode..."
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="الشركة المصنعة">
                  <Input
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        company_name: e.target.value,
                      }))
                    }
                    className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                  />
                </Field>
                <Field label="التصنيف">
                  <Input
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, category: e.target.value }))
                    }
                    list="category-list"
                    className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                  />
                  <datalist id="category-list">
                    {uniqueCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <Field label="صور المنتج">
                <div className="flex items-center gap-3">
                  {imagePreview ? (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border sm:h-20 sm:w-20">
                      <img
                        src={
                          imagePreview.startsWith("http")
                            ? imagePreview
                            : `${STATIC_BASE_URL}${imagePreview}`
                        }
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProductImage(null);
                          setImagePreview(null);
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100"
                      >
                        <X size={16} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-soft sm:h-20 sm:w-20">
                      <Camera size={20} className="text-muted" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg text-[10px] font-black"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading
                        ? "جاري الرفع..."
                        : imagePreview
                          ? "تغيير الصورة"
                          : "رفع صورة"}
                    </Button>
                    <p className="mt-1 text-[8px] font-bold text-muted">
                      JPG, PNG, WEBP - حد أقصى 20 ميجا
                    </p>
                  </div>
                </div>
              </Field>
              <Field label="الوصف">
                <textarea
                  className={cn(TEXTAREA_CLASS)}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="وحدة القياس">
                  <select
                    value={normalizeUnit(formData.unit)}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, unit: e.target.value }))
                    }
                    className={NATIVE_SELECT_CLASS}
                  >
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="سعر البيع">
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.sell_price}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          sell_price: e.target.value,
                        }))
                      }
                      className="h-10 rounded-xl bg-soft border-border font-black text-success pl-10 sm:h-12 sm:pl-12"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:left-4">
                      ج.م
                    </span>
                  </div>
                </Field>
                <Field label="تكلفة العبوة">
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.cost_price}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          cost_price: e.target.value,
                        }))
                      }
                      className="h-10 rounded-xl bg-soft border-border font-black pl-10 sm:h-12 sm:pl-12"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:left-4">
                      ج.م
                    </span>
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={`سعة العبوة (${selectedUnit.label})`}>
                  <Input
                    type="number"
                    value={formData.weight}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, weight: e.target.value }))
                    }
                    className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                  />
                </Field>
                <Field label="حد الإنذار">
                  <Input
                    type="number"
                    value={formData.min_quantity_alert}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          min_quantity_alert: Number(e.target.value),
                        }))
                      }
                    className="h-10 rounded-xl bg-soft border-danger/30 text-danger font-bold sm:h-12"
                  />
                </Field>
              </div>
            </div>
            <DialogFooter className="border-t border-border bg-soft/20 p-4 gap-2 sm:p-5">
              <Button
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
                className="h-10 rounded-xl px-5 text-xs"
              >
                إلغاء
              </Button>
              <Button
                loading={saving}
                onClick={handleSave}
                className="h-10 rounded-xl px-6 text-xs"
              >
                <Save size={14} className="ml-1.5" />{" "}
                {editingProduct ? "حفظ" : "إدراج"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stock Supply Modal */}
        <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
          <DialogContent
            className="max-w-lg rounded-2xl p-0 border-border bg-card shadow-premium"
            dir="rtl"
          >
            <DialogHeader className="border-b border-border/40 p-4 pb-3 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 sm:h-10 sm:w-10 sm:rounded-xl">
                  <Plus size={16} className="text-success" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black sm:text-lg">
                    إذن توريد
                  </DialogTitle>
                  <DialogDescription className="text-[10px] font-medium text-muted">
                    {editingProduct?.name}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-5">
              <AnimatePresence mode="wait">
                {!showPriceAlert ? (
                  <motion.div
                    key="supply-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="rounded-xl border border-border bg-soft p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[8px] font-bold uppercase text-muted">
                            الرصيد الحالي
                          </p>
                          <p className="text-xs font-black text-main">
                            {editingProduct?.weight
                              ? `${formatNumber(getAvailablePacks(editingProduct))} عبوة`
                              : formatQuantity(
                                  editingProduct?.quantity || 0,
                                  stockUnit.value,
                                )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold uppercase text-muted">
                            سعة العبوة
                          </p>
                          <p className="text-xs font-black text-main">
                            {editingProduct?.weight
                              ? `${formatNumber(editingProduct.weight)} ${stockUnit.shortLabel}`
                              : "---"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="الكمية (عبوات)">
                        <div className="relative">
                          <Input
                            type="number"
                            value={stockFormData.amount}
                            onChange={(e) =>
                              setStockFormData((p) => ({
                                ...p,
                                amount: e.target.value,
                              }))
                            }
                            className="h-10 rounded-xl bg-soft border-border font-black pl-10 sm:h-12 sm:pl-12"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:left-4">
                            عبوة
                          </span>
                        </div>
                      </Field>
                      <Field label="المورد">
                        <Input
                          value={stockFormData.note}
                          onChange={(e) =>
                            setStockFormData((p) => ({
                              ...p,
                              note: e.target.value,
                            }))
                          }
                          placeholder="اسم المورد..."
                          className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                        />
                      </Field>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-soft p-3">
                      <div className="flex items-center gap-2">
                        <Database size={16} className="text-success" />
                        <div>
                          <div className="text-[10px] font-black text-main">
                            تسجيل كمصروف
                          </div>
                          <div className="text-[8px] font-bold text-muted">
                            تحديث التكلفة تلقائياً
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={stockFormData.create_expense}
                        onCheckedChange={(v) =>
                          setStockFormData((p) => ({ ...p, create_expense: v }))
                        }
                        className="data-[state=checked]:bg-success"
                      />
                    </div>
                    <Field label="سعر شراء العبوة">
                      <div className="relative">
                        <Input
                          type="number"
                          value={stockFormData.purchase_price}
                          onChange={(e) =>
                            setStockFormData((p) => ({
                              ...p,
                              purchase_price: e.target.value,
                            }))
                          }
                          placeholder={editingProduct?.cost_price || "0.00"}
                          className="h-10 rounded-xl bg-soft border-border font-black text-success pl-10 sm:h-12 sm:pl-12"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:left-4">
                          ج.م
                        </span>
                      </div>
                    </Field>
                  </motion.div>
                ) : (
                  <motion.div
                    key="price-alert"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="rounded-xl bg-warning/5 border border-warning/20 p-5 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                        <AlertTriangle size={24} className="text-warning" />
                      </div>
                      <h3 className="text-base font-black text-warning sm:text-lg">
                        تغير في سعر التكلفة!
                      </h3>
                      <p className="mt-2 text-xs font-bold text-muted">
                        تم التوريد بسعر جديد ({stockFormData.purchase_price}{" "}
                        ج.م) بدلاً من ({editingProduct?.cost_price} ج.م). هل تود
                        تحديث سعر البيع؟
                      </p>
                    </div>
                    <Field label="سعر البيع الجديد">
                      <div className="relative">
                        <Input
                          type="number"
                          value={newSellPrice}
                          onChange={(e) => setNewSellPrice(e.target.value)}
                          className="h-10 rounded-xl font-black text-primary border-primary/40 bg-primary/5 pl-10 sm:h-12 sm:pl-12"
                          autoFocus
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-primary/40 sm:left-4">
                          ج.م
                        </span>
                      </div>
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <DialogFooter className="border-t border-border bg-soft/10 p-4 gap-2 sm:p-5">
              {!showPriceAlert ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setIsStockModalOpen(false)}
                    className="h-10 rounded-xl px-5 text-xs"
                  >
                    إلغاء
                  </Button>
                  <Button
                    loading={saving}
                    onClick={handleAddStock}
                    className="h-10 rounded-xl px-6 text-xs"
                  >
                    تأكيد التوريد
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setIsStockModalOpen(false)}
                    className="h-10 rounded-xl px-5 text-xs"
                  >
                    تخطي
                  </Button>
                  <Button
                    loading={saving}
                    onClick={handleUpdateSellPrice}
                    className="h-10 rounded-xl px-6 text-xs bg-warning hover:bg-warning/90 text-white"
                  >
                    تحديث السعر
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Modal */}
        <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
          <DialogContent
            className="max-w-lg rounded-2xl p-0 border-border bg-card shadow-premium"
            dir="rtl"
          >
            <DialogHeader className="border-b border-border/40 p-4 pb-3 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 sm:h-10 sm:w-10 sm:rounded-xl">
                  <History size={16} className="text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black sm:text-lg">
                    سجل الحركات
                  </DialogTitle>
                  <DialogDescription className="text-[10px] font-medium text-muted">
                    {editingProduct?.name}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="max-h-[65vh] space-y-2 overflow-y-auto p-4 sm:p-5">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Clock className="animate-spin text-primary" size={24} />
                  <p className="text-xs font-bold text-muted">
                    جاري التحميل...
                  </p>
                </div>
              ) : historyLogs.length > 0 ? (
                historyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-soft p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          log.change_amount > 0
                            ? "bg-success/10 text-success"
                            : "bg-danger/10 text-danger",
                        )}
                      >
                        {log.change_amount > 0 ? (
                          <Plus size={14} />
                        ) : (
                          <ArrowRight className="rotate-45" size={14} />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-main">
                          {log.note ||
                            (log.change_amount > 0 ? "توريد" : "صرف")}
                        </p>
                        <p className="text-[9px] font-bold text-muted">
                          {new Date(log.created_at).toLocaleString("ar-EG")}
                        </p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-sm font-black",
                        log.change_amount > 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {log.change_amount > 0 ? "+" : ""}
                      {formatNumber(log.change_amount)} {stockUnit.shortLabel}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="لا توجد حركات"
                  text="لم يتم تسجيل أي عمليات لهذا الصنف."
                  icon={History}
                />
              )}
            </div>
            <DialogFooter className="border-t border-border bg-soft/10 p-4">
              <Button
                variant="secondary"
                onClick={() => setIsHistoryModalOpen(false)}
                className="h-10 rounded-xl px-5 text-xs"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Details Modal - Read Only */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent
            dir="rtl"
            className="max-w-lg rounded-[2rem] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]"
          >
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
              <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
              <div className="absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-accent/10" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/10 overflow-hidden">
                    {viewProduct?.image_url ? (
                      <img
                        src={
                          viewProduct.image_url.startsWith("http")
                            ? viewProduct.image_url
                            : `${STATIC_BASE_URL}${viewProduct.image_url}`
                        }
                        alt={viewProduct.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package size={22} className="text-white" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-black text-white leading-tight">{viewProduct?.name || "---"}</DialogTitle>
                    <DialogDescription className="text-xs font-bold text-slate-300">
                      عرض تفاصيل الصنف - قراءة فقط
                    </DialogDescription>
                  </div>
                </div>
                <Badge className={cn("rounded-full px-3 py-1 text-[10px] font-black border-0 shrink-0", viewProduct?.is_archived ? "bg-slate-600 text-white" : "bg-emerald-500 text-white")}>
                  {viewProduct?.is_archived ? "مؤرشف" : "نشط"}
                </Badge>
              </div>
            </div>

            {viewProduct ? (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-soft border border-border/60 p-4">
                    <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">الكود / SKU</div>
                    <div className="text-sm font-black text-main font-mono">{viewProduct.sku || "---"}</div>
                  </div>
                  <div className="rounded-2xl bg-soft border border-border/60 p-4">
                    <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">التصنيف</div>
                    <div className="text-sm font-black text-main">{viewProduct.category || "---"}</div>
                  </div>
                  <div className="rounded-2xl bg-soft border border-border/60 p-4">
                    <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">الشركة</div>
                    <div className="text-sm font-black text-main truncate">{viewProduct.company_name || "---"}</div>
                  </div>
                  <div className="rounded-2xl bg-soft border border-border/60 p-4">
                    <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">الوحدة</div>
                    <div className="text-sm font-black text-main">{getUnitMeta(viewProduct.unit).label} ({getUnitMeta(viewProduct.unit).shortLabel})</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-card border border-border p-3 text-center">
                    <div className="text-[9px] font-black text-muted uppercase">الرصيد</div>
                    <div className="text-sm font-black text-primary mt-1">{formatNumber(viewProduct.quantity || 0)} {getUnitMeta(viewProduct.unit).shortLabel}</div>
                    {viewProduct.weight ? <div className="text-[10px] font-bold text-muted">{formatNumber(getAvailablePacks(viewProduct))} عبوة</div> : null}
                  </div>
                  <div className="rounded-2xl bg-card border border-border p-3 text-center">
                    <div className="text-[9px] font-black text-muted uppercase">سعر البيع</div>
                    <div className="text-sm font-black text-success mt-1">{formatCurrency(viewProduct.sell_price || 0)}</div>
                  </div>
                  <div className="rounded-2xl bg-card border border-border p-3 text-center">
                    <div className="text-[9px] font-black text-muted uppercase">التكلفة</div>
                    <div className="text-sm font-black text-main mt-1">{formatCurrency(viewProduct.cost_price || 0)}</div>
                    {viewProduct.weight ? <div className="text-[10px] font-bold text-muted">{formatCurrency(getEstimatedUnitCost(viewProduct))} / {getUnitMeta(viewProduct.unit).shortLabel}</div> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1">
                    <FileText size={12} /> الوصف
                  </div>
                  <div className="rounded-2xl border border-border bg-soft/50 p-4 min-h-[60px]">
                    <p className="text-sm font-bold leading-relaxed text-main whitespace-pre-wrap">{viewProduct.description || "لا يوجد وصف."}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-soft border border-border p-3">
                    <div className="text-[9px] font-black text-muted uppercase mb-1">حد الإنذار</div>
                    <div className="font-black text-main">{formatNumber(viewProduct.min_quantity_alert || 0)} {getUnitMeta(viewProduct.unit).shortLabel}</div>
                    <div className={cn("text-[10px] font-bold mt-1", Number(viewProduct.quantity) <= Number(viewProduct.min_quantity_alert) ? "text-rose-600" : "text-emerald-600")}>
                      {Number(viewProduct.quantity) <= Number(viewProduct.min_quantity_alert) ? "• منخفض - يحتاج توريد" : "• مستقر"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-soft border border-border p-3">
                    <div className="text-[9px] font-black text-muted uppercase mb-1">سعة العبوة</div>
                    <div className="font-black text-main">{viewProduct.weight ? `${formatNumber(viewProduct.weight)} ${getUnitMeta(viewProduct.unit).shortLabel}` : "---"}</div>
                    <div className="text-[10px] font-bold text-muted mt-1">معرف: #{viewProduct.id}</div>
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Eye size={14} />
                  </div>
                  <p className="text-[11px] font-bold leading-relaxed text-amber-800">
                    عرض قراءة فقط - لا يمكن التعديل من هنا. استخدم زر <span className="underline">تعديل</span> في صفحة المخزون إذا كنت مالكاً.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => setIsViewOpen(false)} variant="outline" className="flex-1 h-11 rounded-xl font-black">
                    إغلاق
                  </Button>
                  <Button onClick={() => { setIsViewOpen(false); openHistory(viewProduct); }} className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black">
                    <History size={14} className="ml-2" /> سجل الحركات
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-muted font-bold">جاري التحميل...</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-muted sm:text-[10px]">
        {label}
      </span>
      {children}
    </label>
  );
}
