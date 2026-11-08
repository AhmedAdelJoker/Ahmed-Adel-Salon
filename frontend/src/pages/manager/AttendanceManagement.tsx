import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import InlineNotice from "@/components/shared/InlineNotice";
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
  RegisterView,
  useAttendanceData,
} from "@/features/attendance";
import type { AttendanceSettingsForm, AttendanceViewMode } from "@/features/attendance/types";
import { emptyLeaveForm } from "@/features/attendance/types";
import { exportAttendancePDF } from "@/features/attendance/utils/attendance";

const AttendanceManagement = () => {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  const { user } = useAuth();
  const { openEmployeeQuickView } = useUI();

  const data = useAttendanceData({ t: t as any });
  const {
    records,
    employees,
    workingHours,
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
  });
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ ...emptyLeaveForm });

  const canApproveLeaves = ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT"].includes(
    String(user?.role || "").toUpperCase(),
  );

  useEffect(() => {
    if (activeViewMode === "leaves") {
      void fetchLeaves(leaveFilter);
    }
  }, [activeViewMode, leaveFilter, fetchLeaves]);

  // Seed settings from any available working-hours day (best effort).
  useEffect(() => {
    const days = Object.values(workingHours || {});
    const openDay = days.find((d) => d?.is_open && d.open_time && d.close_time);
    if (openDay?.open_time || openDay?.close_time) {
      setSettingsForm((s) => ({
        ...s,
        open_time: openDay.open_time || s.open_time,
        close_time: openDay.close_time || s.close_time,
      }));
    }
  }, [workingHours]);

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

  const handleSaveSettings = async () => {
    try {
      const workingHoursPayload: Record<string, unknown> = {};
      [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ].forEach((day) => {
        workingHoursPayload[day] = {
          is_open: true,
          open_time: settingsForm.open_time,
          close_time: settingsForm.close_time,
        };
      });
      await api.post("/barber-presence/working-hours", {
        working_hours: workingHoursPayload,
      });
      toast.success(t("attendance.settingsSaved"));
      setShowSettings(false);
      await fetchAttendance();
    } catch {
      toast.error(t("attendance.settingsFailed"));
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
          onRefresh={fetchAttendance}
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
            records={records}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            workingHours={workingHours}
            t={t as any}
            locale={locale}
          />
        )}
        {activeViewMode === "analytics" && <MonthlyView processedData={processedData} t={t as any} />}
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
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">{t("attendance.settingsTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted">{t("attendance.settingsWorkingHoursHint")}</p>
            <div>
              <label htmlFor="set-open" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.openingTime")}
              </label>
              <Input id="set-open" type="time" value={settingsForm.open_time} onChange={(e) => setSettingsForm({ ...settingsForm, open_time: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div>
              <label htmlFor="set-close" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.closingTime")}
              </label>
              <Input id="set-close" type="time" value={settingsForm.close_time} onChange={(e) => setSettingsForm({ ...settingsForm, close_time: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div>
              <label htmlFor="set-late" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.lateLimit")}
              </label>
              <Input id="set-late" type="number" value={settingsForm.late_threshold} onChange={(e) => setSettingsForm({ ...settingsForm, late_threshold: Number(e.target.value) })} className="h-11 rounded-xl" />
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
