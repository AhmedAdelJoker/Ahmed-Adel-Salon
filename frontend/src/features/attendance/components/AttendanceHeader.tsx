import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Clock,
  Download,
  History,
  Plane,
  RefreshCw,
  Settings,
  TrendingUp,
  UserCheck,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import {
  PageHeader,
  PremiumCard,
} from "@/components/shared/PremiumUI";
import type {
  AttendanceRecord,
  AttendanceViewMode,
} from "@/features/attendance/types";
import { ATTENDANCE_VIEW_MODES } from "@/features/attendance/utils/attendance";

const VIEW_ICONS: Record<AttendanceViewMode, typeof BarChart3> = {
  dashboard: BarChart3,
  pulse: Activity,
  monthly: TrendingUp,
  leaves: Plane,
  calendar: CalendarDays,
  archive: History,
};

export function AttendancePageHeader({
  onShowSettings,
  onExportPDF,
  onRefresh,
}: {
  onShowSettings: () => void;
  onExportPDF: () => void;
  onRefresh: () => void;
}) {
  return (
    <PageHeader
      title="الحضور والانضباط"
      subtitle="إدارة الحضور، الانضباط، الإجازات، والتحليلات المتقدمة"
      badge="الموارد البشرية"
      icon={UserCheck}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-xl px-3"
            onClick={onShowSettings}
          >
            <Settings size={14} className="ml-1.5" />
            <span className="hidden sm:inline">الإعدادات</span>
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl px-3"
            onClick={onExportPDF}
          >
            <Download size={14} className="ml-1.5" />
            <span className="hidden sm:inline">تصدير PDF</span>
          </Button>
          <Button onClick={onRefresh} className="h-10 rounded-xl px-4">
            <RefreshCw size={14} className="ml-1.5" />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
        </div>
      }
    />
  );
}

export function AttendanceStatsCards({
  todayRecords,
  lateEmployees,
}: {
  todayRecords: AttendanceRecord[];
  lateEmployees: AttendanceRecord[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <PremiumCard className="group p-3 sm:p-5" delay={0}>
        <div className="flex items-center gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success transition-transform group-hover:scale-105 sm:flex">
            <UserCheck size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
              متواجد الآن
            </div>
            <div className="text-lg font-black tabular-nums text-main sm:text-xl">
              {todayRecords.length}
            </div>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="group p-3 sm:p-5" delay={0.1}>
        <div className="flex items-center gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger transition-transform group-hover:scale-105 sm:flex">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
              المتأخرين
            </div>
            <div className="text-lg font-black tabular-nums text-main sm:text-xl">
              {lateEmployees.length}
            </div>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="group p-3 sm:p-5" delay={0.2}>
        <div className="flex items-center gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info transition-transform group-hover:scale-105 sm:flex">
            <Clock size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
              ساعات اليوم
            </div>
            <div className="text-lg font-black tabular-nums text-main sm:text-xl">
              {todayRecords
                .reduce((s, r) => s + (Number(r.stats?.totalHours) || 0), 0)
                .toFixed(1)}
            </div>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="group p-3 sm:p-5" delay={0.3}>
        <div className="flex items-center gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning transition-transform group-hover:scale-105 sm:flex">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
              نسبة الحضور
            </div>
            <div className="text-lg font-black tabular-nums text-main sm:text-xl">
              {todayRecords.length > 0
                ? Math.round(
                    (todayRecords.filter(
                      (r) => Number(r.stats?.totalHours) > 0,
                    ).length /
                      todayRecords.length) *
                      100,
                  )
                : 0}
              %
            </div>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}

export function AttendanceViewTabs({
  activeViewMode,
  onChange,
}: {
  activeViewMode: AttendanceViewMode;
  onChange: (mode: AttendanceViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft">
      {ATTENDANCE_VIEW_MODES.map((mode) => {
        const Icon = VIEW_ICONS[mode.id];
        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={cn(
              "h-10 flex-1 min-w-[100px] whitespace-nowrap rounded-xl flex items-center justify-center gap-2 font-black text-[10px] transition-all sm:text-xs",
              activeViewMode === mode.id
                ? "bg-primary text-white shadow-md"
                : "text-muted hover:bg-soft hover:text-main",
            )}
          >
            <Icon size={14} /> {mode.label}
          </button>
        );
      })}
    </div>
  );
}

export default AttendancePageHeader;
