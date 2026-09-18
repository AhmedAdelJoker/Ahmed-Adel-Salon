/** Catalog ServiceFormModal (moved from ServicesManagement page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRecord, ProductRecord, ServiceFormData, ServiceIngredient, ServiceRecord } from "@/types/catalog";

export default function ServiceFormModal({
  open,
  onOpenChange,
  editing,
  formData,
  setFormData,
  categories,
  products,
  isActionLoading,
  onSubmit,
  onAddIngredient,
  onRemoveIngredient,
  onUpdateIngredient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ServiceRecord | null;
  formData: ServiceFormData;
  setFormData: Dispatch<SetStateAction<ServiceFormData>>;
  categories: CategoryRecord[];
  products: ProductRecord[];
  isActionLoading: boolean;
  onSubmit: () => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (index: number) => void;
  onUpdateIngredient: (index: number, field: string, value: unknown) => void;
}) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[620px] bg-card border-border"
        >
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-black text-main">
              {editing
                ? "تعديل بيانات الخدمة"
                : "إضافة خدمة جديدة للكتالوج"}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted">
              قم بملء تفاصيل الخدمة والأسعار والمواد المستهلكة من المخزون بدقة.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4 max-h-[60vh] overflow-y-auto pl-2 custom-scrollbar">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  اسم الخدمة (عربي)
                </label>
                <Input
                  value={formData.name_ar}
                  onChange={(e) =>
                    setFormData({ ...formData, name_ar: e.target.value })
                  }
                  placeholder="مثال: حلاقة شعر وتصفيف مميز"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  السعر (ج.م)
                </label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  المدة المتوقعة (بالدقائق)
                </label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration_minutes: Number(e.target.value),
                    })
                  }
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  تصنيف الفئة
                </label>
                <Select
                  value={formData.category_id}
                  onValueChange={(val) => {
                    const found = categories.find(
                      (c) => (c.id?.toString() ?? "") === val,
                    );
                    setFormData({
                      ...formData,
                      category_id: val,
                      category: found?.name || "",
                    });
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border">
                    <SelectValue placeholder="اختر التصنيف الفني" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {categories.map((c) => (
                      <SelectItem key={c.id ?? ""} value={c.id?.toString() ?? ""}>
                        {c.name_ar || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Link Ingredients / Products */}
            <div className="space-y-3 border-t border-border/40 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-muted uppercase tracking-wider">
                  ربط استهلاك المواد والمنتجات (المخزون التشغيلي)
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddIngredient}
                  className="h-9 rounded-xl px-3 font-bold text-xs"
                >
                  <Plus size={14} className="ml-1.5" /> إضافة منتج مستهلك
                </Button>
              </div>

              {(formData.ingredients as ServiceIngredient[]).map((ing, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-soft p-3 rounded-xl border border-border/30"
                >
                  <div className="flex-1">
                    <Select
                      value={ing.product_id?.toString()}
                      onValueChange={(val) =>
                        onUpdateIngredient(idx, "product_id", val)
                      }
                    >
                      <SelectTrigger className="h-10 rounded-lg border-border text-xs">
                        <SelectValue placeholder="اختر المنتج المستهلك" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {products.map((p) => (
                          <SelectItem key={p.id?.toString()} value={p.id?.toString() || ""}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      placeholder="الكمية المستهلكة"
                      value={ing.amount_used}
                      onChange={(e) =>
                        onUpdateIngredient(idx, "amount_used", e.target.value)
                      }
                      className="h-10 rounded-lg text-xs text-center"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveIngredient(idx)}
                    className="h-10 w-10 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
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
              حفظ وتأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
