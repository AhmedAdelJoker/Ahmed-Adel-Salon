/** Customers CustomerEditDialog (moved from CustomerDetail page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
import { Edit3, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CustomerEditDialog({
  open,
  onOpenChange,
  form,
  setForm,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: any;
  setForm: Dispatch<SetStateAction<any>>;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
            <DialogHeader className="p-5 pb-3 border-b border-border/40">
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <Edit3 size={16} className="text-primary" /> تعديل بيانات العميل
              </DialogTitle>
            </DialogHeader>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    الاسم الأول *
                  </label>
                  <Input
                    value={form.first_name}
                    onChange={(e) =>
                      setForm({ ...form, first_name: e.target.value })
                    }
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    اسم العائلة
                  </label>
                  <Input
                    value={form.last_name}
                    onChange={(e) =>
                      setForm({ ...form, last_name: e.target.value })
                    }
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الهاتف *
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  هاتف بديل
                </label>
                <Input
                  value={form.phone2}
                  onChange={(e) =>
                    setForm({ ...form, phone2: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  البريد الإلكتروني
                </label>
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  dir="ltr"
                  type="email"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  ملاحظات
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  className="w-full h-20 rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none focus:border-primary focus:ring-0"
                />
              </div>
            </div>
            <DialogFooter className="p-5 pt-3 border-t border-border/40 gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 flex-1 rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={onSave}
                loading={isSaving}
                className="h-10 flex-1 rounded-xl text-xs"
              >
                <Save size={14} className="ml-1.5" /> حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );
}
