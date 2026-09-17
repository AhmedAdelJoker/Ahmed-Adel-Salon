import React from "react";
import {
  Activity,
  Download,
  Lock,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/shared/PremiumUI";
import InlineNotice from "@/components/shared/InlineNotice";
import { cn } from "@/lib/core/utils";
import {
  useSecurityAccess,
  OverviewPanel,
  UsersPanelTab,
  PoliciesPanel,
  ActivityPanel,
} from "@/features/security";

export default function SecurityAccess({ embedded = false }: { embedded?: boolean }) {
  const {
    loading,
    refreshing,
    metrics,
    syncStatus,
    tabs,
    activeTab,
    setActiveTab,
    settings,
    updateSetting,
    exportSecurityReport,
    saveSettings,
    filteredUsers,
    loadSecurityData,
    logs,
    sessions,
    searchTerm,
    setSearchTerm,
  } = useSecurityAccess();

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
            const Icon = tab.icon === "Shield" ? Shield : tab.icon === "Users" ? Users : tab.icon === "Lock" ? Lock : Activity;
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
        <UsersPanelTab
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
