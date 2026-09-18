import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import {
  SECURITY_SETTINGS_STORAGE_KEY,
  DEFAULT_SECURITY_SYNC_STATUS,
} from "../constants";
import {
  captureRequest,
  asArray,
  readStoredSecuritySettings,
  sanitizeSecuritySettings,
  getUserName,
  getRole,
  riskKeywords,
} from "../utils";

export function useSecurityAccess() {
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

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: "Shield" },
    { id: "users", label: "المستخدمين والأدوار", icon: "Users" },
    { id: "policies", label: "سياسات الوصول", icon: "Lock" },
    { id: "activity", label: "سجل العمليات الحساسة", icon: "Activity" },
  ];

  const updateSetting = useCallback((key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const exportSecurityReport = useCallback(() => {
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
  }, [logs]);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      localStorage.setItem(SECURITY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
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
  }, [settings]);

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

  const loadSecurityData = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true);

    const fetchUsers = async () => {
      try {
        setUsersLoading(true);
        const res = await captureRequest(api.get("/users", { params: { limit: 1000 } }));
        setUsers(res.ok ? asArray(res.response) : []);
        return res;
      } finally {
        setUsersLoading(false);
      }
    };

    const fetchLogs = async () => {
      try {
        setLogsLoading(true);
        const res = await captureRequest(api.get("/activity-logs", { params: { page: 1, page_size: 30 } }));
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
        lastMessage = "تم تحميل مركز الأمان جزئيًا، لكن بعض بيانات المستخدمين أو السجلات لم تصل من الخادم.";
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
  }, []);

  useEffect(() => {
    loadSecurityData();
  }, [loadSecurityData]);

  const loading = usersLoading && logsLoading && sessionsLoading && settingsLoading;

  return {
    usersLoading,
    logsLoading,
    sessionsLoading,
    settingsLoading,
    refreshing,
    saving,
    users,
    logs,
    sessions,
    searchTerm,
    setSearchTerm,
    activeTab,
    setActiveTab,
    settings,
    setSettings,
    syncStatus,
    tabs,
    updateSetting,
    exportSecurityReport,
    saveSettings,
    metrics,
    filteredUsers,
    loadSecurityData,
    loading,
    getUserName,
    getRole,
  };
}
