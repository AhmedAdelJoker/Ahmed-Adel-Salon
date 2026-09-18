import { useMemo, useState } from "react";
import {
  Gift,
  Plus,
  Trash2,
  Package,
  Tag,
  Sparkles,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
  Search,
  RotateCcw,
  Power,
  PowerOff,
  Globe,
  Eye,
  Archive,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { cn, formatCurrency, formatNumber } from "@/lib/core/utils";
import EmptyState from "@/components/shared/EmptyState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  PageHeader,
  PremiumCard,
  SkeletonCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { staticURL } from "@/services/api";
import { useProductBundles } from "@/features/product-bundles";

function resolveBundleImage(offer: any): string {
  if (!offer?.image_url) return "";
  return offer.image_url.startsWith("http") ? offer.image_url : `${staticURL}${offer.image_url}`;
}

export default function ProductBundles() {
  const navigate = useNavigate();
  const {
    offers,
    loading,
    isModalOpen,
    setIsModalOpen,
    saving,
    uploading,
    editingId,
    formData,
    setFormData,
    totalPrice,
    availableProducts,
    togglingId,
    openCreate,
    openEdit,
    openDuplicate,
    handleImageUpload,
    handleAddProductToBundle,
    handleRemoveProduct,
    handleSave,
    handleDeleteOffer,
    handleToggleActive,
  } = useProductBundles();

  // local-filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const stats = useMemo(() => {
    const total = offers.length;
    const active = offers.filter((o: any) => o.is_active).length;
    const inactive = total - active;
    const pub = offers.filter((o: any) => o.is_public).length;
    const avgDiscount =
      total > 0
        ? Math.round(
            offers.reduce((s: number, o: any) => s + Number(o.discount_percentage || 0), 0) / total,
          )
        : 0;
    return { total, active, inactive, pub, avgDiscount };
  }, [offers]);

  const filteredOffers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return offers.filter((o: any) => {
      const matchesSearch =
        !q ||
        String(o.name_ar || "").toLowerCase().includes(q) ||
        String(o.name || "").toLowerCase().includes(q) ||
        String(o.description_ar || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !!o.is_active) ||
        (statusFilter === "inactive" && !o.is_active) ||
        (statusFilter === "public" && !!o.is_public);
      return matchesSearch && matchesStatus;
    });
  }, [offers, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await handleDeleteOffer(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // hook already toasts
    } finally {
      setDeleting(false);
    }
  };

  // price validation for form
  const offerPriceNum = Number(formData.offer_price);
  const isPriceInvalid = !!formData.offer_price && totalPrice > 0 && offerPriceNum > totalPrice;
  const isPriceEmpty = !String(formData.offer_price || "").trim();
  const discountPreview =
    formData.offer_price && totalPrice > 0 && !isPriceInvalid
      ? Math.round(((totalPrice - offerPriceNum) / totalPrice) * 100)
      : null;

  // loading skeletons (initial)
  if (loading) {
    return (
      <div className="erp-page space-y-6 pb-10">
        <PageHeader
          title="حزم المنتجات"
          subtitle="تحفيز المبيعات عبر باقات ذكية — قراءة وإدارة"
          badge="إدارة الحزم"
          icon={Gift}
        />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} variant="content" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-6 pb-10">
      <PageHeader
        title="حزم المنتجات"
        subtitle="تحفيز المبيعات عبر باقات اقتصادية مربوطة بالمخزون — إدارة ذكية"
        badge="إدارة الحزم"
        icon={Gift}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/inventory")}
              className="h-11 rounded-xl px-4 font-black border-border bg-card"
            >
              المستودع
            </Button>
            <Button
              onClick={openCreate}
              className="h-11 rounded-xl px-5 font-black shadow-lg shadow-primary/20"
            >
              <Gift size={16} className="ml-1.5" /> إنشاء باقة
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="إجمالي الحزم" value={formatNumber(stats.total)} icon={Gift} variant="primary" delay={0} />
        <StatCard label="النشط" value={formatNumber(stats.active)} icon={CheckCircle2} variant="success" delay={0.05} />
        <StatCard label="المنشور بالموقع" value={formatNumber(stats.pub)} icon={Globe} variant="info" delay={0.1} />
        <StatCard
          label="متوسط الخصم"
          value={`${formatNumber(stats.avgDiscount)}%`}
          icon={Tag}
          variant={stats.avgDiscount >= 30 ? "success" : stats.avgDiscount >= 10 ? "warning" : "secondary"}
          delay={0.15}
        />
      </div>

      {/* Filters */}
      <PremiumCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Search size={14} className="text-primary" />
          <span className="text-xs font-black text-muted uppercase tracking-widest">بحث وفلترة الحزم</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="mr-auto h-8 gap-1 rounded-xl text-xs font-black"
            >
              <RotateCcw size={12} /> إعادة ضبط
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr_auto]">
          <div className="space-y-1.5">
            <label htmlFor="bundle-search" className="text-[10px] font-black text-muted uppercase">
              بحث في الحزم
            </label>
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                id="bundle-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الحزمة أو الوصف..."
                aria-label="بحث في الحزم"
                className="h-11 pr-10 rounded-xl bg-soft border-border font-bold"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bundle-status" className="text-[10px] font-black text-muted uppercase">
              حالة الحزمة
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="bundle-status" className="h-11 w-full rounded-xl bg-soft border-border font-bold">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">النشط فقط</SelectItem>
                <SelectItem value="inactive">المعطل</SelectItem>
                <SelectItem value="public">المنشور بالموقع</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Badge variant="primary" className="rounded-full h-11 px-5 text-xs font-black tabular-nums">
              {formatNumber(filteredOffers.length)} من {formatNumber(offers.length)} حزمة
            </Badge>
          </div>
        </div>
      </PremiumCard>

      {/* Grid */}
      {filteredOffers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map((offer: any) => {
            const img = resolveBundleImage(offer);
            const showImg = !!img && !failedImages[String(offer.id)];
            const discount = Math.round(Number(offer.discount_percentage || 0));
            const isOffActive = !!offer.is_active;
            return (
              <motion.div
                key={offer.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col rounded-[2rem] bg-card border border-border hover:border-primary/20 transition-all shadow-soft hover:shadow-premium overflow-hidden"
              >
                {/* image */}
                <div className="relative h-52 overflow-hidden bg-soft">
                  {showImg ? (
                    <img
                      src={img}
                      alt={offer.name_ar || offer.name || "bundle"}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      onError={() =>
                        setFailedImages((p) => ({ ...p, [String(offer.id)]: true }))
                      }
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-muted bg-soft">
                      <div className="h-14 w-14 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
                        <Gift size={26} className="opacity-60" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">بدون صورة</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
                  <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap justify-end max-w-[60%]">
                    <Badge
                      variant={isOffActive ? "success" : "secondary"}
                      size="sm"
                      className="rounded-full border shadow-sm"
                    >
                      {isOffActive ? "نشط" : "معطل"}
                    </Badge>
                    {offer.is_public && (
                      <Badge variant="primary" size="sm" className="rounded-full border shadow-sm">
                        <Globe size={10} /> منشور
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-3 right-4 left-4">
                    <h3 className="text-[17px] font-black text-white leading-tight drop-shadow-md line-clamp-2">
                      {offer.name_ar || offer.name}
                    </h3>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col">
                  <p className="text-xs font-bold text-muted leading-relaxed min-h-[2.2rem] line-clamp-2">
                    {offer.description_ar || "— بدون وصف"}
                  </p>

                  <div className="space-y-2 flex-1">
                    <div className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                      <Package size={12} className="text-primary" /> محتويات الحزمة
                      <span className="mr-auto tabular-nums text-[10px] bg-soft border border-border rounded-full px-2 py-0.5">
                        {offer.offer_products?.length || 0}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[132px] overflow-hidden">
                      {(offer.offer_products || []).slice(0, 4).map((op: any) => (
                        <div
                          key={op.id}
                          className="flex items-center justify-between text-xs font-black p-2.5 rounded-xl bg-soft border border-border group-hover:bg-primary/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors shrink-0" />
                            <span className="text-main truncate text-[11px]">{op.product_name}</span>
                          </div>
                          <span className="text-primary tabular-nums shrink-0">×{op.quantity}</span>
                        </div>
                      ))}
                      {(offer.offer_products?.length || 0) > 4 && (
                        <div className="text-[11px] font-bold text-muted text-center">+{offer.offer_products.length - 4} منتجات أخرى</div>
                      )}
                      {(offer.offer_products?.length || 0) === 0 && (
                        <div className="text-[11px] font-bold text-muted text-center py-2">لا توجد منتجات</div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-dashed flex items-end justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="text-[9px] font-black text-muted uppercase tracking-[0.18em]">سعر العرض</div>
                      <div className="text-2xl font-black text-success tabular-nums truncate">{formatCurrency(offer.offer_price)}</div>
                    </div>
                    <div className="text-left space-y-1 shrink-0">
                      <div className="text-[10px] font-black text-muted line-through tabular-nums opacity-60">
                        {formatCurrency(offer.original_price)}
                      </div>
                      <Badge
                        variant={discount >= 30 ? "success" : discount >= 10 ? "warning" : "secondary"}
                        className="rounded-full font-black tabular-nums"
                      >
                        وفر {discount}%
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-3 flex gap-1.5 sm:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(offer)}
                      className="h-10 w-10 rounded-xl text-danger hover:bg-danger-soft hover:text-danger border border-transparent hover:border-danger/20 shrink-0"
                      title="حذف"
                      aria-label={`حذف ${offer.name_ar || offer.name}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openDuplicate(offer)}
                      className="h-10 w-10 rounded-xl border-border bg-card hover:bg-soft hover:border-primary/20 text-muted hover:text-primary shrink-0"
                      title="استنساخ الحزمة"
                      aria-label={`نسخ ${offer.name_ar || offer.name}`}
                    >
                      <Copy size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleToggleActive(offer.id)}
                      disabled={togglingId === offer.id}
                      className={cn(
                        "h-10 px-2.5 sm:px-3 rounded-xl font-black text-xs border shrink-0",
                        isOffActive
                          ? "text-muted hover:text-danger hover:bg-danger-soft hover:border-danger/20"
                          : "text-success hover:bg-success-soft border-success/20",
                      )}
                      title={isOffActive ? "تعطيل" : "تفعيل"}
                    >
                      {togglingId === offer.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : isOffActive ? (
                        <PowerOff size={14} className="ml-1" />
                      ) : (
                        <Power size={14} className="ml-1" />
                      )}
                      <span className="hidden xs:inline">{isOffActive ? "تعطيل" : "تفعيل"}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openEdit(offer)}
                      className="flex-1 h-10 rounded-xl font-black text-xs hover:bg-primary hover:text-white hover:border-primary transition-colors min-w-0"
                    >
                      تعديل
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <PremiumCard noPadding className="overflow-hidden">
          <div className="p-4 sm:p-6">
            {offers.length === 0 ? (
              <EmptyState
                title="لا توجد عروض منتجات"
                text="ابدأ بإنشاء أول حزمة منتجات (Bundle) لزيادة مبيعاتك وتفريغ المخزون الراكد."
                icon={Gift}
                action={
                  <Button onClick={openCreate} className="h-11 rounded-xl px-6 font-black">
                    إنشاء حزمة
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="لا نتائج"
                text="لم نجد حزماً تطابق بحثك — جرب توسيع الفلتر أو مسح البحث."
                icon={Search}
                action={
                  <Button variant="outline" onClick={handleResetFilters} className="h-10 rounded-xl font-black">
                    <RotateCcw size={14} className="ml-1.5" /> مسح الفلترة
                  </Button>
                }
              />
            )}
          </div>
        </PremiumCard>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="حذف الحزمة؟"
        description={deleteTarget ? `سيتم حذف "${deleteTarget.name_ar || deleteTarget.name}" نهائياً ولا يمكن التراجع.` : undefined}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
        loading={deleting}
        onConfirm={onConfirmDelete}
      />

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-[2rem] border-border bg-card shadow-2xl">
          <DialogHeader className="p-6 sm:p-8 border-b border-border bg-soft/40 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-16 bg-primary/10 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none" />
            <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-3 relative z-10 text-main">
              <div className="h-11 w-11 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md shrink-0">
                <Sparkles size={22} />
              </div>
              <span className="truncate">{editingId ? "تعديل حزمة المنتجات" : "هندسة حزمة منتجات احترافية"}</span>
            </DialogTitle>
            <DialogDescription className="text-muted font-bold mt-2 mr-[52px] text-xs sm:text-sm">
              قم بدمج المنتجات وتحديد السعر التنافسي لجذب العملاء.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 custom-scrollbar">
            {/* Right form */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-3">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">هوية العرض البصرية</span>
                <div className="relative group aspect-[16/10] rounded-[1.6rem] border-2 border-dashed border-border bg-soft/50 flex flex-col items-center justify-center transition-all hover:border-primary/30 overflow-hidden">
                  {formData.image_url ? (
                    <>
                      <img
                        src={formData.image_url.startsWith("http") ? formData.image_url : `${staticURL}${formData.image_url}`}
                        className="h-full w-full object-cover"
                        alt="Preview"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => (document.getElementById("bundle-img") as HTMLInputElement | null)?.click()}
                          className="rounded-xl font-black h-9"
                        >
                          تغيير
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setFormData((p: any) => ({ ...p, image_url: "" }))}
                          className="rounded-xl font-black h-9"
                        >
                          حذف
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div
                      className="flex flex-col items-center gap-3 text-muted group-hover:text-primary transition-colors cursor-pointer p-6 text-center"
                      onClick={() => (document.getElementById("bundle-img") as HTMLInputElement | null)?.click()}
                    >
                      {uploading ? <RefreshCw className="h-9 w-9 animate-spin" /> : <ImageIcon className="h-9 w-9" />}
                      <span className="text-xs font-black">اسحب الصورة أو انقر هنا</span>
                      <span className="text-[10px] font-bold opacity-60">PNG / JPG حتى 5MB</span>
                    </div>
                  )}
                  <input id="bundle-img" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-black text-main">اسم الحزمة التسويقي *</span>
                  <Input
                    value={formData.name_ar}
                    onChange={(e) => setFormData((p: any) => ({ ...p, name_ar: e.target.value }))}
                    placeholder="مثلاً: صندوق العناية الرمضاني..."
                    className="h-12 rounded-xl font-bold border-border bg-card"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black text-main">نص العرض الإقناعي</span>
                  <textarea
                    value={formData.description_ar}
                    onChange={(e) => setFormData((p: any) => ({ ...p, description_ar: e.target.value }))}
                    className="w-full min-h-28 p-4 rounded-xl border border-border bg-card font-bold text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                    placeholder="اشرح للعميل لماذا يجب عليه شراء هذه الحزمة الآن..."
                  />
                </label>
              </div>

              <div className="p-5 sm:p-6 rounded-[1.6rem] bg-success-soft/50 border border-success/15 space-y-4">
                <h4 className="font-black text-success flex items-center gap-2 text-sm">
                  <Tag size={16} /> خوارزمية التسعير
                </h4>
                <div className="flex items-center justify-between bg-card p-3.5 rounded-xl border border-border">
                  <span className="text-xs font-black text-muted">إجمالي سعر المنتجات</span>
                  <span className="text-base font-black text-main tabular-nums">{formatCurrency(totalPrice)}</span>
                </div>
                <label className="block space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-main">سعر البيع المقترح *</span>
                    {discountPreview !== null && (
                      <Badge variant="success" className="rounded-full font-black text-[10px]">خصم {discountPreview}%</Badge>
                    )}
                    {isPriceInvalid && <Badge variant="danger" className="rounded-full text-[10px]">يتجاوز الإجمالي</Badge>}
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      value={formData.offer_price}
                      onChange={(e) => setFormData((p: any) => ({ ...p, offer_price: e.target.value }))}
                      className={cn(
                        "h-14 rounded-xl font-black text-xl tabular-nums pl-14 pr-4 bg-card",
                        isPriceInvalid ? "border-danger focus:border-danger text-danger" : "border-border focus:border-primary",
                      )}
                      placeholder="0.00"
                    />
                    <div className={cn("absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm", isPriceInvalid ? "text-danger" : "text-muted")}>
                      ج.م
                    </div>
                  </div>
                  {isPriceInvalid && <p className="text-[11px] font-bold text-danger">لا يمكن أن يتجاوز {formatCurrency(totalPrice)}</p>}
                  {!isPriceInvalid && !isPriceEmpty && totalPrice === 0 && (
                    <p className="text-[11px] font-bold text-muted">أضف منتجات أولاً لحساب الخصم بدقة</p>
                  )}
                </label>
              </div>

              {/* quick stats inside modal */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-soft border border-border p-3 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted">
                    <Package size={14} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-muted uppercase">منتجات</div>
                    <div className="text-sm font-black text-main tabular-nums">{formatNumber(formData.products.length)}</div>
                  </div>
                </div>
                <div className="rounded-xl bg-soft border border-border p-3 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center text-primary">
                    <Tag size={14} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-muted uppercase">القيمة</div>
                    <div className="text-sm font-black text-main tabular-nums">{formatCurrency(totalPrice)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Left: selected + available */}
            <div className="lg:col-span-7 flex flex-col gap-6 min-h-[380px]">
              <div className="flex-1 border border-border rounded-[1.6rem] bg-soft/40 overflow-hidden flex flex-col">
                <div className="p-4 bg-card border-b border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center font-black text-xs border border-primary/10">
                      {formData.products.length}
                    </div>
                    <span className="font-black text-main text-sm">المنتجات المختارة</span>
                  </div>
                  {totalPrice > 0 && (
                    <span className="hidden sm:inline text-[10px] font-black text-muted bg-soft px-3 py-1.5 rounded-full border border-border tabular-nums">
                      الفعلية: {formatCurrency(totalPrice)}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[160px] max-h-[320px]">
                  {formData.products.length > 0 ? (
                    <AnimatePresence mode="popLayout">
                      {formData.products.map((p: any) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          key={p.product_id}
                          className="bg-card p-3.5 rounded-2xl border border-border flex items-center justify-between gap-3 shadow-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-xl bg-soft border border-border flex items-center justify-center text-muted shrink-0">
                              <Package size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-black text-main truncate">{p.name}</div>
                              <div className="text-[10px] font-bold text-muted tabular-nums">{formatCurrency(p.price)} / وحدة</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-soft p-1 rounded-xl border border-border">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const newQty = Math.max(1, Number(p.quantity) - 1);
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    products: prev.products.map((x: any) => (x.product_id === p.product_id ? { ...x, quantity: newQty } : x)),
                                  }));
                                }}
                                className="h-7 w-7 rounded-lg"
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                value={p.quantity}
                                min={1}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value) || 1);
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    products: prev.products.map((x: any) => (x.product_id === p.product_id ? { ...x, quantity: val } : x)),
                                  }));
                                }}
                                className="w-12 h-7 p-0 border-none bg-transparent text-center font-black text-xs"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const newQty = Number(p.quantity) + 1;
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    products: prev.products.map((x: any) => (x.product_id === p.product_id ? { ...x, quantity: newQty } : x)),
                                  }));
                                }}
                                className="h-7 w-7 rounded-lg"
                              >
                                +
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveProduct(p.product_id)}
                              className="h-9 w-9 text-danger hover:bg-danger-soft hover:text-danger rounded-xl"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted gap-3 py-8 opacity-60">
                      <div className="p-5 rounded-full bg-card border border-border">
                        <Archive size={32} strokeWidth={1.4} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-center max-w-[22ch]">أضف منتجات من القائمة بالأسفل لبناء الحزمة</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-muted uppercase tracking-widest">المنتجات المتاحة</span>
                  <span className="text-[10px] font-bold text-muted tabular-nums">{formatNumber(availableProducts.length)} متاح</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar p-1">
                  {availableProducts.length > 0 ? (
                    availableProducts.map((p: any) => (
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        key={p.id}
                        onClick={() => handleAddProductToBundle(p)}
                        className="p-3.5 text-right rounded-2xl border border-border bg-card hover:bg-soft hover:border-primary/20 transition-all shadow-sm hover:shadow-md group flex flex-col gap-2 min-h-[84px]"
                      >
                        <div className="text-[11px] font-black text-main line-clamp-2 leading-tight group-hover:text-primary transition-colors min-h-[28px]">
                          {p.name}
                        </div>
                        <div className="flex items-center justify-between mt-auto gap-2">
                          <span className="text-[10px] font-black text-success tabular-nums truncate">{formatCurrency(p.sell_price)}</span>
                          <span className="h-6 w-6 rounded-lg bg-soft border border-border text-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all shrink-0">
                            <Plus size={12} strokeWidth={3} />
                          </span>
                        </div>
                      </motion.button>
                    ))
                  ) : (
                    <div className="col-span-full py-8 flex flex-col items-center gap-2 text-muted">
                      <CheckCircle2 size={20} />
                      <span className="text-xs font-bold">جميع المنتجات مضافة</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 sm:p-8 border-t border-border bg-soft/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={cn(
                    "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                    formData.is_public ? "bg-primary border-primary" : "bg-card border-border",
                  )}
                >
                  {formData.is_public && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={!!formData.is_public}
                  onChange={(e) => setFormData((p: any) => ({ ...p, is_public: e.target.checked }))}
                />
                <span className="text-xs font-black text-main group-hover:text-primary transition-colors flex items-center gap-1">
                  <Globe size={12} /> نشر في الموقع
                </span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={cn(
                    "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                    formData.is_active ? "bg-success border-success" : "bg-card border-border",
                  )}
                >
                  {formData.is_active && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={!!formData.is_active}
                  onChange={(e) => setFormData((p: any) => ({ ...p, is_active: e.target.checked }))}
                />
                <span className="text-xs font-black text-main group-hover:text-success transition-colors flex items-center gap-1">
                  {formData.is_active ? <Eye size={12} /> : <Archive size={12} />} {formData.is_active ? "نشط" : "معطل"}
                </span>
              </label>
            </div>

            <div className="flex gap-2.5 sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 sm:flex-none h-11 px-6 rounded-xl font-black border border-transparent hover:border-border bg-card"
              >
                إلغاء
              </Button>
              <Button
                loading={saving}
                onClick={handleSave}
                disabled={isPriceInvalid || isPriceEmpty}
                className="flex-1 sm:flex-none h-11 px-8 rounded-xl font-black disabled:opacity-50"
              >
                {editingId ? "تحديث الحزمة" : "حفظ الحزمة"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
