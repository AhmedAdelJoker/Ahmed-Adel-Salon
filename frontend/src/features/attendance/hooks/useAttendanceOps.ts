import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import type {
  AttendanceNotification,
  AttendanceRecord,
  AttendanceSettingsForm,
  AttendanceViewMode,
  LeaveFormState,
  LeaveRecord,
} from "@/features/attendance/types";
import { emptyLeaveForm } from "@/features/attendance/types";
import { exportAttendancePDF, type TranslateFn } from "@/features/attendance/utils/attendance";

/**
 * Attendance mutations & side-effects (compatibility hook).
 * The main page currently owns its flows; this is kept compiling for barrel consumers.
 */
export function useAttendanceOps(opts: {
  rows: AttendanceRecord[];
  activeViewMode: AttendanceViewMode;
  locale: string;
  t: TranslateFn;
  fetchAttendance: () => Promise<void> | void;
  fetchWorkingHours?: () => Promise<void> | void;
}) {
  const { rows, activeViewMode, locale, t, fetchAttendance } = opts;

  const [regEmployeeId, setRegEmployeeId] = useState("");
  const [regStatus, setRegStatus] = useState("in");
  const [regTime, setRegTime] = useState(new Date().toISOString().slice(0, 16));
  const [lateReason, setLateReason] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState<LeaveFormState>({ ...emptyLeaveForm });
  const [leaveFilter, setLeaveFilter] = useState("all");

  const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<AttendanceSettingsForm>({
    open_time: "09:00",
    close_time: "22:00",
    late_threshold: 15,
    late_penalty_per_minute: 0.5,
    auto_penalty_enabled: true,
  });

  const handleManualRegister = useCallback(async () => {
    if (!regEmployeeId) return toast.error(t("attendance.selectEmployee"));
    setIsRegistering(true);
    try {
      await api.post("/barber-presence/register", null, {
        params: {
          employee_id: regEmployeeId,
          status_type: regStatus,
          timestamp: regTime,
          ...(lateReason ? { late_reason: lateReason } : {}),
        },
      });
      toast.success(t("attendance.registerSuccess"));
      await fetchAttendance();
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      toast.error(
        (typeof apiErr?.response?.data?.detail === "string" && apiErr.response.data.detail) ||
          apiErr?.message ||
          t("attendance.registerFailed"),
      );
    } finally {
      setIsRegistering(false);
    }
  }, [regEmployeeId, regStatus, regTime, lateReason, fetchAttendance, t]);

  const handleFileUpload = useCallback(
    async (e: any, type: string) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      setIsImporting(true);
      const endpoint =
        type === "excel"
          ? "/barber-presence/import-excel"
          : "/barber-presence/import-biometric";
      try {
        await api.post(endpoint, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(t("attendance.importSuccess"));
        await fetchAttendance();
      } catch {
        toast.error(t("attendance.importFailed"));
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    },
    [fetchAttendance, t],
  );

  const handleExportPDF = useCallback(() => {
    void exportAttendancePDF({ activeViewMode, rows, locale, t });
  }, [activeViewMode, rows, locale, t]);

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await api.get("/barber-presence/leaves", {
        params: { status: leaveFilter === "all" ? undefined : leaveFilter },
      });
      setLeaves(res.data || []);
    } catch {
      /* ignore */
    }
  }, [leaveFilter]);

  const handleCreateLeave = useCallback(async () => {
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) {
      return toast.error(t("attendance.completeFields"));
    }
    try {
      await api.post("/barber-presence/leaves", leaveForm);
      toast.success(t("attendance.leaveSent"));
      setShowLeaveForm(false);
      setLeaveForm({ ...emptyLeaveForm });
      fetchLeaves();
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      toast.error(
        (typeof apiErr?.response?.data?.detail === "string" && apiErr.response.data.detail) ||
          apiErr?.message ||
          t("attendance.leaveFailed"),
      );
    }
  }, [leaveForm, fetchLeaves, t]);

  const handleLeaveAction = useCallback(
    async (leaveId: string | number | undefined, action: string) => {
      try {
        await api.patch(`/barber-presence/leaves/${leaveId}`, { status: action });
        toast.success(action === "approved" ? t("attendance.leaveApproved") : t("attendance.leaveRejected"));
        fetchLeaves();
      } catch {
        toast.error(t("attendance.leaveFailed"));
      }
    },
    [fetchLeaves, t],
  );

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) return toast.error(t("attendance.noNotifications"));
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === "granted") toast.success(t("attendance.notificationsOn"));
  }, [t]);

  useEffect(() => {
    void fetchLeaves();
  }, [fetchLeaves]);

  return {
    regEmployeeId,
    setRegEmployeeId,
    regStatus,
    setRegStatus,
    regTime,
    setRegTime,
    lateReason,
    setLateReason,
    isRegistering,
    isImporting,
    leaves,
    showLeaveForm,
    setShowLeaveForm,
    leaveForm,
    setLeaveForm,
    leaveFilter,
    setLeaveFilter,
    notifications,
    notifPermission,
    showSettings,
    setShowSettings,
    settingsForm,
    setSettingsForm,
    handleManualRegister,
    handleFileUpload,
    handleExportPDF,
    fetchLeaves,
    handleCreateLeave,
    handleLeaveAction,
    requestNotificationPermission,
  };
}
