import { Box, Save, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/core/utils";
import {
  UNIT_OPTIONS,
  normalizeUnit,
} from "@/features/inventory/design-tokens";
import { FormField } from "@/features/inventory";
import {
  NATIVE_SELECT_CLASS,
  TEXTAREA_CLASS,
} from "@/features/inventory/components/inventoryClasses";
import type {
  InventoryProductAny,
  ProductFormData,
} from "@/features/inventory/hooks/useInventoryForm";

export interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: InventoryProductAny | null;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  uniqueCategories: string[];
  imagePreview: string | null;
  staticBaseUrl: string;
  onClearImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageFile: (file: File | null | undefined) => void;
  uploading: boolean;
  selectedUnitLabel: string;
  saving: boolean;
  onSave: () => void;
  isOwner: boolean;
}

export function ProductFormModal({
  open,
  onOpenChange,
  editingProduct,
  formData,
  setFormData,
  uniqueCategories,
  imagePreview,
  staticBaseUrl,
  onClearImage,
  fileInputRef,
  onImageFile,
  uploading,
  selectedUnitLabel,
  saving,
  onSave,
  isOwner,
}: ProductFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl rounded-2xl p-0 border-border bg-card shadow-premium sm:max-w-3xl sm:rounded-2xl"
      >
        <DialogHeader className="border-b border-border/40 p-4 pb-3 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 sm:h-10 sm:w-10 sm:rounded-xl">
              <Box size={16} className="text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-black sm:text-lg">
                {editingProduct ? "تحديث الصنف" : "إدراج صنف جديد"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-medium text-muted">
                بيانات الصنف الأساسية
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label={`اسم الصنف${editingProduct?.id && !isOwner ? " (المالك فقط)" : ""}`}
            >
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
                className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                placeholder="اسم المنتج..."
                disabled={!!editingProduct?.id && !isOwner}
              />
            </FormField>
            <FormField label="كود المنتج">
              <Input
                value={formData.sku}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, sku: e.target.value }))
                }
                className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
                placeholder="Barcode..."
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="الشركة المصنعة">
              <Input
                value={formData.company_name}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    company_name: e.target.value,
                  }))
                }
                className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
              />
            </FormField>
            <FormField label="التصنيف">
              <Input
                value={formData.category}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, category: e.target.value }))
                }
                list="category-list"
                className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
              />
              <datalist id="category-list">
                {uniqueCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </FormField>
          </div>
          <FormField label="صور المنتج">
            <div className="flex items-center gap-3">
              {imagePreview ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border sm:h-20 sm:w-20">
                  <img
                    src={
                      imagePreview.startsWith("http")
                        ? imagePreview
                        : `${staticBaseUrl}${imagePreview}`
                    }
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={onClearImage}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-soft sm:h-20 sm:w-20">
                  <Camera size={20} className="text-muted" />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImageFile(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg text-[10px] font-black"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading
                    ? "جاري الرفع..."
                    : imagePreview
                      ? "تغيير الصورة"
                      : "رفع صورة"}
                </Button>
                <p className="mt-1 text-[8px] font-bold text-muted">
                  JPG, PNG, WEBP - حد أقصى 20 ميجا
                </p>
              </div>
            </div>
          </FormField>
          <FormField label="الوصف">
            <textarea
              className={cn(TEXTAREA_CLASS)}
              value={formData.description}
              onChange={(e) =>
                setFormData((p) => ({ ...p, description: e.target.value }))
              }
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="وحدة القياس">
              <select
                value={normalizeUnit(formData.unit)}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, unit: e.target.value }))
                }
                className={NATIVE_SELECT_CLASS}
              >
                {UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="سعر البيع">
              <div className="relative">
                <Input
                  type="number"
                  value={formData.sell_price}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      sell_price: e.target.value,
                    }))
                  }
                  className="h-10 rounded-xl bg-soft border-border font-black text-success pl-10 sm:h-12 sm:pl-12"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:left-4">
                  ج.م
                </span>
              </div>
            </FormField>
            <FormField label="تكلفة العبوة">
              <div className="relative">
                <Input
                  type="number"
                  value={formData.cost_price}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      cost_price: e.target.value,
                    }))
                  }
                  className="h-10 rounded-xl bg-soft border-border font-black pl-10 sm:h-12 sm:pl-12"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted sm:left-4">
                  ج.م
                </span>
              </div>
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={`سعة العبوة (${selectedUnitLabel})`}>
              <Input
                type="number"
                value={formData.weight}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, weight: e.target.value }))
                }
                className="h-10 rounded-xl bg-soft border-border font-bold sm:h-12"
              />
            </FormField>
            <FormField label="حد الإنذار">
              <Input
                type="number"
                value={formData.min_quantity_alert}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    min_quantity_alert: Number(e.target.value),
                  }))
                }
                className="h-10 rounded-xl bg-soft border-danger/30 text-danger font-bold sm:h-12"
              />
            </FormField>
          </div>
        </div>
        <DialogFooter className="border-t border-border bg-soft/20 p-4 gap-2 sm:p-5">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl px-5 text-xs"
          >
            إلغاء
          </Button>
          <Button
            loading={saving}
            onClick={onSave}
            className="h-10 rounded-xl px-6 text-xs"
          >
            <Save size={14} className="ml-1.5" />{" "}
            {editingProduct ? "حفظ" : "إدراج"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProductFormModal;
