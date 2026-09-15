import type { Dispatch, SetStateAction } from "react";
import type { UsersViewUser } from "@/features/users/components/UsersViewContent";
import { Fingerprint, Lock, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/core/utils";

export interface UserFormData {
  username: string;
  password: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  permissions: Record<string, boolean>;
}

export interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: UsersViewUser | null;
  formData: UserFormData;
  setFormData: Dispatch<SetStateAction<UserFormData>>;
  onSubmit: () => void;
  isActionLoading: boolean;
}

export function UserFormModal({
  open,
  onOpenChange,
  editingUser,
  formData,
  setFormData,
  onSubmit,
  isActionLoading,
}: UserFormModalProps) {
  return (
    <>
      {/* Premium Modal: Edit/Add User */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[600px] p-0 overflow-hidden border-none bg-card shadow-premium rounded-[2.5rem]"
          dir="rtl"
        >
          <div className="px-10 py-8 border-b border-border/40 bg-[#020617] relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-full h-full bg-primary/10 blur-[100px] pointer-events-none" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-primary shadow-2xl">
                <UserIcon size={32} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">
                  {editingUser
                    ? "تخصيص الهوية الأمنية"
                    : "إصدار هوية وصول جديدة"}
                </DialogTitle>
                <p className="text-xs text-white/50 mt-1 font-bold">
                  إدارة بيانات الوصول والبيانات الأساسية للموظف بدقة.
                </p>
              </div>
            </div>
          </div>

          <div className="p-10 space-y-8 bg-card">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                  معرف الدخول
                </label>
                <div className="relative group">
                  <Fingerprint
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
                    size={16}
                  />
                  <Input
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="h-12 pl-4 pr-12 rounded-xl bg-soft border-border focus:bg-white focus:border-primary font-black shadow-sm"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                  كلمة المرور
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
                    size={16}
                  />
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="h-12 pl-4 pr-12 rounded-xl bg-soft border-border focus:bg-white focus:border-primary font-black shadow-sm"
                    placeholder={
                      editingUser
                        ? "اتركه فارغاً للاحتفاظ بالقديمة"
                        : "••••••••"
                    }
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                الاسم الكامل للموظف
              </label>
              <div className="relative group">
                <UserIcon
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
                  size={16}
                />
                <Input
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="الاسم كما يظهر في النظام"
                  className="h-12 pl-4 pr-12 rounded-xl bg-soft border-border focus:bg-white focus:border-primary font-black shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                  الرتبة الوظيفية
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="premium-native-select w-full h-12 bg-soft border border-border rounded-xl px-5 text-sm font-black focus:border-primary focus:bg-white outline-none appearance-none text-right cursor-pointer shadow-sm transition-all"
                >
                  <option value="OWNER">المالك (Owner)</option>
                  <option value="ADMIN">مسؤول (Admin)</option>
                  <option value="MANAGER">مدير (Manager)</option>
                  <option value="CASHIER">كاشير (Cashier)</option>
                  <option value="ACCOUNTANT">محاسب (Accountant)</option>
                  <option value="BARBER">حلاق (Barber)</option>
                </select>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                  حالة الوصول
                </label>
                <div className="h-12 flex items-center justify-between px-5 border border-border rounded-xl bg-soft shadow-sm">
                  <span
                    className={cn(
                      "text-xs font-black uppercase tracking-tighter",
                      formData.is_active ? "text-emerald-600" : "text-rose-500",
                    )}
                  >
                    {formData.is_active ? "نشط الآن" : "موقوف مؤقتاً"}
                  </span>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(val) =>
                      setFormData({ ...formData, is_active: val })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-10 py-6 bg-soft/30 border-t border-border/40 gap-3 flex-row justify-end">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11 px-8 font-black text-muted hover:text-main transition-all"
            >
              إلغاء
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isActionLoading}
              className="rounded-xl h-11 px-10 bg-primary text-white hover:scale-[1.02] font-black shadow-lg shadow-primary/20 transition-all"
            >
              {isActionLoading ? "جاري الحفظ..." : "اعتماد الهوية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
