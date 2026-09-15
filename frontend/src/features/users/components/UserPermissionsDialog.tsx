import type { ComponentType } from "react";
import type { UserFormData } from "@/features/users/components/UserFormModal";
import {
  Shield,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/core/utils";

export interface PermissionPageItem {
  id: string;
  label: string;
  category: string;
  icon?: ComponentType<{ size?: string | number; className?: string }>;
}

export interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: UserFormData;
  permissionPages: PermissionPageItem[];
  getRolePermission: (role: string, pageId: string) => boolean;
  onTogglePermission: (pageId: string) => void;
  onSubmit: () => void;
  isActionLoading: boolean;
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  formData,
  permissionPages,
  getRolePermission,
  onTogglePermission,
  onSubmit,
  isActionLoading,
}: UserPermissionsDialogProps) {
  return (
    <>
      {/* Premium Permissions Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[950px] p-0 overflow-hidden border-none bg-card shadow-premium rounded-[3rem]"
          dir="rtl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-10 py-10 bg-[#020617] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] -mr-[200px] -mt-[200px] pointer-events-none" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-primary shadow-2xl">
                <ShieldCheck size={32} />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black tracking-tight">
                  بروتوكولات الوصول المشفرة
                </DialogTitle>
                <DialogDescription className="text-sm font-bold text-white/40 mt-1">
                  تخصيص مصفوفة الصلاحيات لـ:{" "}
                  {formData.full_name || formData.username}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="relative z-10 border-white/10 bg-white/5 text-white backdrop-blur-md px-5 py-2.5 font-black tracking-[0.2em] uppercase rounded-2xl shadow-inner"
            >
              LEVEL: {formData.role}
            </Badge>
          </div>

          <div className="p-10 max-h-[65vh] overflow-y-auto bg-card relative custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
              {["نظام", "تشغيل", "مالية", "إدارة", "تقارير", "لوحات"].map(
                (cat) => {
                  const pages = permissionPages.filter(
                    (p) => p.category === cat,
                  );
                  if (pages.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-6">
                      <div className="flex items-center gap-4 border-b border-border/40 pb-4">
                        <div className="h-2 w-8 rounded-full bg-primary shadow-lg shadow-primary/20" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-muted">
                          {cat}
                        </h4>
                      </div>
                      <div className="grid gap-3">
                        {pages.map((page) => {
                          const state = formData.permissions[page.id];
                          const Icon = page.icon || Shield;
                          const role = formData.role?.toUpperCase();
                          const isDefaultAllowed =
                            getRolePermission(role, page.id);

                          return (
                            <button
                              key={page.id}
                              onClick={() => onTogglePermission(page.id)}
                              className={cn(
                                "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 text-right group",
                                state === true
                                  ? "bg-emerald-500/5 border-emerald-500/20 shadow-soft"
                                  : state === false
                                    ? "bg-rose-500/5 border-rose-500/20 shadow-soft"
                                    : isDefaultAllowed
                                      ? "bg-primary/5 border-primary/10 border-dashed"
                                      : "bg-soft/40 border-transparent hover:border-border hover:bg-soft",
                              )}
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div
                                  className={cn(
                                    "h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm shrink-0",
                                    state === true
                                      ? "text-emerald-600 bg-white border border-emerald-100 scale-110"
                                      : state === false
                                        ? "text-rose-600 bg-white border border-rose-100 scale-110"
                                        : isDefaultAllowed
                                          ? "text-primary bg-white border border-primary/20"
                                          : "text-muted bg-white border border-border group-hover:scale-105",
                                  )}
                                >
                                  <Icon size={20} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span
                                    className={cn(
                                      "text-sm font-black transition-colors leading-tight truncate",
                                      state !== undefined
                                        ? "text-main"
                                        : isDefaultAllowed
                                          ? "text-primary"
                                          : "text-muted group-hover:text-main",
                                    )}
                                  >
                                    {page.label}
                                  </span>
                                  <span
                                    className="text-[9px] font-bold text-muted/40 tracking-wider mt-1 uppercase truncate"
                                    dir="ltr"
                                  >
                                    {page.id}
                                  </span>
                                </div>
                              </div>
                              <div className="pl-2">
                                {state === true ? (
                                  <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 animate-in zoom-in-50 duration-500">
                                    <Check size={14} strokeWidth={4} />
                                  </div>
                                ) : state === false ? (
                                  <div className="h-7 w-7 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 animate-in zoom-in-50 duration-500">
                                    <X size={14} strokeWidth={4} />
                                  </div>
                                ) : isDefaultAllowed ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                      <Zap size={14} fill="currentColor" />
                                    </div>
                                    <span className="text-[8px] font-black text-primary/60 uppercase tracking-tighter">
                                      تلقائي
                                    </span>
                                  </div>
                                ) : (
                                  <div className="h-7 w-7 rounded-full border-2 border-dashed border-border group-hover:border-primary/40 group-hover:bg-primary/5 transition-all" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          <DialogFooter className="px-10 py-8 bg-soft/30 border-t border-border/40 gap-4 flex-row justify-end">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-12 px-8 font-black text-muted hover:text-main transition-all"
            >
              إلغاء التعديلات
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isActionLoading}
              className="rounded-xl h-12 px-12 bg-[#020617] text-white hover:scale-[1.02] font-black shadow-2xl transition-all flex items-center gap-3"
            >
              {isActionLoading ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <ShieldCheck size={20} />
              )}
              <span>حفظ البروتوكول الأمني</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
