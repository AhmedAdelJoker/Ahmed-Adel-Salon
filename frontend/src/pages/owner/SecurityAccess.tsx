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
  Wallet,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, PremiumCard, SkeletonCard, StatCard } from "@/components/shared/PremiumUI";
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
  const navigate = useNavigate();
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
    <div className={embedded ? "space-y-6" : "erp-page space-y-8 pb-12"}>
      {!embedded ? (
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
                className="h-11 rounded-2xl border-border bg-card/50"
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
                className="h-11 rounded-2xl border-border bg-card/50"
              >
                <Download size={16} className="ml-2" />
                تصدير التقرير
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={saveSettings}
                className="h-11 rounded-2xl bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/90"
              >
                <Save size={16} className="ml-2" />
                حفظ السياسات
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
          <div>
            <h3 className="text-sm font-black text-main flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" /> الأمان والوصول
            </h3>
            <p className="text-[11px] font-bold text-muted mt-1">سياسات الحماية والجلسات • مراقبة مباشرة</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => loadSecurityData({ background: true })} className="h-9 rounded-xl">
              <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={exportSecurityReport} className="h-9 rounded-xl">
              <Download size={14} />
            </Button>
            <Button type="button" size="sm" disabled={loading} onClick={saveSettings} className="h-9 rounded-xl">
              <Save size={14} className="ml-1.5" /> حفظ
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} variant="stats" />
          ))}
        </div>
      ) : (
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
      )}

      {/* شريط هوية — انتقال سريع (مرحلة 3) */}
      {!embedded && (
        <PremiumCard className="p-0 overflow-hidden" hoverable={false} animate={false}>
          <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-muted uppercase ml-2">
              <ShieldCheck size={12} className="text-accent" /> انتقال سريع
            </span>
            {[
              { label: "المستخدمون", desc: "إدارة الحسابات", icon: Users, href: "/owner/users", color: "bg-primary text-white" },
              { label: "سجل النشاط", desc: "العمليات الحساسة", icon: Activity, href: "/activity-logs", color: "bg-info text-white" },
              { label: "الموارد البشرية", desc: "الكادر والصلاحيات", icon: ShieldAlert, href: "/owner/hr", color: "bg-warning text-white" },
              { label: "الرواتب", desc: "المستحقات والسلف", icon: Wallet, href: "/owner/payroll", color: "bg-success text-white" },
            ].map((l) => (
              <button
                key={l.href}
                onClick={() => navigate(l.href)}
                className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-right hover:border-accent/20 hover:bg-soft transition-colors group"
              >
                <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", l.color)}>
                  <l.icon size={14} />
                </span>
                <span className="text-right">
                  <span className="block text-xs font-black text-main group-hover:text-accent transition-colors">{l.label}</span>
                  <span className="block text-[10px] font-bold text-muted leading-none">{l.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </PremiumCard>
      )}

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

      <Card className="rounded-3xl border border-border bg-card p-2 shadow-sm">
        <div className="flex gap-2 overflow-x-auto custom-scrollbar p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon === "Shield" ? Shield : tab.icon === "Users" ? Users : tab.icon === "Lock" ? Lock : Activity;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={loading}
                onClick={() => setActiveTab(tab.id)}
                className={cn("flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-3 text-xs font-black transition", activeTab === tab.id ? "bg-accent text-white shadow-md border-accent" : "text-muted hover:bg-soft border-transparent")}
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
