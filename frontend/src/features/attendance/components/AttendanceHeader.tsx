import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  History,
  Plane,
  RefreshCw,
  Settings,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import type {
  AttendanceRecord,
  AttendanceViewMode,
} from "@/features/attendance/types";
import {
  ATTENDANCE_VIEW_MODES,
  type TranslateFn,
} from "@/features/attendance/utils/attendance";

const VIEW_ICONS: Record<AttendanceViewMode, typeof BarChart3> = {
  today: UserCheck,
  register: FileSpreadsheet,
  leaves: Plane,
  calendar: CalendarDays,
  analytics: BarChart3,
  archive: History,
};

export function AttendancePageHeader({
  onShowSettings,
  onExportPDF,
  onRefresh,
  loading,
  t,
}: {
  onShowSettings: () => void;
  onExportPDF: () => void;
  onRefresh: () => void;
  loading?: boolean;
  t: TranslateFn;
}) {
  return (
    <PageHeader
      title={t("attendance.title")}
      subtitle={t("attendance.subtitle")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl"
            onClick={onShowSettings}
          >
            <Settings size={16} />
            <span className="hidden sm:inline">{t("attendance.settings")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl"
            onClick={onExportPDF}
          >
            <Download size={16} />
            <span className="hidden sm:inline">{t("attendance.exportPdf")}</span>
          </Button>
          <Button
            size="sm"
            className="h-10 gap-2 rounded-xl shadow-sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={cn(loading && "animate-spin")} />
            <span>{t("attendance.refresh")}</span>
          </Button>
        </div>
      }
    />
  );
}

export function AttendanceStatsCards({
  todayRecords,
  lateEmployees,
  t,
}: {
  todayRecords: AttendanceRecord[];
  lateEmployees: AttendanceRecord[];
  t: TranslateFn;
}) {
  const presentNow = todayRecords.filter(
    (r) => r.status === "in" || r.status === "break" || r.status === "break_end",
  ).length;
  const completed = todayRecords.filter((r) => r.status === "out" || r.isComplete).length;
  const totalHours = todayRecords.reduce(
    (acc, r) => acc + Number(r.stats?.totalHours || 0),
    0,
  );
  const denom = presentNow + completed;
  const attendanceRate = denom > 0 ? Math.round((completed / denom) * 100) : 0;

  const items = [
    {
      title: t("attendance.kpiPresent"),
      value: String(presentNow),
      hint: t("attendance.kpiPresentHint"),
      icon: UserCheck,
      tone: "text-primary bg-primary/10 border-primary/10",
    },
    {
      title: t("attendance.kpiLate"),
      value: String(lateEmployees.length),
      hint: t("attendance.kpiLateHint"),
      icon: AlertCircle,
      tone: "text-red-600 bg-red-500/10 border-red-500/10",
    },
    {
      title: t("attendance.kpiHours"),
      value: totalHours.toFixed(1),
      hint: t("attendance.kpiHoursHint"),
      icon: Clock,
      tone: "text-sky-700 bg-sky-500/10 border-sky-500/10",
    },
    {
      title: t("attendance.kpiAttendanceRate"),
      value: `${attendanceRate}%`,
      hint: t("attendance.kpiRateHint"),
      icon: BarChart3,
      tone: "text-emerald-700 bg-emerald-500/10 border-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <PremiumCard
            key={item.title}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card/90 p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">
                  {item.title}
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-main tabular-nums">
                  {item.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-muted">{item.hint}</p>
              </div>
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                  item.tone,
                )}
              >
                <Icon size={20} />
              </div>
            </div>
          </PremiumCard>
        );
      })}
    </div>
  );
}

export function AttendanceViewTabs({
  activeViewMode,
  onChange,
  t,
}: {
  activeViewMode: AttendanceViewMode;
  onChange: (mode: AttendanceViewMode) => void;
  t: TranslateFn;
}) {
  return (
    <div
      role="tablist"
      aria-label={t("attendance.title")}
      className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card/70 p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ATTENDANCE_VIEW_MODES.map((tab) => {
        const Icon = VIEW_ICONS[tab.id];
        const active = activeViewMode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`attendance-panel-${tab.id}`}
            id={`attendance-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex min-w-fit items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:bg-muted/40 hover:text-main",
            )}
          >
            <Icon size={16} />
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
