import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { PageShell } from "@/components/shared/PageShell";
import InlineNotice from "@/components/shared/InlineNotice";
import { cn } from "@/lib/core/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/services/api";
import { getIntlLocale } from "@/lib/format/locale";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { useSocket } from "@/context/SocketContext";
import {
  ArchiveView,
  AttendanceDashboardView,
  AttendanceLoading,
  AttendancePageHeader,
  AttendanceStatsCards,
  AttendanceViewTabs,
  CalendarView,
  LeavesView,
  MonthlyView,
  PenaltiesView,
  RegisterView,
  useAttendanceData,
} from "@/features/attendance";
import type { AttendanceSettingsForm, AttendanceViewMode, WorkingHours } from "@/features/attendance/types";
import { emptyLeaveForm } from "@/features/attendance/types";
import { exportAttendancePDF } from "@/features/attendance/utils/attendance";

const AttendanceManagement = () => {
  const { t, i18n } = useTranslation("owner");
  const language = i18n.resolvedLanguage || i18n.language || "ar";
  const locale = getIntlLocale(language);
  const { user } = useAuth();
  const { openEmployeeQuickView } = useUI();

  const data = useAttendanceData({ t: t as any });
  const {
    historyRecords,
    employees,
    workingHours,
    penaltyRate,
    lateThreshold,
    autoPenaltyEnabled,
    leaves,
    loading,
    leavesLoading,
    loadError,
    secondaryError,
    searchTerm,
    setSearchTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    calendarMonth,
    setCalendarMonth,
    leaveFilter,
    setLeaveFilter,
    archivePage,
    setArchivePage,
    archiveTotalPages,
    archiveTotal,
    pageSize,
    fetchAttendance,
    fetchLeaves,
    todayRecords,
    processedData,
    archiveRecords,
    filteredArchiveRecords,
    lateEmployees,
  } = data;

  const [activeViewMode, setActiveViewMode] = useState<AttendanceViewMode>("today");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<AttendanceSettingsForm>({
    open_time: "09:00",
    close_time: "22:00",
    late_threshold: 15,
    late_penalty_per_minute: 0.5,
    auto_penalty_enabled: true,
  });
  // Per-day editor state — seeded from the live working hours, saved as-is.
  const [daysForm, setDaysForm] = useState<WorkingHours>({});
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ ...emptyLeaveForm });

  // Live refresh: the backend broadcasts an event on every punch (manual,
  // fingerprint, leave decision). POS wired this up a while ago; the attendance
  // page never listened, so a punch made at the register only appeared after a
  // manual reload.
  const socketContext = useSocket();
  const lastSocketEvent = socketContext?.notifications?.[0];
  useEffect(() => {
    const event = (lastSocketEvent as { event?: string } | undefined)?.event;
    if (event === "attendance_update" || event === "attendance_refresh") {
      void data.fetchAttendance();
      void data.fetchHistory();
    }
     
  }, [lastSocketEvent]);

  const canApproveLeaves = ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT"].includes(
    String(user?.role || "").toUpperCase(),
  );

  useEffect(() => {
    if (activeViewMode === "leaves") {
      void fetchLeaves(leaveFilter);
    }
  }, [activeViewMode, leaveFilter, fetchLeaves]);

  // Seed settings + the per-day editor from the live working-hours response.
  useEffect(() => {
    const hours = workingHours || {};
    setDaysForm(hours);
    const openDay = Object.values(hours).find((d) => d?.is_open && d.open_time && d.close_time);
    setSettingsForm((s) => ({
      ...s,
      open_time: openDay?.open_time || s.open_time,
      close_time: openDay?.close_time || s.close_time,
      late_threshold: lateThreshold,
      late_penalty_per_minute: penaltyRate,
      auto_penalty_enabled: autoPenaltyEnabled,
    }));
  }, [workingHours, lateThreshold, penaltyRate, autoPenaltyEnabled]);

  const exportRows = useMemo(() => {
    if (activeViewMode === "analytics") return processedData;
    if (activeViewMode === "archive") return filteredArchiveRecords;
    return todayRecords;
  }, [activeViewMode, processedData, filteredArchiveRecords, todayRecords]);

  const handleExportPDF = async () => {
    try {
      await exportAttendancePDF({
        activeViewMode,
        rows: exportRows,
        locale,
        t: t as any,
      });
    } catch {
      toast.error(t("attendance.exportPdfFailed"));
    }
  };

  const DAY_KEYS = [
    "saturday",
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ] as const;

  const updateDay = (
    day: string,
    patch: Partial<{ is_open: boolean; open_time: string; close_time: string }>,
  ) =>
    setDaysForm((prev) => ({
      ...prev,
      [day]: {
        is_open: patch.is_open ?? prev[day]?.is_open ?? true,
        open_time: patch.open_time ?? prev[day]?.open_time ?? "09:00",
        close_time: patch.close_time ?? prev[day]?.close_time ?? "22:00",
      },
    }));

  // Copy the first open day's times onto every open day — the common case of
  // "same hours every day" without retyping seven times.
  const applyToAllOpenDays = () => {
    const template = DAY_KEYS.map((d) => daysForm[d]).find((d) => d?.is_open);
    if (!template) return;
    setDaysForm((prev) => {
      const next: WorkingHours = { ...prev };
      for (const day of DAY_KEYS) {
        if (next[day]?.is_open) {
          next[day] = { ...next[day], open_time: template.open_time, close_time: template.close_time };
        }
      }
      return next;
    });
    toast.success(t("attendance.timesAppliedToAll"));
  };

  const detailOf = (err: unknown): string | null => {
    const e = err as { response?: { data?: { detail?: unknown } } };
    const d = e?.response?.data?.detail;
    return typeof d === "string" ? d : null;
  };

  const handleSaveSettings = async () => {
    try {
      const workingHoursPayload: Record<string, unknown> = {};
      for (const day of DAY_KEYS) {
        const current = daysForm[day];
        const isOpen = current?.is_open !== false;
        workingHoursPayload[day] = {
          is_open: isOpen,
          open_time: current?.open_time || settingsForm.open_time,
          close_time: current?.close_time || settingsForm.close_time,
        };
      }
      await api.post("/barber-presence/working-hours", {
        working_hours: workingHoursPayload,
        late_threshold: settingsForm.late_threshold,
        late_penalty_per_minute: settingsForm.late_penalty_per_minute,
        auto_penalty_enabled: settingsForm.auto_penalty_enabled,
      });
      toast.success(t("attendance.settingsSaved"));
      setShowSettings(false);
      await fetchAttendance();
    } catch (err) {
      // Surface the backend's validation message (invalid window, short day...)
      toast.error(detailOf(err) || t("attendance.settingsFailed"));
    }
  };

  const handleCreateLeave = async () => {
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) {
      return toast.error(t("attendance.completeFields"));
    }
    try {
      await api.post("/barber-presence/leaves", leaveForm);
      toast.success(t("attendance.leaveSent"));
      setShowLeaveForm(false);
      setLeaveForm({ ...emptyLeaveForm });
      await fetchLeaves(leaveFilter);
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      toast.error(
        (typeof apiErr?.response?.data?.detail === "string" && apiErr.response.data.detail) ||
          apiErr?.message ||
          t("attendance.leaveFailed"),
      );
    }
  };

  const handleLeaveAction = async (leaveId: string | number | undefined, action: string) => {
    if (!canApproveLeaves) {
      toast.error(t("attendance.leaveApproveNoPermission"));
      return;
    }
    try {
      await api.patch(`/barber-presence/leaves/${leaveId}`, { status: action });
      toast.success(action === "approved" ? t("attendance.leaveApproved") : t("attendance.leaveRejected"));
      await fetchLeaves(leaveFilter);
    } catch {
      toast.error(t("attendance.leaveFailed"));
    }
  };

  if (loading) {
    return (
      <PageShell contained>
        <AttendanceLoading />
      </PageShell>
    );
  }

  return (
    <div>
      <PageShell contained>
        <div className="space-y-4">
        <AttendancePageHeader
          onShowSettings={() => setShowSettings(true)}
          onExportPDF={handleExportPDF}
          onRefresh={() => {
            void fetchAttendance();
            void data.fetchHistory();
          }}
          loading={loading}
          t={t as any}
        />

        {loadError && (
          <InlineNotice tone="error">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">{t("attendance.loadFailed")}</p>
                <p className="mt-0.5 text-xs font-semibold opacity-90">{loadError}</p>
              </div>
              <Button size="sm" variant="outline" className="h-9 rounded-xl border-current/20" onClick={() => void fetchAttendance()}>
                {t("attendance.retry")}
              </Button>
            </div>
          </InlineNotice>
        )}
        {secondaryError && <InlineNotice tone="warning">{secondaryError}</InlineNotice>}

        <AttendanceStatsCards todayRecords={todayRecords} lateEmployees={lateEmployees} t={t as any} />
        <AttendanceViewTabs activeViewMode={activeViewMode} onChange={setActiveViewMode} t={t as any} />

        {activeViewMode === "today" && (
          <AttendanceDashboardView
            todayRecords={todayRecords}
            t={t as any}
            locale={locale}
            onOpenEmployeeFile={(id) => openEmployeeQuickView(String(id))}
          />
        )}
        {activeViewMode === "register" && (
          <RegisterView employees={employees} onRefresh={fetchAttendance} t={t as any} />
        )}
        {activeViewMode === "leaves" && (
          <LeavesView
            leaves={leaves}
            leaveFilter={leaveFilter}
            setLeaveFilter={setLeaveFilter}
            onNewLeave={() => setShowLeaveForm(true)}
            onLeaveAction={handleLeaveAction}
            canApprove={canApproveLeaves}
            loading={leavesLoading}
            t={t as any}
            locale={locale}
          />
        )}
        {activeViewMode === "calendar" && (
          <CalendarView
            records={historyRecords}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            workingHours={workingHours}
            t={t as any}
            locale={locale}
          />
        )}
        {activeViewMode === "analytics" && (
          <MonthlyView processedData={processedData} t={t as any} locale={locale} language={language} />
        )}
        {activeViewMode === "penalties" && (
          <PenaltiesView t={t as any} locale={locale} language={language} employees={employees} />
        )}
        {activeViewMode === "archive" && (
          <ArchiveView
            archiveRecords={archiveRecords}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            page={archivePage}
            setPage={setArchivePage}
            totalPages={archiveTotalPages}
            total={archiveTotal}
            pageSize={pageSize}
            t={t as any}
            locale={locale}
          />
        )}
        </div>
      </PageShell>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">{t("attendance.settingsTitle")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pe-1">
            {/* ===== ساعات العمل لكل يوم ===== */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-muted">{t("attendance.hoursPerDay")}</p>
                <Button variant="outline" size="sm" className="h-8 rounded-lg text-[11px] font-bold" onClick={applyToAllOpenDays}>
                  {t("attendance.applyToAllDays")}
                </Button>
              </div>
              {DAY_KEYS.map((day) => {
                const dayForm = daysForm[day];
                const isOpen = dayForm?.is_open !== false;
                return (
                  <div
                    key={day}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-border bg-muted/5 p-2",
                      !isOpen && "opacity-60",
                    )}
                  >
                    <Switch
                      checked={isOpen}
                      onCheckedChange={(v: boolean) => updateDay(day, { is_open: v })}
                      aria-label={t("workingHours.toggleAria", { day: t(`workingHours.day.${day}`) })}
                    />
                    <span className="w-16 shrink-0 text-xs font-black text-main">
                      {t(`workingHours.day.${day}`)}
                    </span>
                    <Input
                      type="time"
                      value={dayForm?.open_time || "09:00"}
                      onChange={(e) => updateDay(day, { open_time: e.target.value })}
                      disabled={!isOpen}
                      aria-label={t("attendance.openingTime")}
                      className="h-9 rounded-lg text-sm"
                    />
                    <span className="text-muted">←</span>
                    <Input
                      type="time"
                      value={dayForm?.close_time || "22:00"}
                      onChange={(e) => updateDay(day, { close_time: e.target.value })}
                      disabled={!isOpen}
                      aria-label={t("attendance.closingTime")}
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                );
              })}
            </div>

            {/* ===== سياسة التأخير ===== */}
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-muted">{t("attendance.policyTitle")}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="set-late" className="mb-1 block text-[11px] font-bold text-muted">
                    {t("attendance.lateLimit")}
                  </label>
                  <Input id="set-late" type="number" min={0} max={240} value={settingsForm.late_threshold} onChange={(e) => setSettingsForm({ ...settingsForm, late_threshold: Number(e.target.value) })} className="h-11 rounded-xl" />
                </div>
                <div>
                  <label htmlFor="set-penalty" className="mb-1 block text-[11px] font-bold text-muted">
                    {t("attendance.penaltyPerMinute")}
                  </label>
                  <Input id="set-penalty" type="number" min={0} max={100} step="0.25" value={settingsForm.late_penalty_per_minute} onChange={(e) => setSettingsForm({ ...settingsForm, late_penalty_per_minute: Number(e.target.value) })} className="h-11 rounded-xl" />
                </div>
              </div>
              <p className="text-[11px] font-medium text-muted">{t("attendance.penaltyPerMinuteHint")}</p>
              <label htmlFor="set-auto-penalty" className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/10 p-3">
                <Switch
                  id="set-auto-penalty"
                  checked={settingsForm.auto_penalty_enabled}
                  onCheckedChange={(v: boolean) => setSettingsForm({ ...settingsForm, auto_penalty_enabled: v })}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-black text-main">{t("attendance.autoPenaltyLabel")}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-muted">{t("attendance.autoPenaltyHint")}</span>
                </span>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setShowSettings(false)}>
                {t("attendance.cancel")}
              </Button>
              <Button className="h-11 flex-1 rounded-xl" onClick={handleSaveSettings}>
                {t("attendance.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">{t("attendance.newLeave")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="lv-emp" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.employee")}
              </label>
              <Select value={leaveForm.employee_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, employee_id: v })}>
                <SelectTrigger id="lv-emp" className="h-11 rounded-xl">
                  <SelectValue placeholder={t("attendance.selectEmployeeLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.full_name || emp.name || `#${emp.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="lv-type" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.leaveType")}
              </label>
              <Select value={leaveForm.type} onValueChange={(v) => setLeaveForm({ ...leaveForm, type: v })}>
                <SelectTrigger id="lv-type" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">{t("attendance.vacation")}</SelectItem>
                  <SelectItem value="sick">{t("attendance.sick")}</SelectItem>
                  <SelectItem value="other">{t("attendance.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lv-from" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.from")}
                </label>
                <Input id="lv-from" type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} className="h-11 rounded-xl" />
              </div>
              <div>
                <label htmlFor="lv-to" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.to")}
                </label>
                <Input id="lv-to" type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} className="h-11 rounded-xl" />
              </div>
            </div>
            <div>
              <label htmlFor="lv-reason" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.reason")}
              </label>
              <textarea
                id="lv-reason"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                className="mt-1 min-h-[88px] w-full rounded-xl border border-border bg-card p-3 text-sm font-medium"
                placeholder={t("attendance.reasonPlaceholder")}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setShowLeaveForm(false)}>
                {t("attendance.cancel")}
              </Button>
              <Button className="h-11 flex-1 rounded-xl" onClick={handleCreateLeave}>
                {t("attendance.send")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceManagement;
