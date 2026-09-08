import React, { useEffect, useMemo, useState } from "react";

import { toast } from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  KeyRound,
  Lock,
  FileLock2,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  PageHeader,
  StatCard,
} from "@/components/shared/PremiumUI";
import InlineNotice from "@/components/shared/InlineNotice";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/core/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEFAULT_SECURITY_SETTINGS = {
  enforceStrongPasswords: true,
  requireShiftForSales: true,
  lockClosedShiftEdits: true,
  enableActivityLogs: true,
  restrictExportsToManagers: true,
  requireDiscountApproval: true,
  sessionTimeoutMinutes: 60,
  maxFailedLoginAttempts: 5,
};

const SECURITY_SETTINGS_STORAGE_KEY = "security.access.settings";

const DEFAULT_SECURITY_SYNC_STATUS = {
  settingsSource: "local",
  sessionsAvailable: true,
  usersAvailable: true,
  logsAvailable: true,
  lastMessage: "",
};

const roleLabels = {
  owner: "مالك النظام",
  admin: "مدير النظام",
  manager: "مدير",
  cashier: "كاشير",
  barber: "خبير",
  user: "مستخدم",
};

const riskKeywords =
  /delete|cancel|refund|discount|permission|login|failed|export|import|invoice|shift/i;

function asArray(response) {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function formatDate(value) {
  if (!value) return "---";
  try {
    return new Date(value).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    return String(value);
  }
}

function getUserName(user) {
  return (
    user?.full_name ||
    user?.fullName ||
    user?.display_name ||
    user?.username ||
    user?.email ||
    "مستخدم غير محدد"
  );
}

function getRole(user) {
  return user?.role || user?.role_name || user?.roleName || "user";
}

function getId(item) {
  return (
    item?.id ||
    item?.user_id ||
    item?.userId ||
    item?.employee_id ||
    item?.employeeId
  );
}

function sanitizeSecuritySettings(input = {}) {
  const merged = {
    ...DEFAULT_SECURITY_SETTINGS,
    ...(input && typeof input === "object" ? input : {}),
  };

  return {
    ...merged,
    sessionTimeoutMinutes: Math.max(
      5,
      Number(
        merged.sessionTimeoutMinutes ??
          DEFAULT_SECURITY_SETTINGS.sessionTimeoutMinutes,
      ) || DEFAULT_SECURITY_SETTINGS.sessionTimeoutMinutes,
    ),
    maxFailedLoginAttempts: Math.max(
      1,
      Number(
        merged.maxFailedLoginAttempts ??
          DEFAULT_SECURITY_SETTINGS.maxFailedLoginAttempts,
      ) || DEFAULT_SECURITY_SETTINGS.maxFailedLoginAttempts,
    ),
  };
}

function readStoredSecuritySettings() {
  try {
    const raw = localStorage.getItem(SECURITY_SETTINGS_STORAGE_KEY);
    return raw
      ? sanitizeSecuritySettings(JSON.parse(raw))
      : sanitizeSecuritySettings(DEFAULT_SECURITY_SETTINGS);
  } catch (err) {
    return sanitizeSecuritySettings(DEFAULT_SECURITY_SETTINGS);
  }
}

async function captureRequest(request) {
  try {
    const response = await request;
    return { ok: true, response };
  } catch (error) {
    return { ok: false, error };
  }
}

export default function SecurityAccess() {
  const [usersLoading, setUsersLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [users, setUsers] = useState<any[]>([]);
  
  const [logs, setLogs] = useState<any[]>([]);
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [settings, setSettings] = useState(() => readStoredSecuritySettings());
  const [syncStatus, setSyncStatus] = useState(DEFAULT_SECURITY_SYNC_STATUS);

  // تعريف قائمة التبويبات المفقودة ليعمل الـ map البرمجي بسلاسة
  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: Shield },
    { id: "users", label: "المستخدمين والأدوار", icon: Users },
    { id: "policies", label: "سياسات الوصول", icon: Lock },
    { id: "activity", label: "سجل العمليات الحساسة", icon: Activity },
  ];

  // دالة تحديث الحقول الفردية للسياسات
  const updateSetting = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // دالة تصدير تقرير الأمان
  const exportSecurityReport = () => {
    toast.success("جاري تصدير تقرير الأمان بصيغة CSV تلقائياً...");
    try {
      const headers = ["ID", "Action", "Description", "Entity Type", "Date"];
      const rows = logs.map((log) => [
        log.id || "",
        log.action || "",
        log.description || "",
        log.entity_type || "",
        log.created_at || "",
      ]);
      const csvContent =
        "data:text/csv;charset=utf-8,\uFEFF" +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `security_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (_err) {
      toast.error("فشل استخراج ملف التقرير.");
    }
  };

  // دالة حفظ السياسات وإرسالها للسيرفر وحفظ نسخة احتياطية في localStorage
  const saveSettings = async () => {
    setSaving(true);
    try {
      localStorage.setItem(
        SECURITY_SETTINGS_STORAGE_KEY,
        JSON.stringify(settings),
      );

      const res = await captureRequest(api.put("/security/settings", settings));
      if (res.ok) {
        toast.success("تم حفظ وتطبيق سياسات الأمان بنجاح على الخادم.");
      } else {
        toast.success("تم الحفظ محلياً بنجاح (الخادم قيد التحديث).");
      }
    } catch (_error) {
      toast.error("حدث خطأ أثناء محاولة حفظ الإعدادات.");
    } finally {
      setSaving(false);
    }
  };

  // حساب الـ Metrics الحية لتفادي أخطاء حقول الإحصائيات
  const metrics = useMemo(() => {
    const activeU = users.filter((u) => u.is_active !== false).length;
    const inactiveU = users.filter((u) => u.is_active === false).length;
    const sensitiveL = logs.filter((log) =>
      riskKeywords.test(`${log?.action || ""} ${log?.description || ""}`),
    ).length;

    return {
      activeUsers: activeU,
      inactiveUsers: inactiveU,
      activeSessions: sessions.length || 0,
      sensitiveLogs: sensitiveL,
    };
  }, [users, logs, sessions]);

  // تصفية المستخدمين بناءً على مربع البحث
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter((u) => {
      const name = getUserName(u).toLowerCase();
      const email = (u?.email || "").toLowerCase();
      const role = getRole(u).toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }, [users, searchTerm]);

  async function loadSecurityData({ background = false } = {}) {
    if (background) setRefreshing(true);

    const fetchUsers = async () => {
      try {
        setUsersLoading(true);
        const res = await captureRequest(
          api.get("/users", { params: { limit: 1000 } }),
        );
        setUsers(res.ok ? asArray(res.response) : []);
        return res;
      } finally {
        setUsersLoading(false);
      }
    };

    const fetchLogs = async () => {
      try {
        setLogsLoading(true);
        const res = await captureRequest(
          api.get("/activity-logs", { params: { page: 1, page_size: 30 } }),
        );
        setLogs(res.ok ? asArray(res.response) : []);
        return res;
      } finally {
        setLogsLoading(false);
      }
    };

    const fetchSessions = async () => {
      try {
        setSessionsLoading(true);
        const res = await captureRequest(api.get("/auth/sessions"));
        setSessions(res.ok ? asArray(res.response) : []);
        return res;
      } finally {
        setSessionsLoading(false);
      }
    };

    const fetchSettings = async () => {
      try {
        setSettingsLoading(true);
        const res = await captureRequest(api.get("/security/settings"));
        const serverSettings = res.ok ? res.response?.data : null;
        if (serverSettings && typeof serverSettings === "object") {
          setSettings(sanitizeSecuritySettings(serverSettings));
        }
        return res;
      } finally {
        setSettingsLoading(false);
      }
    };

    try {
      const [usersRes, logsRes, sessionsRes, settingsRes] = await Promise.all([
        fetchUsers(),
        fetchLogs(),
        fetchSessions(),
        fetchSettings(),
      ]);

      let lastMessage = "";
      if (!settingsRes.ok) {
         
        const statusCode = (settingsRes.error as any)?.response?.status;
        lastMessage =
          statusCode === 404
            ? "سياسات الأمان تُعرض من النسخة المحلية مؤقتًا حتى يجهز endpoint أو يعاد تحميل الخادم."
            : "تعذر الوصول إلى خادم سياسات الأمان، لذلك يتم استخدام آخر نسخة محلية محفوظة.";
      } else if (!sessionsRes.ok) {
        lastMessage =
           
          (sessionsRes.error as any)?.response?.status === 404
            ? "معلومات الجلسات غير متاحة حاليًا من الخادم، لذلك يظهر الملخص بدون تفاصيل الجلسات."
            : "تعذر تحميل الجلسات الحالية من الخادم، وقد تكون أرقام الجلسات تقريبية.";
      } else if (!usersRes.ok || !logsRes.ok) {
        lastMessage =
          "تم تحميل مركز الأمان جزئيًا، لكن بعض بيانات المستخدمين أو السجلات لم تصل من الخادم.";
      }

      setSyncStatus({
        settingsSource: settingsRes.ok ? "server" : "local",
        sessionsAvailable: sessionsRes.ok,
        usersAvailable: usersRes.ok,
        logsAvailable: logsRes.ok,
        lastMessage,
      });
    } catch (_error) {
      console.error("Security data load error:", _error);
      toast.error("تعذر تحميل بيانات الأمان والوصول");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loading =
    usersLoading && logsLoading && sessionsLoading && settingsLoading;

  return (
    <div className="erp-page space-y-8 pb-12" dir="rtl">
      <PageHeader
        title="الأمان والوصول"
        subtitle="مراقبة المستخدمين، الجلسات، الصلاحيات، وسياسات حماية العمليات المالية"
        badge="الأمن والوصول"
        icon={ShieldCheck}
        className={undefined}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => loadSecurityData({ background: true })}
              className="h-10 rounded-xl"
            >
              <RefreshCw
                size={16}
                className={cn("ml-2", refreshing && "animate-spin")}
              />
              تحديث
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={exportSecurityReport}
              className="h-10 rounded-xl"
            >
              <Download size={16} className="ml-2" />
              تصدير التقرير
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={saveSettings}
              className="h-10 rounded-xl premium-button"
            >
              <Save size={16} className="ml-2" />
              حفظ السياسات
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="مستخدمون نشطون"
          value={metrics.activeUsers}
          icon={UserCheck}
          variant="success"
          trend={undefined}
          trendValue={undefined}
        />
        <StatCard
          label="جلسات نشطة"
          value={metrics.activeSessions}
          icon={Smartphone}
          variant="info"
          trend={undefined}
          trendValue={undefined}
        />
        <StatCard
          label="عمليات حساسة"
          value={metrics.sensitiveLogs}
          icon={ShieldAlert}
          variant={metrics.sensitiveLogs > 0 ? "warning" : "success"}
          trend={undefined}
          trendValue={undefined}
        />
        <StatCard
          label="حسابات غير نشطة"
          value={metrics.inactiveUsers}
          icon={XCircle}
          variant="secondary"
          trend={undefined}
          trendValue={undefined}
        />
      </div>

      {syncStatus.settingsSource === "server" &&
      syncStatus.sessionsAvailable &&
      syncStatus.usersAvailable &&
      syncStatus.logsAvailable ? (
        <InlineNotice tone="success">
          البيانات متصلة بالخادم الآن، ويمكن حفظ السياسات ومراجعة الجلسات
          والسجلات مباشرة.
        </InlineNotice>
      ) : null}

      {syncStatus.lastMessage ? (
        <InlineNotice
          tone={syncStatus.settingsSource === "local" ? "warning" : "info"}
        >
          {syncStatus.lastMessage}
        </InlineNotice>
      ) : null}

      <Card className="rounded-3xl border border-black/5 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-[#171717]">
        <div className="flex gap-2 overflow-x-auto p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={loading}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-fit items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black transition ${
                  activeTab === tab.id
                    ? "bg-[#6D28D9] text-white shadow-md dark:bg-[#22D3EE] dark:text-[#121212]"
                    : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/10"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {activeTab === "overview" ? (
        <OverviewPanel settings={settings} logs={logs} sessions={sessions} />
      ) : null}

      {activeTab === "users" ? (
        <UsersPanel
          users={filteredUsers}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      ) : null}

      {activeTab === "policies" ? (
        <PoliciesPanel settings={settings} updateSetting={updateSetting} />
      ) : null}

      {activeTab === "activity" ? <ActivityPanel logs={logs} /> : null}
    </div>
  );
}

function OverviewPanel({ settings, logs, sessions }) {
  const lastSensitive = logs.find((log) =>
    riskKeywords.test(`${log?.action || ""} ${log?.description || ""}`),
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171717] xl:col-span-2">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-gray-950 dark:text-gray-50">
              حالة الحماية العامة
            </h2>
            <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
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

      <Card className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171717]">
        <div className="mb-5 flex items-center gap-3">
          <ShieldAlert className="text-amber-600 dark:text-amber-300" />
          <h2 className="text-lg font-black text-gray-950 dark:text-gray-50">
            آخر تنبيه حساس
          </h2>
        </div>
        {lastSensitive ? (
          <div className="space-y-3">
            <Badge variant="warning" className="rounded-xl px-3 py-1">
              {lastSensitive.action || "عملية حساسة"}
            </Badge>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
              {lastSensitive.description || "لا يوجد وصف تفصيلي"}
            </p>
            <p className="text-xs font-bold text-gray-400">
              {formatDate(lastSensitive.created_at || lastSensitive.createdAt)}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-50 p-5 text-center dark:bg-emerald-500/10">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-600 dark:text-emerald-300" />
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
              لا توجد تنبيهات حساسة حديثة
            </p>
          </div>
        )}
        <div className="mt-6 rounded-2xl border border-black/5 p-4 dark:border-white/10">
          <p className="mb-2 text-xs font-black text-gray-500 dark:text-gray-400">
            الجلسات الحالية
          </p>
          <p className="text-2xl font-black text-gray-950 dark:text-gray-50">
            {sessions.length || "---"}
          </p>
        </div>
      </Card>
    </div>
  );
}

interface StatusRowProps {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  enabled: unknown;
  note?: React.ReactNode;
}

function StatusRow({ icon: Icon, title, enabled, note }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300"}`}
        >
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-black text-gray-950 dark:text-gray-50">
            {title}
          </p>
          {note ? (
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {note}
            </p>
          ) : null}
        </div>
      </div>
      {enabled ? (
        <CheckCircle2 className="text-emerald-600" />
      ) : (
        <XCircle className="text-red-600" />
      )}
    </div>
  );
}

