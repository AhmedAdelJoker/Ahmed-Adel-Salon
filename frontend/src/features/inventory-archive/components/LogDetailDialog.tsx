import {
  ArrowLeftRight,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Hash,
  Package,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import { formatTimeOnly } from "@/features/inventory-archive/utils";
import type { InventoryLog, ProductMini } from "@/features/inventory-archive/types";

interface LogDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: InventoryLog | null;
  product?: ProductMini;
  staticBaseUrl: string;
  onGoInventory: () => void;
}

export function LogDetailDialog({
  open,
  onOpenChange,
  log,
  product,
  staticBaseUrl,
  onGoInventory,
}: LogDetailDialogProps) {
  const { t } = useTranslation("owner");
  const type = log?.type || "";
  const meta =
    type === "add"
      ? { label: t("inventoryArchive.add"), badgeVariant: "success" as const }
      : type === "remove"
        ? { label: t("inventoryArchive.remove"), badgeVariant: "danger" as const }
        : { label: t("inventoryArchive.adjust"), badgeVariant: "info" as const };

  const image =
    product?.image_url && !product.image_url.startsWith("http")
      ? `${staticBaseUrl}${product.image_url}`
      : product?.image_url || null;

  const creatorName =
    log?.created_by_name && String(log.created_by_name).trim()
      ? String(log.created_by_name)
      : log?.created_by_user_id != null
        ? t("inventoryArchive.creatorUser", { id: log.created_by_user_id })
        : t("inventoryArchive.creatorSystem");

  const typeTitle =
    type === "add"
      ? t("inventoryArchive.typeAddTitle")
      : type === "remove"
        ? t("inventoryArchive.typeRemoveTitle")
        : t("inventoryArchive.typeAdjustTitle");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl border-border bg-card p-0 shadow-premium">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-strong p-5 text-white">
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                <FileText size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white">{t("inventoryArchive.detailTitle")}</DialogTitle>
                <DialogDescription className="text-xs font-bold text-white/75">{t("inventoryArchive.detailReadOnly")}</DialogDescription>
              </div>
            </div>
            <Badge variant={meta.badgeVariant} className="shrink-0 rounded-full border-0 bg-white px-3 py-1 text-[10px] font-black text-main">
              {meta.label}
            </Badge>
          </div>
          {log && (
            <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-white/80 tabular-nums">
              <span className="inline-flex items-center gap-1"><Hash size={12} />{t("inventoryArchive.movementNo", { id: log.id })}</span>
              <span className="inline-flex items-center gap-1"><Calendar size={12} />{formatDateTime(log.created_at)}</span>
            </div>
          )}
        </div>

        {log ? (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-soft/40 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
                {image ? (
                  <img
                    src={image}
                    alt={product?.name || ""}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <Package size={18} className="text-muted" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-main">{product?.name || t("inventoryArchive.unknownProduct", { id: log.product_id })}</div>
                <div className="truncate text-[11px] font-bold text-muted">{product?.category || t("inventoryArchive.unknownCategory")}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted"><Clock size={12} /> {t("inventoryArchive.qtyChange")}</div>
                <div className={cn("text-xl font-black tabular-nums", Number(log.change_amount) > 0 ? "text-success" : Number(log.change_amount) < 0 ? "text-danger" : "text-main")}>
                  {Number(log.change_amount) > 0 ? "+" : ""}{formatNumber(log.change_amount)}
                </div>
                <div className="mt-1 text-[10px] font-bold text-muted">{t("inventoryArchive.unit")}: {product?.unit || log.product_unit || "—"}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-muted">{t("inventoryArchive.operationType")}</div>
                <div className="text-sm font-black text-main">{typeTitle}</div>
                {log.stock_before != null && log.stock_after != null && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-muted tabular-nums">
                    <ArrowLeftRight size={11} /> {formatNumber(log.stock_before)} → {formatNumber(log.stock_after)}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted"><FileText size={12} /> {t("inventoryArchive.notes")}</div>
              <div className="min-h-[64px] rounded-xl border border-border bg-soft/30 p-3 text-sm font-medium leading-relaxed text-main whitespace-pre-wrap">
                {log.note || t("inventoryArchive.noNotes")}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-[10px] font-black uppercase text-muted">{t("inventoryArchive.createdAt")}</div>
                <div className="mt-1 font-black text-main tabular-nums">{formatDate(log.created_at)}</div>
                <div className="text-[10px] font-bold text-muted tabular-nums">{formatTimeOnly(log.created_at)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-[10px] font-black uppercase text-muted">{t("inventoryArchive.createdBy")}</div>
                <div className="mt-1 flex items-center gap-1.5 font-black text-main"><User size={12} className="text-muted" />{creatorName}</div>
              </div>
            </div>

            <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-[11px] font-bold text-warning">
              {t("inventoryArchive.readOnlyHint")}
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={() => onOpenChange(false)} variant="outline" className="h-10 flex-1 rounded-xl font-bold">{t("inventoryArchive.close")}</Button>
              <Button onClick={onGoInventory} className="h-10 flex-1 rounded-xl font-bold">{t("inventoryArchive.openInventory")} <ExternalLink size={14} className="ms-1.5" /></Button>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center font-bold text-muted">{t("inventoryArchive.loading")}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
