import { Package, History, Eye, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("owner");
  const viewProduct = product;
  const unit = getUnitMeta(viewProduct?.unit);
  const isLow = viewProduct && Number(viewProduct.quantity) <= Number(viewProduct.min_quantity_alert);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-[2rem] border-0 bg-card p-0 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur">
                {viewProduct?.image_url ? (
                  <img
                    src={viewProduct.image_url.startsWith("http") ? viewProduct.image_url : `${staticBaseUrl}${viewProduct.image_url}`}
                    alt={viewProduct.name || ""}
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <Package size={22} className="text-white" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-black leading-tight text-white">{viewProduct?.name || "---"}</DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-300">{t("inventory.modal.detailsTitle")} — {t("inventory.modal.readOnly")}</DialogDescription>
              </div>
            </div>
            <Badge className={cn("shrink-0 rounded-full border-0 px-3 py-1 text-[10px] font-black", viewProduct?.is_archived ? "bg-slate-600 text-white" : "bg-emerald-500 text-white")}>
              {viewProduct?.is_archived ? t("inventory.archived") : t("inventory.activeTab")}
            </Badge>
          </div>
        </div>

        {viewProduct ? (
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                [t("inventory.modal.skuLabel"), viewProduct.sku || "---"],
                [t("inventory.modal.category"), viewProduct.category || "---"],
                [t("inventory.modal.company"), viewProduct.company_name || "---"],
                [t("inventory.modal.unitLabel"), `${unit.label} (${unit.shortLabel})`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-border/60 bg-soft p-4">
                  <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted">{label}</div>
                  <div className="truncate text-sm font-black text-main">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border bg-card p-3 text-center">
                <div className="text-[9px] font-black uppercase text-muted">{t("inventory.modal.balance")}</div>
                <div className="mt-1 text-sm font-black text-primary">{formatNumber(viewProduct.quantity || 0)} {unit.shortLabel}</div>
                {viewProduct.weight ? <div className="text-[10px] font-bold text-muted">{formatNumber(getAvailablePacks(viewProduct))} {t("inventory.modal.pack")}</div> : null}
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 text-center">
                <div className="text-[9px] font-black uppercase text-muted">{t("inventory.modal.sellPrice")}</div>
                <div className="mt-1 text-sm font-black text-success">{formatCurrency(viewProduct.sell_price || 0)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 text-center">
                <div className="text-[9px] font-black uppercase text-muted">{t("inventory.modal.cost")}</div>
                <div className="mt-1 text-sm font-black text-main">{formatCurrency(viewProduct.cost_price || 0)}</div>
                {viewProduct.weight ? <div className="text-[10px] font-bold text-muted">{formatCurrency(getEstimatedUnitCost(viewProduct))} / {unit.shortLabel}</div> : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted"><FileText size={12} /> {t("inventory.modal.description")}</div>
              <div className="min-h-[60px] rounded-2xl border border-border bg-soft/50 p-4">
                <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-main">{viewProduct.description || t("inventory.modal.noDescription")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border bg-soft p-3">
                <div className="mb-1 text-[9px] font-black uppercase text-muted">{t("inventory.modal.alertLimit")}</div>
                <div className="font-black text-main">{formatNumber(viewProduct.min_quantity_alert || 0)} {unit.shortLabel}</div>
                <div className={cn("mt-1 text-[10px] font-bold", isLow ? "text-rose-600" : "text-emerald-600")}>
                  {isLow ? `• ${t("inventory.modal.lowNeedsSupply")}` : `• ${t("inventory.stable")}`}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-soft p-3">
                <div className="mb-1 text-[9px] font-black uppercase text-muted">{t("inventory.modal.packCapacityLabel")}</div>
                <div className="font-black text-main">{viewProduct.weight ? `${formatNumber(viewProduct.weight)} ${unit.shortLabel}` : "---"}</div>
                <div className="mt-1 text-[10px] font-bold text-muted">{t("inventory.modal.idLabel", { id: viewProduct.id })}</div>
              </div>
            </div>

            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white"><Eye size={14} /></div>
              <p className="text-[11px] font-bold leading-relaxed text-amber-800">{t("inventory.modal.readOnlyNote")}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={() => onOpenChange(false)} variant="outline" className="h-11 flex-1 rounded-xl font-black">{t("inventory.modal.close")}</Button>
              <Button onClick={() => { onOpenChange(false); if (viewProduct) onOpenHistory(viewProduct); }} className="h-11 flex-1 rounded-xl bg-slate-900 font-black text-white hover:bg-slate-800">
                <History size={14} className="me-2" /> {t("inventory.modal.movementLog")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center font-bold text-muted">{t("inventory.modal.loading")}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProductDetailsModal;