function UsersPanel({ users, searchTerm, setSearchTerm }) {
  return (
    <Card className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
      <div className="flex flex-col gap-4 border-b border-black/5 p-5 dark:border-white/10 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-950 dark:text-gray-50">
            المستخدمون والأدوار
          </h2>
          <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
            مراجعة الحسابات النشطة ومستويات الوصول.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <Input
            value={searchTerm || ""}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="بحث عن مستخدم أو دور..."
            className="h-11 pr-11"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المستخدم</TableHead>
              <TableHead>الدور</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>آخر تحديث</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const role = getRole(user);
              return (
                <TableRow key={getId(user) || user.username || user.email}>
                  <TableCell>
                    <div>
                      <p className="font-black text-gray-950 dark:text-gray-50">
                        {getUserName(user)}
                      </p>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        {user?.email || user?.username || "---"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-xl px-3 py-1">
                      {roleLabels[role] || role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user?.is_active === false ? (
                      <Badge variant="danger" className="rounded-xl px-3 py-1">
                        موقوف
                      </Badge>
                    ) : (
                      <Badge variant="success" className="rounded-xl px-3 py-1">
                        نشط
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(user?.updated_at || user?.created_at)}
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <TableEmptyState
                    icon={Users}
                    title="لا توجد بيانات مستخدمين"
                    description="تعذر تحميل المستخدمين أو لا توجد حسابات متاحة للعرض."
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function PoliciesPanel({ settings, updateSetting }) {
  const booleanPolicies = [
    {
      key: "enforceStrongPasswords",
      title: "فرض كلمات مرور قوية",
      description: "منع كلمات المرور الضعيفة عند إنشاء أو تعديل الحسابات.",
      icon: KeyRound,
    },
    {
      key: "requireShiftForSales",
      title: "منع البيع بدون وردية",
      description: "لا يسمح للكاشير بإصدار فاتورة قبل فتح وردية.",
      icon: Lock,
    },
    {
      key: "lockClosedShiftEdits",
      title: "قفل تعديلات الورديات المغلقة",
      description: "حماية العمليات المالية بعد إغلاق الوردية.",
      icon: FileLock2,
    },
    {
      key: "enableActivityLogs",
      title: "تسجيل العمليات الحساسة",
      description: "تسجيل الدخول، الحذف، الخصومات، التصدير، وتعديل الصلاحيات.",
      icon: Activity,
    },
    {
      key: "restrictExportsToManagers",
      title: "تقييد التصدير للإدارة",
      description: "السماح للمالك والمدير فقط بتصدير البيانات الحساسة.",
      icon: Download,
    },
    {
      key: "requireDiscountApproval",
      title: "اعتماد الخصومات الكبيرة",
      description: "إلزام موافقة المدير عند تجاوز حد الخصم المسموح.",
      icon: ShieldAlert,
    },
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
                updateSetting(
                  "sessionTimeoutMinutes",
                  Number(event.target.value || 0),
                )
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
                updateSetting(
                  "maxFailedLoginAttempts",
                  Number(event.target.value || 0),
                )
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

function ActivityPanel({ logs }) {
  const sensitiveLogs = logs.filter((log) =>
    riskKeywords.test(
      `${log?.action || ""} ${log?.entity_type || ""} ${log?.description || ""}`,
    ),
  );

  return (
    <Card className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
      <div className="border-b border-black/5 p-5 dark:border-white/10">
        <h2 className="text-xl font-black text-gray-950 dark:text-gray-50">
          سجل المخاطر والعمليات الحساسة
        </h2>
        <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
          آخر العمليات المرتبطة بالحذف، الخصومات، التصدير، الصلاحيات، وتسجيل
          الدخول.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الإجراء</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead>الكيان</TableHead>
              <TableHead>التوقيت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sensitiveLogs.map((log) => (
              <TableRow key={log.id || `${log.action}-${log.created_at}`}>
                <TableCell>
                  <Badge variant="warning" className="rounded-xl px-3 py-1">
                    {log.action || "عملية"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-105 truncate font-bold text-gray-800 dark:text-gray-100">
                  {log.description || "لا يوجد وصف"}
                </TableCell>
                <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                  {log.entity_type || "عام"}
                </TableCell>
                <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(log.created_at || log.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {sensitiveLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <TableEmptyState
                    icon={ShieldCheck}
                    title="لا توجد عمليات حساسة"
                    description="لم يتم العثور على أحداث عالية المخاطر ضمن آخر السجلات."
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
