/** Customers CustomerFormDialog (moved from Customers page, no logic changes). */
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

export default function CustomerFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  loading,
  isSaving,
  onSubmit,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any;
  form: any;
  setForm: Dispatch<SetStateAction<any>>;
  loading: boolean;
  isSaving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("customers");
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("form.editTitle") : t("form.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("form.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {t("form.nameLabel")} <span className="text-red-500">{t("form.nameRequired")}</span>
              </label>
              <Input
                value={form.name || ""}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder={t("form.namePlaceholder")}
                className="h-12 text-lg"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {t("form.phoneLabel")} <span className="text-red-500">{t("form.nameRequired")}</span>
              </label>
              <Input
                value={form.phone || ""}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    phone: event.target.value.slice(0, 11),
                  }))
                }
                placeholder="010XXXXXXXX"
                dir="ltr"
                type="tel"
                className="h-12 text-lg"
                inputMode="numeric"
                maxLength={11}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                {t("form.secondPhoneLabel")}
              </label>
              <Input
                value={form.phone2 || ""}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    phone2: event.target.value.slice(0, 11),
                  }))
                }
                placeholder="010XXXXXXXX"
                dir="ltr"
                type="tel"
                className="h-12 text-lg"
                inputMode="numeric"
                maxLength={11}
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={isSaving}
              aria-label={t("form.cancel")}
            >
              {t("form.cancel")}
            </Button>
            <Button
              className="flex-1"
              disabled={loading}
              onClick={onSubmit}
              loading={isSaving}
              aria-label={editing ? t("form.saveEdit") : t("form.create")}
            >
              {editing ? t("form.saveEdit") : t("form.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}