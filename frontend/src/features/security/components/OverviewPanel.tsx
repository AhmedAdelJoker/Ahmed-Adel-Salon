import { Activity, CheckCircle2, Clock, Download, FileLock2, KeyRound, Lock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { riskKeywords, formatDate } from "@/features/security/utils";
import StatusRow from "./StatusRow";

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

type SecurityLog = {
  id?: string | number;
  action?: string;
  description?: string;
  entity_type?: string;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
};

type SecuritySession = Record<string, unknown>;

export interface OverviewPanelProps {
  settings: SecuritySettings;
  logs: SecurityLog[];
  sessions: SecuritySession[];
}

export default function OverviewPanel({ settings, logs, sessions }: OverviewPanelProps) {
  const lastSensitive = logs.find((log) =>
    riskKeywords.test(`${String(log?.action ?? "")} ${String(log?.description ?? "")}`),
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm xl:col-span-2">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-main">
              حالة الحماية العامة
            </h2>
            <p className="mt-1 text-xs font-bold text-muted">
              ملخص سريع لأهم قواعد حماية النظام.
            </p>
          </div>
          <Badge variant="success" className="rounded-2xl px-4 py-2">
            مفعل
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatusRow
            icon={KeyRound}
            title="كلمات مرور قوية"
            enabled={settings.enforceStrongPasswords}
          />
          <StatusRow
            icon={Clock}
            title="انتهاء الجلسة تلقائيًا"
            enabled={Number(settings.sessionTimeoutMinutes) > 0}
            note={`${settings.sessionTimeoutMinutes} دقيقة`}
          />
          <StatusRow
            icon={Lock}
            title="منع البيع بدون وردية"
            enabled={settings.requireShiftForSales}
          />
          <StatusRow
            icon={FileLock2}
            title="قفل تعديل الورديات المغلقة"
            enabled={settings.lockClosedShiftEdits}
          />
          <StatusRow
            icon={Activity}
            title="تسجيل العمليات الحساسة"
            enabled={settings.enableActivityLogs}
          />
          <StatusRow
            icon={Download}
            title="تقييد التصدير للإدارة"
            enabled={settings.restrictExportsToManagers}
          />
        </div>
      </Card>

      <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <ShieldAlert className="text-warning" />
          <h2 className="text-lg font-black text-main">
            آخر تنبيه حساس
          </h2>
        </div>
        {lastSensitive ? (
          <div className="space-y-3">
            <Badge variant="warning" className="rounded-xl px-3 py-1">
              {lastSensitive.action || "عملية حساسة"}
            </Badge>
            <p className="text-sm font-bold text-main">
              {lastSensitive.description || "لا يوجد وصف تفصيلي"}
            </p>
            <p className="text-xs font-bold text-muted">
              {formatDate((lastSensitive.created_at || lastSensitive.createdAt) as string | null | undefined)}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-success-soft p-5 text-center border border-success/20">
            <CheckCircle2 className="mx-auto mb-3 text-success" />
            <p className="text-sm font-black text-success">
              لا توجد تنبيهات حساسة حديثة
            </p>
          </div>
        )}
        <div className="mt-6 rounded-2xl border border-border bg-soft p-4">
          <p className="mb-2 text-xs font-black text-muted">
            الجلسات الحالية
          </p>
          <p className="text-2xl font-black text-main">
            {sessions.length || "---"}
          </p>
        </div>
      </Card>
    </div>
  );
}
