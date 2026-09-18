import {
  Calendar,
  Clock,
  ExternalLink,
  Eye,
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
import { getLogTypeMeta } from "@/features/inventory-archive/constants";
import { formatTimeOnly, resolveCreatorName, resolveProductImage } from "@/features/inventory-archive/utils";
import type {
  InventoryLog,
  ProductMini,
} from "@/features/inventory-archive/types";

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
  const meta = getLogTypeMeta(log?.type || "");
  const image = resolveProductImage(product?.image_url, staticBaseUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-[2rem] border-border p-0 overflow-hidden bg-card shadow-premium"
      >
        <div className="bg-gradient-to-br from-primary to-primary-strong p-6 text-white relative overflow-hidden">
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
          <div className="absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/10">
                <FileText size={22} className="text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white">
                  تفاصيل الحركة
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-white/70">
                  عرض قراءة فقط - بدون تعديل
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant={meta.badgeVariant}
              className="rounded-full px-3 py-1 text-[10px] font-black border-0 bg-white text-main shrink-0"
            >
              {meta.label}
            </Badge>
          </div>
          {log && (
            <div className="relative mt-4 flex items-center gap-2 text-[11px] font-bold tabular-nums text-white/70">
              <Hash size={12} />
              <span>رقم الحركة #{log.id}</span>
              <span className="mx-1">•</span>
              <Calendar size={12} />
              <span>{formatDateTime(log.created_at)}</span>
            </div>
          )}
        </div>

        {log ? (
          <div className="p-6 space-y-5">
            <div className="rounded-2xl border border-border bg-soft/50 p-4 flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-card border border-border flex items-center justify-center overflow-hidden shrink-0">
                {image ? (
                  <img
                    src={image}
                    alt={product?.name || `صنف #${log.product_id}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package size={20} className="text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-main truncate">
                  {product?.name || `صنف #${log.product_id}`}
                </div>
                <div className="text-[11px] font-bold text-muted truncate">
                  {product?.category || "غير مصنف"} •{" "}
                  {product?.company_name || "---"}
                </div>
                <div className="text-[10px] font-bold text-muted">
                  معرف الصنف: #{log.product_id}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-soft border border-border/60 p-4">
                <div className="flex items-center gap-2 text-[9px] font-black text-muted uppercase tracking-widest mb-2">
                  <Clock size={12} /> الكمية المتغيرة
                </div>
                <div
                  className={cn(
                    "text-xl font-black",
                    log.change_amount > 0
                      ? "text-success"
                      : log.change_amount < 0
                        ? "text-danger"
                        : "text-main",
                  )}
                >
                  {log.change_amount > 0 ? "+" : ""}
                  {formatNumber(log.change_amount)}
                </div>
                <div className="text-[10px] font-bold text-muted mt-1">
                  الوحدة: {product?.unit || "---"}
                  {log.stock_before !== null &&
                    log.stock_before !== undefined &&
                    log.stock_after !== null &&
                    log.stock_after !== undefined && (
                      <span className="tabular-nums">
                        {" • الرصيد: "}
                        {formatNumber(log.stock_before)}
                        <span className="mx-0.5">←</span>
                        {formatNumber(log.stock_after)}
                      </span>
                    )}
                </div>
              </div>
              <div className="rounded-2xl bg-soft border border-border/60 p-4">
                <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">
                  نوع العملية
                </div>
                <div className="text-sm font-black text-main">
                  {log.type === "add"
                    ? "إضافة مخزون (توريد)"
                    : log.type === "remove"
                      ? "صرف مخزون"
                      : "تعديل يدوي"}
                </div>
                <div className="text-[10px] font-bold text-muted mt-1">
                  النوع: {log.type}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1">
                <FileText size={12} /> الملاحظات / التفاصيل
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 min-h-[70px]">
                <p className="text-sm font-bold leading-relaxed text-main whitespace-pre-wrap">
                  {log.note || "لا توجد ملاحظات إضافية لهذه الحركة."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-soft border border-border p-3">
                <div className="text-[9px] font-black text-muted uppercase mb-1">
                  تاريخ الإنشاء
                </div>
                <div className="font-black tabular-nums text-main flex items-center gap-1.5">
                  <Calendar size={12} className="text-muted" />
                  {formatDate(log.created_at)}
                </div>
                <div className="text-[10px] font-bold tabular-nums text-muted mt-0.5">
                  {formatTimeOnly(log.created_at)}
                </div>
              </div>
              <div className="rounded-xl bg-soft border border-border p-3">
                <div className="text-[9px] font-black text-muted uppercase mb-1">
                  المنشئ
                </div>
                <div className="font-black text-main flex items-center gap-1.5">
                  <User size={12} className="text-muted" />
                  {resolveCreatorName(log)}
                </div>
                <div className="text-[10px] font-bold text-success mt-1">
                  • قراءة فقط - لا يمكن التعديل من الأرشيف
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-warning-soft border border-warning/20 p-3 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-warning text-white flex items-center justify-center shrink-0">
                <Eye size={14} />
              </div>
              <p className="text-[11px] font-bold leading-relaxed text-warning">
                هذا العرض للقراءة فقط. لإجراء أي تعديل أو توريد جديد يرجى
                العودة لصفحة <span className="underline">إدارة المستودع</span>.
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
              <Button onClick={onGoInventory} className="flex-1 h-11 rounded-xl font-black">
                الذهاب للمخزون <ExternalLink size={14} className="mr-2" />
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
