/** Catalog OfferFormModal (moved from ServicesManagement page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
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
import type { OfferFormData, OfferRecord, ServiceRecord } from "@/types/catalog";

export default function OfferFormModal({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  services,
  isActionLoading,
  onSubmit,
  onToggleService,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: OfferRecord | null;
  form: OfferFormData;
  setForm: Dispatch<SetStateAction<OfferFormData>>;
  services: ServiceRecord[];
  isActionLoading: boolean;
  onSubmit: () => void;
  onToggleService: (sid: number | string) => void;
}) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[520px] bg-card border-border"
          dir="rtl"
        >
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-black text-main">
              {editing ? "تعديل باقة العرض" : "إنشاء باقة عرض جديدة"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              إنشاء عروض ترويجية تجمع عدة خدمات بسعر مخفض للعملاء.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pl-2 custom-scrollbar">
            <div className="space-y-2">
              <label className="text-xs font-black text-main">
                اسم العرض الترويجي
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
                placeholder="مثال: عرض الصيف الذهبي المتكامل"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  سعر العرض (ج.م)
                </label>
                <Input
                  type="number"
                  value={form.offer_price}
                  onChange={(e) =>
                    setForm({ ...form, offer_price: e.target.value })
                  }
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  السعر الأصلي للمقارنة
                </label>
                <Input
                  type="number"
                  value={form.original_price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      original_price: e.target.value,
                    })
                  }
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  تاريخ بداية العرض
                </label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  تاريخ انتهاء العرض
                </label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                  className="h-11 rounded-xl text-right"
                />
              </div>
            </div>
            <div className="space-y-2 border-t border-border/40 pt-4">
              <label className="text-xs font-black text-muted block mb-2">
                اختر الخدمات المشمولة داخل هذا العرض:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-border p-3 rounded-xl bg-soft custom-scrollbar">
                {services.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2.5 text-xs font-bold p-1.5 cursor-pointer hover:bg-card rounded-lg transition-colors text-main"
                  >
                    <input
                      type="checkbox"
                      checked={form.service_ids.includes(s.id as number | string)}
                      onChange={() => s.id && onToggleService(s.id as number | string)}
                      className="rounded accent-accent h-4 w-4"
                    />
                    {s.name_ar || s.name}
                  </label>
                ))}
              </div>
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
              تفعيل ونشر العرض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
