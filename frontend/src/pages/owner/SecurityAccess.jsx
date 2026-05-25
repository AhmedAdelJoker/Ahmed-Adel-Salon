import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";



import { toast } from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
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
  Unlock,
  UserCheck,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";

import api from "../../services/api";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import InlineNotice from "../../components/common/InlineNotice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { TableEmptyState } from "../../components/shared/TableEmptyState";

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
  } catch {
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
  } catch {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [settings, setSettings] = useState(() => readStoredSecuritySettings());
  const [syncStatus, setSyncStatus] = useState(DEFAULT_SECURITY_SYNC_STATUS);

  async function loadSecurityData({ background = false } = {}) {
    try {
      if (background) setRefreshing(true);
      else setLoading(true);

      const [usersRes, logsRes, sessionsRes, settingsRes] = await Promise.all([
        captureRequest(api.get("/users", { params: { limit: 1000 } })),
        captureRequest(
          api.get("/activity-logs", { params: { page: 1, page_size: 30 } }),
        ),
        captureRequest(api.get("/auth/sessions")),
        captureRequest(api.get("/security/settings")),
      ]);

      setUsers(usersRes.ok ? asArray(usersRes.response) : []);
      setLogs(logsRes.ok ? asArray(logsRes.response) : []);
      setSessions(sessionsRes.ok ? asArray(sessionsRes.response) : []);

      const serverSettings = settingsRes.ok ? settingsRes.response?.data : null;
      if (serverSettings && typeof serverSettings === "object") {
        setSettings(sanitizeSecuritySettings(serverSettings));
      }

      let lastMessage = "";
      if (!settingsRes.ok) {
        const statusCode = settingsRes.error?.response?.status;
        lastMessage =
          statusCode === 404
            ? "سياسات الأمان تُعرض من النسخة المحلية مؤقتًا حتى يجهز endpoint أو يعاد تحميل الخادم."
            : "تعذر الوصول إلى خادم سياسات الأمان، لذلك يتم استخدام آخر نسخة محلية محفوظة.";
      } else if (!sessionsRes.ok) {
        lastMessage =
          sessionsRes.error?.response?.status === 404
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
    } catch (error) {
      console.error("Security data load error:", error);
      toast.error("تعذر تحميل بيانات الأمان والوصول");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {

    loadSecurityData();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const haystack =
        `${getUserName(user)} ${user?.username || ""} ${user?.email || ""} ${getRole(user)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [users, searchTerm]);

  const metrics = useMemo(() => {
    const activeUsers = users.filter(
      (user) => user?.is_active !== false,
    ).length;
    const inactiveUsers = Math.max(0, users.length - activeUsers);
    const sensitiveLogs = logs.filter((log) =>
      riskKeywords.test(
        `${log?.action || ""} ${log?.entity_type || ""} ${log?.description || ""}`,
      ),
    ).length;
    const activeSessions = sessions.length || activeUsers;

    return {
      activeUsers,
      inactiveUsers,
      sensitiveLogs,
      activeSessions,
    };
  }, [users, logs, sessions]);

  function updateSetting(key, value) {
    setSettings((previous) => ({ ...previous, [key]: value }));
  }

  async function saveSettings() {
    try {
      setSaving(true);
      const sanitizedSettings = sanitizeSecuritySettings(settings);
      setSettings(sanitizedSettings);

      // Endpoint /security/settings is optional. Keep the UI usable even before backend support is added.
      try {
        await api.put("/security/settings", sanitizedSettings);
        localStorage.setItem(
          SECURITY_SETTINGS_STORAGE_KEY,
          JSON.stringify(sanitizedSettings),
        );
        setSyncStatus((current) => ({
          ...current,
          settingsSource: "server",
          lastMessage: "",
        }));
        toast.success("تم حفظ إعدادات الأمان بنجاح");
      } catch (error) {
        if (error?.response?.status === 404) {
          localStorage.setItem(
            SECURITY_SETTINGS_STORAGE_KEY,
            JSON.stringify(sanitizedSettings),
          );
          setSyncStatus((current) => ({
            ...current,
            settingsSource: "local",
            lastMessage:
              "تم حفظ إعدادات الأمان محليًا لأن endpoint الحفظ غير متاح حاليًا على الخادم.",
          }));
          toast.success("تم حفظ إعدادات الأمان محليًا مؤقتًا");
        } else {
          localStorage.setItem(
            SECURITY_SETTINGS_STORAGE_KEY,
            JSON.stringify(sanitizedSettings),
          );
          setSyncStatus((current) => ({
            ...current,
            settingsSource: "local",
            lastMessage:
              "تعذر الوصول إلى الخادم أثناء الحفظ، لذلك تم الاحتفاظ بالتعديلات محليًا حتى تعود المزامنة.",
          }));
          toast.error(
            "تعذر مزامنة الحفظ مع الخادم، وتم الاحتفاظ بالنسخة محليًا",
          );
        }
      }
    } catch (error) {
      console.error("Security settings save error:", error);
      toast.error("تعذر حفظ إعدادات الأمان");
    } finally {
      setSaving(false);
    }
  }

  async function exportSecurityReport() {
    try {
      const response = await api.get("/exports/security-audit", {
        responseType: "blob",
      });
      const file = new globalThis.Blob([response.data], {
        type: response.headers?.["content-type"] || "application/octet-stream",
      });
      const url = globalThis.URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `security_audit_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      globalThis.URL.revokeObjectURL(url);
      toast.success("تم تصدير تقرير الأمان");
    } catch (error) {
      console.error("Security export error:", error);
      toast.error("تعذر تصدير تقرير الأمان");
    }
  }

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: ShieldCheck },
    { id: "users", label: "المستخدمون والأدوار", icon: Users },
    { id: "policies", label: "سياسات الوصول", icon: Lock },
    { id: "activity", label: "سجل المخاطر", icon: Activity },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-[#6D28D9] dark:text-[#22D3EE]">
          <Shield className="h-12 w-12 animate-pulse" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            تحميل مركز الأمان والوصول...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24" dir="rtl">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#6D28D9] to-[#7D50D9] text-white shadow-lg dark:from-[#22D3EE] dark:to-[#0ea5e9] dark:text-[#121212]">
            <ShieldCheck size={34} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-gray-50">
              الأمان والوصول
            </h1>
            <p className="mt-1 text-sm font-bold text-gray-500 dark:text-gray-400">
              مراقبة المستخدمين، الجلسات، الصلاحيات، وسياسات حماية العمليات
              المالية.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => loadSecurityData({ background: true })}
            loading={refreshing}
            className="h-11 rounded-2xl px-5 font-black"
          >
            <RefreshCw size={17} className="ml-2" />
            تحديث
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={exportSecurityReport}
            className="h-11 rounded-2xl px-5 font-black"
          >
            <Download size={17} className="ml-2" />
            تصدير تقرير الأمان
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={saveSettings}
            loading={saving}
            className="h-11 rounded-2xl px-5 font-black"
          >
            <Save size={17} className="ml-2" />
            حفظ السياسات
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="مستخدمون نشطون"
          value={metrics.activeUsers || ""}
          icon={UserCheck}
          tone="success"
        />
        <MetricCard
          title="جلسات نشطة"
          value={metrics.activeSessions || ""}
          icon={Smartphone}
          tone="info"
        />
        <MetricCard
          title="عمليات حساسة"
          value={metrics.sensitiveLogs || ""}
          icon={ShieldAlert}
          tone={metrics.sensitiveLogs > 0 ? "warning" : "success"}
        />
        <MetricCard
          title="حسابات غير نشطة"
          value={metrics.inactiveUsers || ""}
          icon={XCircle}
          tone={metrics.inactiveUsers > 0 ? "muted" : "success"}
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

function MetricCard({ title, value, icon: Icon, tone = "info" }) {
  const styles = {
    success:
      "from-emerald-50 to-emerald-100 text-emerald-700 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:text-emerald-300",
    info: "from-blue-50 to-blue-100 text-blue-700 dark:from-blue-500/10 dark:to-blue-500/5 dark:text-blue-300",
    warning:
      "from-amber-50 to-amber-100 text-amber-700 dark:from-amber-500/10 dark:to-amber-500/5 dark:text-amber-300",
    muted:
      "from-gray-50 to-gray-100 text-gray-700 dark:from-white/10 dark:to-white/5 dark:text-gray-300",
  };

  return (
    <Card
      className={`rounded-3xl border border-black/5 bg-gradient-to-br p-6 shadow-sm dark:border-white/10 ${styles[tone] || styles.info}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-widest opacity-80">
          {title}
        </p>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-black/20">
          <Icon size={24} />
        </div>
      </div>
      <p className="text-3xl font-black">{value}</p>
    </Card>
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

function StatusRow({ icon: Icon, title, enabled, note }) {
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
                <TableCell className="max-w-[420px] truncate font-bold text-gray-800 dark:text-gray-100">
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

