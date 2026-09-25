import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect, useCallback } from "react";
import type {
  AttendanceNotification,
  AttendanceRecord,
  AttendanceSettingsForm,
  LeaveRecord,
} from "@/types/attendance";


import { useNavigate } from "react-router-dom";
import { useAttendanceData } from "@/features/attendance/hooks/useAttendanceData";
import {
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import api from "@/services/api";
import { toast } from "react-hot-toast";




import { Input } from "@/components/ui/input";
import {
  AttendancePageHeader,
  AttendanceStatsCards,
  AttendanceViewTabs,
} from "@/features/attendance/components/AttendanceHeader";
import AttendanceDashboardView from "@/features/attendance/components/AttendanceDashboardView";
import AttendanceLoading from "@/features/attendance/components/AttendanceLoading";
import type { AttendanceViewMode } from "@/features/attendance/types";
import PulseView from "@/features/attendance/components/PulseView";
import MonthlyView from "@/features/attendance/components/MonthlyView";
import LeavesView from "@/features/attendance/components/LeavesView";
import CalendarView from "@/features/attendance/components/CalendarView";
import ArchiveView from "@/features/attendance/components/ArchiveView";

const AttendanceManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    records,
    employees,
    workingHours,
    loading,
    searchTerm,
    setSearchTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    calendarMonth,
    setCalendarMonth,
    fetchAttendance,
    fetchEmployees,
    fetchWorkingHours,
    todayRecords,
    processedData,
    archiveRecords,
    lateEmployees,
  } = useAttendanceData();
  const [activeViewMode, setActiveViewMode] =
    useState<AttendanceViewMode>("dashboard");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [regEmployeeId, setRegEmployeeId] = useState("");
  const [regStatus, setRegStatus] = useState("in");
  const [regTime, setRegTime] = useState(new Date().toISOString().slice(0, 16));
  const [isRegistering, setIsRegistering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employee_id: "",
    type: "vacation",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [leaveFilter, setLeaveFilter] = useState("all");
  const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    Notification?.permission || "default",
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<AttendanceSettingsForm>({
    open_time: "09:00",
    close_time: "22:00",
    late_threshold: 15,
  });
  const isOwner = ["OWNER", "ADMIN"].includes(
    String(user?.role || "").toUpperCase(),
  );



  const handleManualRegister = async () => {
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
      const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      toast.error((apiErr?.response?.data?.detail as string) || apiErr?.message || "فشل تسجيل العملية");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleFileUpload = async (e, type) => {
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
  };

  const handleExportPDF = async () => {
    // Lazy-load the heavy PDF libs only when the user actually exports (~430KB saved).
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("Barber Luxe OS - Attendance Report", 14, 20);
    let dataToExport: AttendanceRecord[] = [];
    if (activeViewMode === "dashboard") dataToExport = todayRecords;
    else if (activeViewMode === "monthly") dataToExport = processedData;
    else dataToExport = archiveRecords;
    const tableData = dataToExport.map((r) => [
      r.employee_name || r.full_name || "Unknown",
      r.status || (r.stats ? "Aggregated" : "N/A"),
      r.created_at
        ? new Date(r.created_at).toLocaleString("ar-EG")
        : "Report Data",
    ]);
    autoTable(doc, {
      startY: 30,
      head: [["Employee", "Status", "Timestamp"]],
      body: tableData,
    });
    doc.save(
      `attendance_${activeViewMode}_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    toast.success("تم تحميل تقرير PDF");
  };

  // Leave Management
  const fetchLeaves = useCallback(async () => {
    try {
      const res = await api.get("/barber-presence/leaves", {
        params: { status: leaveFilter === "all" ? undefined : leaveFilter },
      });
      setLeaves(res.data || []);
    } catch (err) {
      /* ignore */
    }
  }, [leaveFilter]);

  const handleCreateLeave = async () => {
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
      setLeaveForm({
        employee_id: "",
        type: "vacation",
        start_date: "",
        end_date: "",
        reason: "",
      });
      fetchLeaves();
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      toast.error((apiErr?.response?.data?.detail as string) || apiErr?.message || "فشل إرسال الطلب");
    }
  };

  const handleLeaveAction = async (leaveId, action) => {
    try {
      await api.patch(`/barber-presence/leaves/${leaveId}`, { status: action });
      toast.success(action === "approved" ? "تم قبول الطلب" : "تم رفض الطلب");
      fetchLeaves();
    } catch (err) {
      toast.error("فشل تحديث الطلب");
    }
  };

  // Notifications
  const requestNotificationPermission = async () => {
    if (!("Notification" in window))
      return toast.error("المتصفح لا يدعم الإشعارات");
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === "granted") toast.success("تم تفعيل الإشعارات");
  };

  const sendNotification = (title, body) => {
    if (notifPermission === "granted")
      new Notification(title, { body, icon: "/favicon.ico" });
  };

  // Settings
  const handleSaveSettings = async () => {
    try {
      const workingHoursPayload = {};
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
    } catch (err) {
      toast.error("فشل حفظ الإعدادات");
    }
  };



  // Alert check
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
  }, [todayRecords, notifPermission]);

  if (loading) {
    return <AttendanceLoading />;
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <AttendancePageHeader
          onShowSettings={() => setShowSettings(true)}
          onExportPDF={handleExportPDF}
          onRefresh={fetchAttendance}
        />

        {/* Stats Cards */}
        <AttendanceStatsCards
          todayRecords={todayRecords}
          lateEmployees={lateEmployees}
        />

        {/* Tab Navigation */}
        <AttendanceViewTabs
          activeViewMode={activeViewMode}
          onChange={setActiveViewMode}
        />

        {/* Dashboard View */}
        {activeViewMode === "dashboard" && (
          <AttendanceDashboardView todayRecords={todayRecords} />
        )}

        {/* Pulse View */}
        {activeViewMode === "pulse" && (
          <PulseView
            todayRecords={todayRecords}
            lateEmployees={lateEmployees}
            employees={employees}
          />
        )}

        {/* Monthly View */}
        {activeViewMode === "monthly" && (
          <MonthlyView processedData={processedData} />
        )}

        {/* Leaves View */}
        {activeViewMode === "leaves" && (
          <LeavesView
            leaves={leaves}
            leaveFilter={leaveFilter}
            setLeaveFilter={setLeaveFilter}
            onNewLeave={() => setShowLeaveForm(true)}
            onLeaveAction={handleLeaveAction}
          />
        )}

        {/* Calendar View */}
        {activeViewMode === "calendar" && (
          <CalendarView
            records={records}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            workingHours={workingHours}
          />
        )}

        {/* Archive View */}
        {activeViewMode === "archive" && (
          <ArchiveView
            archiveRecords={archiveRecords}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
         <div
           role="button"
           tabIndex={0}
           className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
           onClick={() => setShowSettings(false)}
           onKeyDown={(event) => {
             if (event.key === "Escape") {
               setShowSettings(false);
             }
           }}
         >

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
             className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
             role="dialog"
             aria-modal="true"
             tabIndex={-1}
             onClick={(e) => e.stopPropagation()}
             onKeyDown={(e) => e.stopPropagation()}

          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-main">إعدادات الحضور</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSettings(false)}
              >
                <X size={16} />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  وقت الافتتاح
                </label>
                <Input
                  type="time"
                  value={settingsForm.open_time}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      open_time: e.target.value,
                    })
                  }
                  className="h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  وقت الإغلاق
                </label>
                <Input
                  type="time"
                  value={settingsForm.close_time}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      close_time: e.target.value,
                    })
                  }
                  className="h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  حد التأخير (دقائق)
                </label>
                <Input
                  type="number"
                  value={settingsForm.late_threshold}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      late_threshold: Number(e.target.value),
                    })
                  }
                  className="h-10 rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="h-10 flex-1 rounded-xl"
                onClick={() => setShowSettings(false)}
              >
                إلغاء
              </Button>
              <Button
                className="h-10 flex-1 rounded-xl"
                onClick={handleSaveSettings}
              >
                حفظ
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Leave Form Modal */}
      {showLeaveForm && (
         <div
           role="button"
           tabIndex={0}
           className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
           onClick={() => setShowLeaveForm(false)}
           onKeyDown={(event) => {
             if (event.key === "Escape") {
               setShowLeaveForm(false);
             }
           }}
         >

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
             className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
             role="dialog"
             aria-modal="true"
             tabIndex={-1}
             onClick={(e) => e.stopPropagation()}
             onKeyDown={(e) => e.stopPropagation()}

          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-main">طلب إجازة جديد</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowLeaveForm(false)}
              >
                <X size={16} />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الموظف
                </label>
                <Select
                  value={leaveForm.employee_id}
                  onValueChange={(v) =>
                    setLeaveForm({ ...leaveForm, employee_id: v })
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl mt-1">
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  نوع الإجازة
                </label>
                <Select
                  value={leaveForm.type}
                  onValueChange={(v) => setLeaveForm({ ...leaveForm, type: v })}
                >
                  <SelectTrigger className="h-10 rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">إجازة سنوية</SelectItem>
                    <SelectItem value="sick">إجازة مرضية</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    من
                  </label>
                  <Input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, start_date: e.target.value })
                    }
                    className="h-10 rounded-xl mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    إلى
                  </label>
                  <Input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, end_date: e.target.value })
                    }
                    className="h-10 rounded-xl mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  السبب
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, reason: e.target.value })
                  }
                  className="w-full h-20 rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none mt-1"
                  placeholder="اختياري..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="h-10 flex-1 rounded-xl"
                onClick={() => setShowLeaveForm(false)}
              >
                إلغاء
              </Button>
              <Button
                className="h-10 flex-1 rounded-xl"
                onClick={handleCreateLeave}
              >
                إرسال
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;

