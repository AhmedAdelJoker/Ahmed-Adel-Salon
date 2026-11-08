/** Customers CustomerDeleteDialog (moved from Customers page, no logic changes). */
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { customerName } from "@/features/customers/utils/customer";

export default function CustomerDeleteDialog({
  open,
  onOpenChange,
  customer,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("customers");
  return (
      <Dialog
        open={!!customer}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete.title")}</DialogTitle>
            <DialogDescription>
              {t("delete.description", {
                name: customer ? customerName(customer) : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => onClose()}
              aria-label={t("delete.cancel")}
            >
              {t("delete.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={loading}
              onClick={onConfirm}
              aria-label={t("delete.confirm")}
            >
              {t("delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}