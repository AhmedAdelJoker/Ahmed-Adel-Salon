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
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
            </DialogTitle>
            <DialogDescription>
              أدخل اسم العميل ورقم الجوال. رقم إضافي اختياري.
            </DialogDescription>
          </DialogHeader>
          <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.name || ""}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="مثال: أحمد محمد"
                className="h-12 text-lg"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                رقم الجوال <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.phone || ""}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
                placeholder="010XXXXXXXX"
                dir="ltr"
                type="tel"
                className="h-12 text-lg"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                رقم إضافي (اختياري)
                <span className="text-xs font-normal text-slate-400 uppercase tracking-normal">
                  اختياري
                </span>
              </label>
              <Input
                value={form.phone2 || ""}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    phone2: event.target.value,
                  }))
                }
                placeholder="010XXXXXXXX"
                dir="ltr"
                type="tel"
                className="h-12 text-lg"
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={isSaving}
            >
              إلغاء
            </Button>
            <Button
              className="flex-1"
              disabled={loading}
              onClick={onSubmit}
              loading={isSaving}
            >
              {editing ? "حفظ التغييرات" : "إضافة العميل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
