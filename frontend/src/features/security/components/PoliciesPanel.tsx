import React from "react";
import { Activity, AlertTriangle, Download, FileLock2, KeyRound, Lock, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type SecuritySettings = {
  enforceStrongPasswords: boolean;
  requireShiftForSales: boolean;
  lockClosedShiftEdits: boolean;
  enableActivityLogs: boolean;
  restrictExportsToManagers: boolean;
  requireDiscountApproval: boolean;
  sessionTimeoutMinutes: number;
  maxFailedLoginAttempts: number;
  [key: string]: boolean | number;
};

export interface PoliciesPanelProps {
  settings: SecuritySettings;
  updateSetting: (key: string, value: unknown) => void;
}

type BooleanPolicy = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
};

export default function PoliciesPanel({ settings, updateSetting }: PoliciesPanelProps) {
  const booleanPolicies: BooleanPolicy[] = [
    { key: "enforceStrongPasswords", title: "فرض كلمات مرور قوية", description: "منع كلمات المرور الضعيفة عند إنشاء أو تعديل الحسابات.", icon: KeyRound },
    { key: "requireShiftForSales", title: "منع البيع بدون وردية", description: "لا يسمح للكاشير بإصدار فاتورة قبل فتح وردية.", icon: Lock },
    { key: "lockClosedShiftEdits", title: "قفل تعديلات الورديات المغلقة", description: "حماية العمليات المالية بعد إغلاق الوردية.", icon: FileLock2 },
    { key: "enableActivityLogs", title: "تسجيل العمليات الحساسة", description: "تسجيل الدخول، الحذف، الخصومات، التصدير، وتعديل الصلاحيات.", icon: Activity },
    { key: "restrictExportsToManagers", title: "تقييد التصدير للإدارة", description: "السماح للمالك والمدير فقط بتصدير البيانات الحساسة.", icon: Download },
    { key: "requireDiscountApproval", title: "اعتماد الخصومات الكبيرة", description: "إلزام موافقة المدير عند تجاوز حد الخصم المسموح.", icon: ShieldAlert },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171717] xl:col-span-2">
        <h2 className="mb-5 text-xl font-black text-gray-950 dark:text-gray-50">
          سياسات الوصول والحماية
        </h2>
        <div className="space-y-4">
          {booleanPolicies.map((policy) => {
            const Icon = policy.icon;
            return (
              <div
                key={policy.key}
                className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#6D28D9] shadow-sm dark:bg-black/20 dark:text-[#22D3EE]">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-950 dark:text-gray-50">
                      {policy.title}
                    </p>
                    <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                      {policy.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(settings[policy.key])}
                  onCheckedChange={(checked) =>
                    updateSetting(policy.key, checked)
                  }
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171717]">
        <h2 className="mb-5 text-xl font-black text-gray-950 dark:text-gray-50">
          إعدادات الجلسات
        </h2>
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-xs font-black text-gray-500 dark:text-gray-400">
              مدة انتهاء الجلسة بالدقائق
            </span>
            <Input
              type="number"
              min="5"
              value={settings.sessionTimeoutMinutes || ""}
              onChange={(event) =>
                updateSetting("sessionTimeoutMinutes", Number(event.target.value || 0))
              }
              className="h-11"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-black text-gray-500 dark:text-gray-400">
              أقصى محاولات دخول فاشلة
            </span>
            <Input
              type="number"
              min="1"
              value={settings.maxFailedLoginAttempts || ""}
              onChange={(event) =>
                updateSetting("maxFailedLoginAttempts", Number(event.target.value || 0))
              }
              className="h-11"
            />
          </label>
          <div className="rounded-2xl bg-amber-50 p-4 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={18} />
              <p className="text-sm font-black">تنبيه</p>
            </div>
            <p className="text-xs font-bold leading-6">
              إذا لم تكن endpoints الخاصة بسياسات الأمان مفعلة في الباك إند،
              سيتم عرض القيم محليًا فقط لحين إضافة API.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
