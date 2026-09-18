import { ShieldCheck, Shield, User, Phone, Lock, Award, Save } from "lucide-react";
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
import type { PermissionsFormData } from "@/features/permissions/hooks/usePermissions";
import type { ManagedUser } from "@/types/employee";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingUser: ManagedUser | null;
  formData: PermissionsFormData;
  setFormData: React.Dispatch<React.SetStateAction<PermissionsFormData>>;
  isActionLoading: boolean;
  loading: boolean;
  onSubmit: () => void;
};

export default function PermissionsModal({
  open,
  onOpenChange,
  editingUser,
  formData,
  setFormData,
  isActionLoading,
  loading,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl rounded-[32px] border-border bg-card p-0 shadow-premium overflow-hidden"
        dir="rtl"
      >
        <DialogHeader className="p-10 pb-6 bg-[#1B1714] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -mr-32 -mt-32" />
          <div className="relative z-10 space-y-2">
            <DialogTitle className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-4 leading-none">
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg">
                <Shield size={24} />
              </div>
              {editingUser ? "تحديث الهوية الأمنية" : "إصدار اعتماد أمني"}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-white/50 uppercase tracking-widest">
              تخصيص مستويات الوصول الرقمي وضمان النزاهة الإدارية للمنظومة
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                الاسم القانوني الموثق
              </label>
              <div className="relative group">
                <User
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                  size={18}
                />
                <Input
                  className="h-14 rounded-xl pr-12 font-bold bg-soft border-border text-main focus:bg-white text-base"
                  value={formData.fullName || ""}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="الاسم الثلاثي أو الرباعي..."
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                قناة التواصل الرسمية
              </label>
              <div className="relative group">
                <Phone
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                  size={18}
                />
                <Input
                  className="h-14 rounded-xl pr-12 font-black bg-soft border-border text-main focus:bg-white text-lg tabular-nums"
                  dir="ltr"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                معرف الدخول (Username)
              </label>
              <div className="relative group">
                <Lock
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                  size={18}
                />
                <Input
                  className="h-14 rounded-xl pr-12 font-black bg-soft border-border text-main focus:bg-white text-base uppercase"
                  dir="ltr"
                  value={formData.username || ""}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                كلمة المرور (Encrypted)
              </label>
              <div className="relative group">
                <Shield
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                  size={18}
                />
                <Input
                  type="password"
                  placeholder={editingUser ? "••••••••••••" : "أدخل كلمة مرور قوية..."}
                  className="h-14 rounded-xl pr-12 font-black bg-soft border-border text-main focus:bg-white text-lg tracking-tighter"
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                رتبة الوصول (Security Role)
              </label>
              <Select
                value={formData.role || ""}
                onValueChange={(val) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-black text-xs uppercase focus:bg-white">
                  <SelectValue placeholder="تحديد الدور..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card shadow-premium">
                  <SelectItem value="BARBER" className="font-bold">
                    حلاق معتمد (Barber)
                  </SelectItem>
                  <SelectItem value="CASHIER" className="font-bold">
                    كاشير تشغيلي (Cashier)
                  </SelectItem>
                  <SelectItem value="MANAGER" className="font-bold">
                    مدير نظام (Manager)
                  </SelectItem>
                  {formData.role === "OWNER" && (
                    <SelectItem value="OWNER" className="font-black text-accent">
                      المالك المؤسس (Owner)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                التخصص الاستراتيجي
              </label>
              <div className="relative group">
                <Award
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                  size={18}
                />
                <Input
                  className="h-14 rounded-xl pr-12 font-bold bg-soft border-border text-main focus:bg-white text-base"
                  value={formData.specialty || ""}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="المهارة الفنية الأساسية..."
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="p-10 pt-6 border-t border-border bg-soft/10 flex gap-4">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl font-black uppercase tracking-widest h-14"
          >
            إلغاء الأمر
          </Button>
          <Button
            disabled={isActionLoading}
            onClick={onSubmit}
            variant="primary"
            className="flex-[2] rounded-xl font-black text-lg h-14 shadow-lg shadow-accent/20"
          >
            <Save size={20} className="ml-2" />
            {editingUser ? "اعتماد التعديلات الأمنية" : "إصدار الاعتماد الرقمي"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
