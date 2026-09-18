import { Package, History, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber } from "@/lib/core/utils";
import {
  getUnitMeta,
  getAvailablePacks,
  getEstimatedUnitCost,
} from "@/features/inventory/design-tokens";
import type { InventoryProductAny } from "@/features/inventory/hooks/useInventoryForm";

export interface ProductDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: InventoryProductAny | null;
  staticBaseUrl: string;
  onOpenHistory: (product: InventoryProductAny) => void;
}

export function ProductDetailsModal({
  open,
  onOpenChange,
  product,
  staticBaseUrl,
  onOpenHistory,
}: ProductDetailsModalProps) {
  const viewProduct = product;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
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
                        : `${staticBaseUrl}${viewProduct.image_url}`
                    }
                    alt={viewProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package size={22} className="text-white" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white leading-tight">
                  {viewProduct?.name || "---"}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-300">
                  عرض تفاصيل الصنف - قراءة فقط
                </DialogDescription>
              </div>
            </div>
            <Badge
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-black border-0 shrink-0",
                viewProduct?.is_archived
                  ? "bg-slate-600 text-white"
                  : "bg-emerald-500 text-white",
              )}
            >
              {viewProduct?.is_archived ? "مؤرشف" : "نشط"}
            </Badge>
          </div>
        </div>

        {viewProduct ? (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-soft border border-border/60 p-4">
                <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">
                  الكود / SKU
                </div>
                <div className="text-sm font-black text-main font-mono">
                  {viewProduct.sku || "---"}
                </div>
              </div>
              <div className="rounded-2xl bg-soft border border-border/60 p-4">
                <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">
                  التصنيف
                </div>
                <div className="text-sm font-black text-main">
                  {viewProduct.category || "---"}
                </div>
              </div>
              <div className="rounded-2xl bg-soft border border-border/60 p-4">
                <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">
                  الشركة
                </div>
                <div className="text-sm font-black text-main truncate">
                  {viewProduct.company_name || "---"}
                </div>
              </div>
              <div className="rounded-2xl bg-soft border border-border/60 p-4">
                <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">
                  الوحدة
                </div>
                <div className="text-sm font-black text-main">
                  {getUnitMeta(viewProduct.unit).label} (
                  {getUnitMeta(viewProduct.unit).shortLabel})
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-card border border-border p-3 text-center">
                <div className="text-[9px] font-black text-muted uppercase">
                  الرصيد
                </div>
                <div className="text-sm font-black text-primary mt-1">
                  {formatNumber(viewProduct.quantity || 0)}{" "}
                  {getUnitMeta(viewProduct.unit).shortLabel}
                </div>
                {viewProduct.weight ? (
                  <div className="text-[10px] font-bold text-muted">
                    {formatNumber(getAvailablePacks(viewProduct))} عبوة
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl bg-card border border-border p-3 text-center">
                <div className="text-[9px] font-black text-muted uppercase">
                  سعر البيع
                </div>
                <div className="text-sm font-black text-success mt-1">
                  {formatCurrency(viewProduct.sell_price || 0)}
                </div>
              </div>
              <div className="rounded-2xl bg-card border border-border p-3 text-center">
                <div className="text-[9px] font-black text-muted uppercase">
                  التكلفة
                </div>
                <div className="text-sm font-black text-main mt-1">
                  {formatCurrency(viewProduct.cost_price || 0)}
                </div>
                {viewProduct.weight ? (
                  <div className="text-[10px] font-bold text-muted">
                    {formatCurrency(getEstimatedUnitCost(viewProduct))} /{" "}
                    {getUnitMeta(viewProduct.unit).shortLabel}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1">
                <FileText size={12} /> الوصف
              </div>
              <div className="rounded-2xl border border-border bg-soft/50 p-4 min-h-[60px]">
                <p className="text-sm font-bold leading-relaxed text-main whitespace-pre-wrap">
                  {viewProduct.description || "لا يوجد وصف."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-soft border border-border p-3">
                <div className="text-[9px] font-black text-muted uppercase mb-1">
                  حد الإنذار
                </div>
                <div className="font-black text-main">
                  {formatNumber(viewProduct.min_quantity_alert || 0)}{" "}
                  {getUnitMeta(viewProduct.unit).shortLabel}
                </div>
                <div
                  className={cn(
                    "text-[10px] font-bold mt-1",
                    Number(viewProduct.quantity) <=
                      Number(viewProduct.min_quantity_alert)
                      ? "text-rose-600"
                      : "text-emerald-600",
                  )}
                >
                  {Number(viewProduct.quantity) <=
                  Number(viewProduct.min_quantity_alert)
                    ? "• منخفض - يحتاج توريد"
                    : "• مستقر"}
                </div>
              </div>
              <div className="rounded-xl bg-soft border border-border p-3">
                <div className="text-[9px] font-black text-muted uppercase mb-1">
                  سعة العبوة
                </div>
                <div className="font-black text-main">
                  {viewProduct.weight
                    ? `${formatNumber(viewProduct.weight)} ${getUnitMeta(viewProduct.unit).shortLabel}`
                    : "---"}
                </div>
                <div className="text-[10px] font-bold text-muted mt-1">
                  معرف: #{viewProduct.id}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Eye size={14} />
              </div>
              <p className="text-[11px] font-bold leading-relaxed text-amber-800">
                عرض قراءة فقط - لا يمكن التعديل من هنا. استخدم زر{" "}
                <span className="underline">تعديل</span> في صفحة المخزون إذا كنت
                مالكاً.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1 h-11 rounded-xl font-black"
              >
                إغلاق
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onOpenHistory(viewProduct);
                }}
                className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black"
              >
                <History size={14} className="ml-2" /> سجل الحركات
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center text-muted font-bold">
            جاري التحميل...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProductDetailsModal;
