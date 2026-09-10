import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import type {
  AttendanceNotification,
  AttendanceRecord,
  AttendanceSettingsForm,
  AttendanceViewMode,
  EmployeeRecord,
  LeaveFormState,
  LeaveRecord,
  WorkingHours,
} from "@/features/attendance/types";
import { emptyLeaveForm } from "@/features/attendance/types";
import { exportAttendancePDF } from "@/features/attendance/utils/attendance";

/**
 * Attendance mutations & side-effects: manual register, import,
 * leaves, notifications, settings and PDF export.
 * Moved verbatim from `AttendanceManagement.tsx`.
 */
export function useAttendanceOps(opts: {
  todayRecords: AttendanceRecord[];
  processedData: AttendanceRecord[];
  archiveRecords: AttendanceRecord[];
  activeViewMode: AttendanceViewMode;
  employees: EmployeeRecord[];
  workingHours: WorkingHours;
  fetchAttendance: () => Promise<void>;
  fetchWorkingHours: () => Promise<void>;
}) {
  const {
    todayRecords,
    processedData,
    archiveRecords,
    activeViewMode,
    fetchAttendance,
    fetchWorkingHours,
  } = opts;

  const [regEmployeeId, setRegEmployeeId] = useState("");
  const [regStatus, setRegStatus] = useState("in");
  const [regTime, setRegTime] = useState(new Date().toISOString().slice(0, 16));
  const [isRegistering, setIsRegistering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState<LeaveFormState>({
    ...emptyLeaveForm,
  });
  const [leaveFilter, setLeaveFilter] = useState("all");

  const [notifications, setNotifications] = useState<AttendanceNotification[]>(
    [],
  );
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification?.permission : "default",
  );

  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<AttendanceSettingsForm>({
    open_time: "09:00",
    close_time: "22:00",
    late_threshold: 15,
  });

  const handleManualRegister = useCallback(async () => {
    if (!regEmployeeId) return toast.error("يرجى اختيار الموظف");
    setIsRegistering(true);
    try {
      await api.post("/barber-presence/register", null, {
        params: {
          employee_id: regEmployeeId,
          status_type: regStatus,
          timestamp: regTime,
        },
      });
      toast.success("تم تسجيل العملية بنجاح");
      fetchAttendance();
    } catch (err) {
      const apiErr = err as {
        response?: { data?: { detail?: unknown } };
        message?: string;
      };
      toast.error(
        (apiErr?.response?.data?.detail as string) ||
          apiErr?.message ||
          "فشل تسجيل العملية",
      );
    } finally {
      setIsRegistering(false);
    }
  }, [regEmployeeId, regStatus, regTime, fetchAttendance]);

  const handleFileUpload = useCallback(
    async (e: any, type: string) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      setIsImporting(true);
      const endpoint =
        type === "excel"
          ? "/barber-presence/import-excel"
          : "/barber-presence/import-biometric";
      try {
        const res = await api.post(endpoint, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(res.data?.message || "تم الاستيراد بنجاح");
        fetchAttendance();
      } catch (_err) {
        toast.error("فشل استيراد الملف");
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    },
    [fetchAttendance],
  );

  const handleExportPDF = useCallback(() => {
    exportAttendancePDF({
      activeViewMode,
      todayRecords,
      processedData,
      archiveRecords,
    });
  }, [activeViewMode, todayRecords, processedData, archiveRecords]);

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await api.get("/barber-presence/leaves", {
        params: { status: leaveFilter === "all" ? undefined : leaveFilter },
      });
      setLeaves(res.data || []);
    } catch (_err) {
      /* ignore */
    }
  }, [leaveFilter]);

  const handleCreateLeave = useCallback(async () => {
    if (
      !leaveForm.employee_id ||
      !leaveForm.start_date ||
      !leaveForm.end_date
    ) {
      return toast.error("يرجى إكمال جميع الحقول المطلوبة");
    }
    try {
      await api.post("/barber-presence/leaves", leaveForm);
      toast.success("تم إرسال طلب الإجازة");
      setShowLeaveForm(false);
      setLeaveForm({ ...emptyLeaveForm });
      fetchLeaves();
    } catch (err) {
      const apiErr = err as {
        response?: { data?: { detail?: unknown } };
        message?: string;
      };
      toast.error(
        (apiErr?.response?.data?.detail as string) ||
          apiErr?.message ||
          "فشل إرسال الطلب",
      );
    }
  }, [leaveForm, fetchLeaves]);

  const handleLeaveAction = useCallback(
    async (leaveId: string | number | undefined, action: string) => {
      try {
        await api.patch(`/barber-presence/leaves/${leaveId}`, {
          status: action,
        });
        toast.success(action === "approved" ? "تم قبول الطلب" : "تم رفض الطلب");
        fetchLeaves();
      } catch (_err) {
        toast.error("فشل تحديث الطلب");
      }
    },
    [fetchLeaves],
  );

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window))
      return toast.error("المتصفح لا يدعم الإشعارات");
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === "granted") toast.success("تم تفعيل الإشعارات");
  }, []);

  const sendNotification = useCallback(
    (title: string, body: string) => {
      if (notifPermission === "granted")
        new Notification(title, { body, icon: "/favicon.ico" });
    },
    [notifPermission],
  );

  const handleSaveSettings = useCallback(async () => {
    try {
      const workingHoursPayload: Record<string, unknown> = {};
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      days.forEach((day) => {
        workingHoursPayload[day] = {
          is_open: true,
          open_time: settingsForm.open_time,
          close_time: settingsForm.close_time,
        };
      });
      await api.post("/barber-presence/working-hours", {
        working_hours: workingHoursPayload,
      });
      toast.success("تم حفظ الإعدادات");
      setShowSettings(false);
      fetchWorkingHours();
    } catch (_err) {
      toast.error("فشل حفظ الإعدادات");
    }
  }, [settingsForm, fetchWorkingHours]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 22) {
        const stillIn = todayRecords.filter(
          (p) => Number(p.stats?.totalHours) > 0 && !p.isComplete,
        );
        if (stillIn.length > 0) {
          sendNotification(
            "تذكير الانصراف",
            ` ${stillIn.length} موظف لم يسجلوا انصراف بعد`,
          );
          setNotifications((prev) => [
            ...prev,
            {
              id: Date.now(),
              title: "تذكير الانصراف",
              message: `${stillIn.length} موظف لم يسجلوا انصراف`,
              time: new Date(),
              read: false,
            },
          ]);
        }
      }
    }, 3600000);
    return () => clearInterval(interval);
  }, [todayRecords, sendNotification]);

  return {
    regEmployeeId,
    setRegEmployeeId,
    regStatus,
    setRegStatus,
    regTime,
    setRegTime,
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
    sendNotification,
    handleSaveSettings,
  };
}
