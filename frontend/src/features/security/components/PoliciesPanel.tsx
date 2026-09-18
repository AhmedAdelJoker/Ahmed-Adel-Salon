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
      <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm   xl:col-span-2">
        <h2 className="mb-5 text-xl font-black text-main">
          سياسات الوصول والحماية
        </h2>
        <div className="space-y-4">
          {booleanPolicies.map((policy) => {
            const Icon = policy.icon;
            return (
              <div
                key={policy.key}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-soft p-4  dark:bg-card/5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-sm border border-primary/10  ">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-main">
                      {policy.title}
                    </p>
                    <p className="mt-1 text-xs font-bold text-muted">
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

      <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm  ">
        <h2 className="mb-5 text-xl font-black text-main">
          إعدادات الجلسات
        </h2>
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-xs font-black text-muted">
              مدة انتهاء الجلسة بالدقائق
            </span>
            <Input
              type="number"
              min="5"
              value={settings.sessionTimeoutMinutes || ""}
              onChange={(event) =>
                updateSetting("sessionTimeoutMinutes", Number(event.target.value || 0))
              }
              className="h-11 bg-soft border-border focus:bg-card"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-black text-muted">
              أقصى محاولات دخول فاشلة
            </span>
            <Input
              type="number"
              min="1"
              value={settings.maxFailedLoginAttempts || ""}
              onChange={(event) =>
                updateSetting("maxFailedLoginAttempts", Number(event.target.value || 0))
              }
              className="h-11 bg-soft border-border focus:bg-card"
            />
          </label>
          <div className="rounded-2xl bg-warning-soft p-4 text-warning border border-warning/20 dark:bg-warning-soft0/10 ">
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
