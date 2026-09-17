import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Shield, LogOut } from "lucide-react";
import type { SecurityState } from "@/features/barber-profile/types";

interface SecurityTabProps {
  security: SecurityState;
  setSecurity: React.Dispatch<React.SetStateAction<SecurityState>>;
  onSaveSecurity: () => unknown | Promise<unknown>;
}

export const SecurityTab = ({ security, setSecurity, onSaveSecurity }: SecurityTabProps) => {
  return (
    <TabsContent value="security" className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <Shield size={16} className="text-primary" /> تغيير كلمة المرور
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              كلمة المرور الحالية
            </label>
            <Input
              type="password"
              value={security.current_password}
              onChange={(e) =>
                setSecurity({
                  ...security,
                  current_password: e.target.value,
                })
              }
              className="h-10 rounded-xl"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              كلمة المرور الجديدة
            </label>
            <Input
              type="password"
              value={security.new_password}
              onChange={(e) => setSecurity({ ...security, new_password: e.target.value })}
              className="h-10 rounded-xl"
              placeholder="كلمة مرور قوية"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              تأكيد كلمة المرور الجديدة
            </label>
            <Input
              type="password"
              value={security.confirm_password}
              onChange={(e) =>
                setSecurity({
                  ...security,
                  confirm_password: e.target.value,
                })
              }
              className="h-10 rounded-xl"
              placeholder="••••••••"
            />
          </div>
        </div>
        <Button onClick={onSaveSecurity} className="w-full">
          تغيير كلمة المرور
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <Shield size={16} className="text-primary" /> المصادقة الثنائية
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-black text-main">تفعيل المصادقة الثنائية (2FA)</p>
            <p className="text-sm text-muted">أضف طبقة أمان إضافية لحسابك</p>
          </div>
          <Switch
            checked={security.two_factor}
            onCheckedChange={(checked) => setSecurity({ ...security, two_factor: checked })}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5">
        <h3 className="text-sm font-black text-danger mb-2 flex items-center gap-2">
          <LogOut size={16} /> منطقة الخطر
        </h3>
        <p className="text-sm text-muted mb-4">هذه الإجراءات لا يمكن التراجع عنها</p>
        <Button variant="danger" className="w-full">
          تسجيل الخروج من جميع الأجهزة
        </Button>
      </div>
    </TabsContent>
  );
};
