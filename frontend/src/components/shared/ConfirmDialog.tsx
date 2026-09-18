import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { AlertTriangle, Info } from "lucide-react";

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  variant = "danger",
  loading = false,
}) => {
  const isDanger = variant === "danger";

  const handleCancel = () => {
    if (!loading) onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader className="text-right">
          <div
            className={`mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border ${
              isDanger
                ? "border-danger-border bg-danger-bg text-danger"
                : "border-info-border bg-info-bg text-info"
            }`}
          >
            {isDanger ? <AlertTriangle size={24} /> : <Info size={24} />}
          </div>

          <DialogTitle className="text-xl font-black text-main">
            {title || "تأكيد الإجراء"}
          </DialogTitle>

          <DialogDescription
            className={cn(
              "text-sm font-bold leading-relaxed text-muted",
              !description && "sr-only",
            )}
          >
            {description || "تأكيد تنفيذ هذا الإجراء"}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-3 sm:justify-start">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={handleCancel}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={isDanger ? "danger" : "primary"}
            disabled={loading}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDialog;
