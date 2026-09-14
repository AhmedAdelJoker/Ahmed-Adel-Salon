import React from "react";
import {
  Gift,
  Plus,
  Trash2,
  Package,
  Tag,
  ArrowLeft,
  Sparkles,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { cn, formatCurrency } from "@/lib/core/utils";
import EmptyState from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";
import api, { staticURL } from "@/services/api";
import { useProductBundles } from "@/features/product-bundles";

export default function ProductBundles() {
  const navigate = useNavigate();
  const {
    offers,
    products,
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
    openCreate,
    openEdit,
    handleImageUpload,
    handleAddProductToBundle,
    handleRemoveProduct,
    handleSave,
    handleDeleteOffer,
  } = useProductBundles();

  return (
    <div className="erp-page-container space-y-8 pb-10" dir="rtl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/inventory")}
              className="rounded-xl border border-border bg-white shadow-sm"
            >
              <ArrowLeft size={18} />
            </Button>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              عروض وحزم المنتجات
            </h1>
          </div>
          <p className="text-slate-500 font-bold mr-12 text-sm uppercase tracking-widest opacity-80">
            تحفيز المبيعات عبر باقات اقتصادية ذكية.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-12 rounded-2xl px-6 font-black shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
        >
          <Gift size={20} className="ml-2" /> إنشاء باقة ترويجية
        </Button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            جاري تحليل مصفوفة العروض...
          </p>
        </div>
      ) : offers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {offers.map((offer) => (
            <motion.div
              key={offer.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative flex flex-col rounded-[2.5rem] bg-card border-2 border-primary/5 hover:border-primary/20 transition-all shadow-lg hover:shadow-2xl overflow-hidden"
            >
              {/* Image Overlay Header */}
              <div className="relative h-56 overflow-hidden">
                <img
                  src={
                    offer.image_url
                      ? offer.image_url.startsWith("http")
                        ? offer.image_url
                        : `${staticURL}${offer.image_url}`
                      : "https://images.unsplash.com/photo-1593702295094-172c69a15444?q=80&w=800"
                  }
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  alt={offer.name_ar}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge
                    className={cn(
                      "rounded-xl border-none font-black text-[9px] uppercase tracking-widest shadow-lg",
                      offer.is_active
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-400 text-white",
                    )}
                  >
                    {offer.is_active ? "نشط" : "معطل"}
                  </Badge>
                  {offer.is_public && (
                    <Badge className="bg-primary text-white rounded-xl border-none font-black text-[9px] uppercase tracking-widest shadow-lg">
                      منشور بالموقع
                    </Badge>
                  )}
                </div>

                <div className="absolute bottom-4 right-6 left-6">
                  <h3 className="text-xl font-black text-white leading-tight drop-shadow-md">
                    {offer.name_ar || offer.name}
                  </h3>
                </div>
              </div>

              <div className="p-8 space-y-6 flex-1 flex flex-col">
                <p className="text-xs font-bold text-slate-500 leading-relaxed min-h-[3rem] line-clamp-2">
                  {offer.description_ar}
                </p>

                <div className="space-y-3 flex-1">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Package size={12} className="text-primary" /> محتويات
                    الحزمة
                  </div>
                  {offer.offer_products?.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center justify-between text-xs font-black p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                        <span className="text-slate-700">
                          {op.product_name}
                        </span>
                      </div>
                      <span className="text-primary">×{op.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-dashed flex items-end justify-between">
                  <div className="space-y-1">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      سعر العرض النهائي
                    </div>
                    <div className="text-3xl font-black text-emerald-600 tabular-nums">
                      {formatCurrency(offer.offer_price)}
                    </div>
                  </div>
                  <div className="text-left space-y-1">
                    <div className="text-[10px] font-black text-slate-400 line-through tabular-nums opacity-60">
                      {formatCurrency(offer.original_price)}
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20 font-black rounded-lg">
                      وفر {Math.round(offer.discount_percentage)}%
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteOffer(offer.id)}
                    className="h-11 w-11 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openEdit(offer)}
                    className="flex-1 h-11 rounded-xl font-black text-xs group-hover:bg-primary group-hover:text-white transition-all"
                  >
                    تعديل العرض
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="لا توجد عروض منتجات"
          text="ابدأ بإنشاء أول حزمة منتجات (Bundle) لزيادة مبيعاتك وتفريغ المخزون الراكد."
          icon={Gift}
          action={<Button onClick={openCreate}>إنشاء حزمة</Button>}
        />
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-[3rem] border-none shadow-2xl"
          dir="rtl"
        >
          <DialogHeader className="p-10 border-b bg-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-20 bg-primary/10 rounded-full -mr-20 -mt-20 blur-3xl" />
            <DialogTitle className="text-3xl font-black flex items-center gap-4 relative z-10">
              <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg">
                <Sparkles size={28} />
              </div>
              {editingId ? "تعديل حزمة المنتجات" : "هندسة حزمة منتجات احترافية"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-bold mt-2 mr-16">
              قم بدمج المنتجات وتحديد السعر التنافسي لجذب العملاء.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-12 gap-12 custom-scrollbar relative">
            <div className="lg:col-span-5 space-y-8">
              {/* Image Upload Area */}
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  هوية العرض البصرية
                </span>
                <div className="relative group aspect-[16/10] rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center transition-all hover:border-primary/40 overflow-hidden">
                  {formData.image_url ? (
                    <>
                      <img
                        src={
                          formData.image_url.startsWith("http")
                            ? formData.image_url
                            : `${staticURL}${formData.image_url}`
                        }
                        className="h-full w-full object-cover"
                        alt="Preview"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            (document.getElementById("bundle-img") as HTMLInputElement | null)?.click()
                          }
                          className="rounded-xl font-black h-10"
                        >
                          تغيير
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            setFormData((p) => ({ ...p, image_url: "" }))
                          }
                          className="rounded-xl font-black h-10"
                        >
                          حذف
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div
                      className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-primary transition-colors cursor-pointer"
                      onClick={() =>
                        (document.getElementById("bundle-img") as HTMLInputElement | null)?.click()
                      }
                    >
                      {uploading ? (
                        <RefreshCw className="h-10 w-10 animate-spin" />
                      ) : (
                        <ImageIcon className="h-10 w-10" />
                      )}
                      <span className="text-xs font-black">
                        اسحب الصورة أو انقر هنا
                      </span>
                    </div>
                  )}
                  <input
                    id="bundle-img"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <label className="block space-y-2">
                  <span className="text-xs font-black text-slate-600 ml-1 uppercase tracking-wider">
                    اسم الحزمة التسويقي
                  </span>
                  <Input
                    value={formData.name_ar}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name_ar: e.target.value }))
                    }
                    placeholder="مثلاً: صندوق العناية الرمضاني..."
                    className="h-14 rounded-2xl font-black text-lg border-slate-200 focus:border-primary transition-all"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-black text-slate-600 ml-1 uppercase tracking-wider">
                    نص العرض الإقناعي
                  </span>
                  <textarea
                    value={formData.description_ar}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        description_ar: e.target.value,
                      }))
                    }
                    className="w-full min-h-32 p-5 rounded-2xl border border-slate-200 bg-white font-bold text-sm outline-none focus:border-primary transition-all shadow-sm"
                    placeholder="اشرح للعميل لماذا يجب عليه شراء هذه الحزمة الآن..."
                  />
                </label>
              </div>

              <div className="p-8 rounded-[2.5rem] bg-emerald-50 border border-emerald-100/50 space-y-6 shadow-inner">
                <h4 className="font-black text-emerald-700 flex items-center gap-3 text-lg">
                  <Tag size={20} /> خوارزمية التسعير
                </h4>
                <div className="grid grid-cols-1 gap-6">
                  <div className="flex items-center justify-between bg-white/60 p-4 rounded-2xl border border-white/50 backdrop-blur-sm">
                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                      إجمالي سعر المنتجات
                    </div>
                    <div className="text-xl font-black text-slate-900 tabular-nums">
                      {formatCurrency(totalPrice)}
                    </div>
                  </div>
                  <label className="block space-y-3">
                    <div className="flex items-center justify-between ml-1">
                      <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">
                        سعر البيع المقترح
                      </span>
                      {formData.offer_price && totalPrice > 0 && (
                        <Badge className="bg-emerald-500 text-white border-none font-black text-[10px]">
                          خصم{" "}
                          {Math.round(
                            ((totalPrice - formData.offer_price) / totalPrice) *
                              100,
                          )}
                          %
                        </Badge>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.offer_price}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            offer_price: e.target.value,
                          }))
                        }
                        className="h-16 rounded-2xl font-black text-2xl text-emerald-600 pl-14 pr-6 border-emerald-200 focus:border-emerald-500 shadow-lg"
                        placeholder="0.00"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-400">
                        ج.م
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col h-full space-y-8">
              <div className="flex-1 border-2 border-slate-100 rounded-[3rem] bg-slate-50/50 overflow-hidden flex flex-col shadow-inner">
                <div className="p-6 bg-white border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                      {formData.products.length}
                    </div>
                    <span className="font-black text-slate-700 tracking-tight">
                      المنتجات المختارة
                    </span>
                  </div>
                  {totalPrice > 0 && (
                    <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 tabular-nums">
                      القيمة الفعلية: {formatCurrency(totalPrice)}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {formData.products.length > 0 ? (
                    <AnimatePresence mode="popLayout">
                      {formData.products.map((p) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          key={p.product_id}
                          className="bg-white p-4 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <Package size={20} />
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-black text-slate-800">
                                {p.name}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {formatCurrency(p.price)} للوحدة
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const newQty = Math.max(
                                    1,
                                    Number(p.quantity) - 1,
                                  );
                                  setFormData((prev) => ({
                                    ...prev,
                                    products: prev.products.map((x) =>
                                      x.product_id === p.product_id
                                        ? { ...x, quantity: newQty }
                                        : x,
                                    ),
                                  }));
                                }}
                                className="h-7 w-7 rounded-lg hover:bg-white"
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                value={p.quantity}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value));
                                  setFormData((prev) => ({
                                    ...prev,
                                    products: prev.products.map((x) =>
                                      x.product_id === p.product_id
                                        ? { ...x, quantity: val }
                                        : x,
                                    ),
                                  }));
                                }}
                                className="w-12 h-7 p-0 border-none bg-transparent text-center font-black text-xs"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const newQty = Number(p.quantity) + 1;
                                  setFormData((prev) => ({
                                    ...prev,
                                    products: prev.products.map((x) =>
                                      x.product_id === p.product_id
                                        ? { ...x, quantity: newQty }
                                        : x,
                                    ),
                                  }));
                                }}
                                className="h-7 w-7 rounded-lg hover:bg-white"
                              >
                                +
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveProduct(p.product_id)}
                              className="h-10 w-10 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"
                            >
                              <Trash2 size={18} />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-40">
                      <div className="p-8 rounded-full bg-slate-100">
                        <Package size={64} strokeWidth={1} />
                      </div>
                      <span className="text-sm font-black uppercase tracking-widest">
                        قم بإضافة المنتجات من الأسفل لبناء الحزمة
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-2">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    قائمة المنتجات المتاحة
                  </span>
                  <div className="text-[10px] font-bold text-primary animate-pulse">
                    اختر للمساهمة في الحزمة
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-56 overflow-y-auto custom-scrollbar p-2 bg-white/50 rounded-[2rem] border border-slate-100 shadow-inner">
                  {availableProducts.map((p) => (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={p.id}
                        onClick={() => handleAddProductToBundle(p)}
                        className="p-4 text-right rounded-2xl border-2 border-white bg-white hover:bg-primary/5 hover:border-primary/30 transition-all shadow-sm hover:shadow-md group flex flex-col justify-between"
                      >
                        <div className="text-[11px] font-black text-slate-800 line-clamp-1 mb-1 group-hover:text-primary transition-colors">
                          {p.name}
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="text-[10px] font-black text-emerald-600 tabular-nums">
                            {formatCurrency(p.sell_price)}
                          </div>
                          <div className="h-6 w-6 rounded-lg bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                            <Plus size={14} strokeWidth={3} />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-10 border-t bg-slate-50 flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={cn(
                    "h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
                    formData.is_public
                      ? "bg-primary border-primary shadow-lg shadow-primary/20"
                      : "bg-white border-slate-200",
                  )}
                >
                  {formData.is_public && (
                    <CheckCircle2 size={14} className="text-white" />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.is_public}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, is_public: e.target.checked }))
                  }
                />
                <span className="text-xs font-black text-slate-600 group-hover:text-primary transition-colors uppercase tracking-widest">
                  نشر في الموقع العام
                </span>
              </label>
            </div>

            <div className="flex gap-4">
              <Button
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="h-14 px-10 rounded-2xl font-black text-slate-500 hover:bg-white hover:text-slate-900 transition-all"
              >
                إلغاء التعديلات
              </Button>
              <Button
                loading={saving}
                onClick={handleSave}
                className="h-14 px-12 rounded-2xl font-black shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 text-lg"
              >
                {editingId ? "تحديث الحزمة" : "حفظ واعتماد الحزمة"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

