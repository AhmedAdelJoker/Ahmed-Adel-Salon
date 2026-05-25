import { useAuth } from "../../context/AuthContext";
import { useEffect } from 'react';
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
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
      <DialogContent className="max-w-md rounded-3xl" dir="rtl">
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

          {description ? (
            <DialogDescription className="text-sm font-bold leading-relaxed text-muted">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <DialogFooter className="gap-3 sm:justify-start">
          <Button
            type="button"
            variant="secondary"
            disabled={loading} onClick={handleCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={isDanger ? "danger" : "primary"}
            disabled={loading} onClick={onConfirm}
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


