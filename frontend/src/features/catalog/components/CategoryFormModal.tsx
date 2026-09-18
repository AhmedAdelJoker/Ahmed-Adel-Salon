/** Catalog CategoryFormModal (moved from ServicesManagement page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CategoryFormData, CategoryRecord } from "@/types/catalog";

export default function CategoryFormModal({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  isActionLoading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CategoryRecord | null;
  form: CategoryFormData;
  setForm: Dispatch<SetStateAction<CategoryFormData>>;
  isActionLoading: boolean;
  onSubmit: () => void;
}) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border">
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-black text-main">
              {editing ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-main">
                اسم التصنيف (عربي)
              </label>
              <Input
                value={form.name_ar}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name_ar: e.target.value,
                    name: e.target.value,
                  })
                }
                placeholder="مثال: عناية بالبشرة والوجه"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-main">
                ترتيب الأولوية في العرض
              </label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sort_order: parseInt(e.target.value) || 0,
                  })
                }
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/40 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-xl font-bold"
            >
              إلغاء
            </Button>
            <Button
              onClick={onSubmit}
              loading={isActionLoading}
              className="h-11 rounded-xl px-6 font-black"
            >
              حفظ التصنيف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
