import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect, useCallback } from "react";
import type {
  AttendanceNotification,
  AttendanceRecord,
  AttendanceSettingsForm,
  LeaveRecord,
} from "@/types/attendance";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useAttendanceData } from "@/features/attendance/hooks/useAttendanceData";
import {
  UserCheck,
  Clock,
  History,
  Search,
  CalendarDays,
  X,
  TrendingUp,
  Coffee,
  BarChart3,
  Plane,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Activity,
  Plus,
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
import { cn } from "@/lib/core/utils";
import {
  PremiumCard,
} from "@/components/shared/PremiumUI";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AttendancePageHeader,
  AttendanceStatsCards,
  AttendanceViewTabs,
} from "@/features/attendance/components/AttendanceHeader";
import AttendanceDashboardView from "@/features/attendance/components/AttendanceDashboardView";
import AttendanceLoading from "@/features/attendance/components/AttendanceLoading";
import type { AttendanceViewMode } from "@/features/attendance/types";

const statusLabels = {
  in: "حضور",
  break: "استراحة",
  break_end: "عودة",
  out: "انصراف",
};

const statusColors = {
  in: "success",
  break: "warning",
  break_end: "info",
  out: "danger",
};

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

  const handleExportPDF = () => {
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

  interface CalendarDay {
  day: number;
  date: string;
  dayOfWeek: string;
  isToday: boolean;
  workingHours: { open_time?: string; close_time?: string; is_open?: boolean } | undefined;
  records: AttendanceRecord[];
  presentCount: number;
  lateCount: number;
}

  // Calendar
  const getCalendarDays = (): (CalendarDay | null)[] => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    const days: (CalendarDay | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split("T")[0];
      const dayRecords = records.filter((r) =>
        r.created_at?.startsWith(dateStr),
      );
      days.push({
        day: i,
        date: dateStr,
        dayOfWeek: date
          .toLocaleDateString("en-US", { weekday: "long" })
          .toLowerCase(),
        isToday: dateStr === new Date().toISOString().split("T")[0],
        workingHours:
          workingHours[
            date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
          ],
        records: dayRecords,
        presentCount: dayRecords.filter((r) => r.status === "in").length,
        lateCount: dayRecords.filter((r) => (r.stats?.lateMinutes ?? 0) > 0).length,
      });
    }
    return days;
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
    <div className="min-h-screen pb-12" dir="rtl">
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Stats Bento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: "حضور اليوم",
                  value: todayRecords.length,
                  color: "text-[#d3a15c]",
                  icon: UserCheck,
                  bg: "bg-[#d3a15c]/10",
                },
                {
                  label: "المتأخرين",
                  value: lateEmployees.length,
                  color: "text-red-500",
                  icon: Clock,
                  bg: "bg-red-500/10",
                },
                {
                  label: "في استراحة",
                  value: todayRecords.filter((r) => r.status === "break")
                    .length,
                  color: "text-orange-500",
                  icon: Coffee,
                  bg: "bg-orange-500/10",
                },
              ].map((s, i) => (
                <PremiumCard key={i} className="p-6" delay={i * 0.1}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center",
                        s.bg,
                      )}
                    >
                      <s.icon className={s.color} size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                        {s.label}
                      </p>
                      <h4 className="text-3xl font-black text-main tabular-nums">
                        {s.value}
                      </h4>
                    </div>
                  </div>
                </PremiumCard>
              ))}
            </div>

            {/* Employee Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todayRecords.length > 0 ? (
                todayRecords.map((rec, i) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-premium transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar
                          imageUrl={
                            (employees.find(
                              (e) => String(e.id) === String(rec.id),
                            )?.profile_image_url as string | undefined)
                          }
                          name={rec.employee_name}
                          size="lg"
                          status={rec.status === "in" ? "active" : "inactive"}
                        />
                        <div>
                          <h3 className="text-base font-black text-main tracking-tight">
                            {rec.employee_name}
                          </h3>
                          <Badge
                            className={cn(
                              "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest mt-1",
                              rec.ai?.color
                                ?.replace("text-", "bg-")
                                .concat("/10"),
                              rec.ai?.color,
                            )}
                          >
                            {rec.ai?.label || "---"}
                          </Badge>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          rec.status === "in"
                            ? "bg-emerald-500 animate-pulse"
                            : rec.status === "break"
                              ? "bg-orange-500 animate-pulse"
                              : "bg-slate-300",
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-soft border border-border/40">
                        <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1">
                          حالة الحضور
                        </p>
                        <span className="text-sm font-black text-main">
                          {statusLabels[rec.status ?? ""] || rec.status}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-soft border border-border/40">
                        <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1">
                          توقيت القيد
                        </p>
                        <span className="text-sm font-black text-main tabular-nums">
                          {new Date(String(rec.created_at || "")).toLocaleTimeString(
                            "ar-EG",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-border/40">
                      <p
                        className={cn(
                          "text-xs font-black uppercase",
                          (rec.stats?.lateMinutes ?? 0) > 0
                            ? "text-red-500"
                            : "text-emerald-600",
                        )}
                      >
                        {(rec.stats?.lateMinutes ?? 0) > 0
                          ? `تأخير: ${rec.stats?.lateMinutes ?? 0} دقيقة`
                          : "انضباط ممتاز"}
                      </p>
                      <Button
                        variant="ghost"
                        className="h-9 px-4 rounded-xl font-black text-[10px] uppercase"
                      >
                        التفاصيل
                      </Button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="md:col-span-2 flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border bg-card">
                  <Activity size={60} className="mb-4 text-muted" />
                  <p className="text-xl font-black text-main">
                    بانتظار تسجيل أول حضور اليوم
                  </p>
                  <p className="mt-1 text-xs font-bold text-muted">
                    لم يتم تسجيل أي حضور حتى الآن
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Monthly View */}
        {activeViewMode === "monthly" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                  <BarChart3 size={16} className="text-primary" /> مقارنة
                  الموظفين
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={processedData.map((emp) => ({
                        name: emp.full_name?.split(" ")[0] || "موظف",
                        ساعات: Number(emp.stats?.totalHours) || 0,
                        تأخير: emp.stats?.lateMinutes || 0,
                      }))}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="opacity-10"
                      />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid var(--border)",
                          fontSize: "12px",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="ساعات"
                        fill="#10b981"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="تأخير"
                        fill="#f59e0b"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4">
                  نسبة الحضور
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "ممتاز (90%+)",
                            value:
                              processedData.filter(
                                (e) =>
                                  ((Number(e.stats?.totalHours) || 0) / 8) *
                                    100 >=
                                  90,
                              ).length || 1,
                            color: "#10b981",
                          },
                          {
                            name: "جيد (70-89%)",
                            value:
                              processedData.filter((e) => {
                                const r =
                                  ((Number(e.stats?.totalHours) || 0) / 8) *
                                  100;
                                return r >= 70 && r < 90;
                              }).length || 1,
                            color: "#3b82f6",
                          },
                          {
                            name: "متوسط (50-69%)",
                            value:
                              processedData.filter((e) => {
                                const r =
                                  ((Number(e.stats?.totalHours) || 0) / 8) *
                                  100;
                                return r >= 50 && r < 70;
                              }).length || 0,
                            color: "#f59e0b",
                          },
                          {
                            name: "ضعيف (<50%)",
                            value:
                              processedData.filter(
                                (e) =>
                                  ((Number(e.stats?.totalHours) || 0) / 8) *
                                    100 <
                                  50,
                              ).length || 0,
                            color: "#ef4444",
                          },
                        ].filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {[
                          { color: "#10b981" },
                          { color: "#3b82f6" },
                          { color: "#f59e0b" },
                          { color: "#ef4444" },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4">الاتجاهات</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[
                        { week: "الأسبوع 1", حضور: 85 },
                        { week: "الأسبوع 2", حضور: 78 },
                        { week: "الأسبوع 3", حضور: 92 },
                        { week: "الأسبوع 4", حضور: 88 },
                      ]}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="opacity-10"
                      />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid var(--border)",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="حضور"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: "#10b981", r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Employee Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {processedData.length > 0 ? (
                processedData.map((emp, i) => {
                  const attendanceRate =
                    ((Number(emp.stats?.totalHours) || 0) / 8) * 100;
                  const rateColor =
                    attendanceRate >= 90
                      ? "emerald"
                      : attendanceRate >= 70
                        ? "blue"
                        : attendanceRate >= 50
                          ? "amber"
                          : "rose";
                  return (
                    <motion.div
                      key={emp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "rounded-2xl border bg-card p-5 shadow-soft hover:shadow-premium transition-all",
                        `border-${rateColor}-200 dark:border-${rateColor}-800`,
                      )}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <EmployeeAvatar
                          name={emp.full_name}
                          size="lg"
                          status={attendanceRate >= 70 ? "active" : "inactive"}
                        />
                        <div className="flex-1">
                          <h3 className="text-base font-black text-main">
                            {emp.full_name}
                          </h3>
                          <p className="text-[9px] font-bold text-muted uppercase">
                            ملخص الأداء الشهري
                          </p>
                        </div>
                        <div
                          className={cn(
                            "px-3 py-1.5 rounded-xl",
                            `bg-${rateColor}-50 dark:bg-${rateColor}-900/20`,
                          )}
                        >
                          <span
                            className={cn(
                              "text-sm font-black",
                              `text-${rateColor}-500`,
                            )}
                          >
                            {attendanceRate.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-soft">
                          <p className="text-[9px] font-black text-muted uppercase mb-1">
                            إجمالي الساعات
                          </p>
                          <p className="text-xl font-black text-main">
                            {Number(emp.stats?.totalHours) || 0}
                            <small className="text-xs"> ساعة</small>
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-soft">
                          <p className="text-[9px] font-black text-muted uppercase mb-1">
                            صافي المستحق
                          </p>
                          <p className="text-xl font-black text-emerald-600">
                            {emp.payroll?.netSalary || 0}
                            <small className="text-xs"> ج.م</small>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant={
                            (emp.stats?.lateMinutes ?? 0) > 0
                              ? "danger"
                              : "secondary"
                          }
                          className="text-[9px] font-black"
                        >
                          {(emp.stats?.lateMinutes ?? 0) > 0
                            ? `${emp.stats?.lateMinutes ?? 0} دقيقة تأخير`
                            : "بدون تأخير"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-black"
                        >
                          {emp.stats?.overtime || 0} ساعة إضافية
                        </Badge>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="md:col-span-2 flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border bg-card">
                  <TrendingUp size={60} className="mb-4 text-muted" />
                  <p className="text-xl font-black text-main">
                    لا توجد بيانات شهرية
                  </p>
                  <p className="mt-1 text-xs font-bold text-muted">
                    لم يتم تسجيل أي بيانات حضور لهذا الشهر
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Leaves View */}
        {activeViewMode === "leaves" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-main flex items-center gap-2">
                <Plane size={20} className="text-primary" /> إدارة الإجازات
              </h3>
              <div className="flex gap-2">
                <select
                  value={leaveFilter}
                  onChange={(e) => setLeaveFilter(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-bold"
                >
                  <option value="all">الكل</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="approved">مقبولة</option>
                  <option value="rejected">مرفوضة</option>
                </select>
                <Button
                  className="h-9 rounded-xl text-xs"
                  onClick={() => setShowLeaveForm(true)}
                >
                  <Plus size={14} className="ml-1" /> طلب جديد
                </Button>
              </div>
            </div>
            {leaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
                <Plane size={40} className="mb-3 text-muted" />
                <p className="text-base font-black text-main">
                  لا توجد طلبات إجازات
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-soft"
                  >
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={leave.employee_name} size="md" />
                      <div>
                        <p className="text-sm font-black text-main">
                          {leave.employee_name}
                        </p>
                        <p className="text-[10px] font-bold text-muted">
                          {leave.type === "vacation"
                            ? "إجازة سنوية"
                            : leave.type === "sick"
                              ? "إجازة مرضية"
                              : "أخرى"}{" "}
                          • {leave.start_date} إلى {leave.end_date}
                        </p>
                        {leave.reason && (
                          <p className="text-[9px] font-bold text-muted mt-0.5">
                            السبب: {leave.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          leave.status === "approved"
                            ? "success"
                            : leave.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                        className="text-[9px] font-black"
                      >
                        {leave.status === "approved"
                          ? "مقبول"
                          : leave.status === "rejected"
                            ? "مرفوض"
                            : "قيد الانتظار"}
                      </Badge>
                      {leave.status === "pending" && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            className="h-8 rounded-lg text-[10px]"
                            onClick={() =>
                              handleLeaveAction(leave.id, "approved")
                            }
                          >
                            <CheckCircle2 size={12} className="ml-1" /> قبول
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="h-8 rounded-lg text-[10px]"
                            onClick={() =>
                              handleLeaveAction(leave.id, "rejected")
                            }
                          >
                            <XCircle size={12} className="ml-1" /> رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Calendar View */}
        {activeViewMode === "calendar" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-main flex items-center gap-2">
                <CalendarDays size={20} className="text-primary" /> تقويم الحضور
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() - 1,
                      ),
                    )
                  }
                  className="h-9 w-9 rounded-lg border border-border hover:bg-soft flex items-center justify-center"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="text-sm font-black text-main min-w-[120px] text-center">
                  {calendarMonth.toLocaleDateString("ar-EG", {
                    year: "numeric",
                    month: "long",
                  })}
                </span>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                      ),
                    )
                  }
                  className="h-9 w-9 rounded-lg border border-border hover:bg-soft flex items-center justify-center"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {[
                  "أحد",
                  "إثنين",
                  "ثلاثاء",
                  "أربعاء",
                  "خميس",
                  "جمعة",
                  "سبت",
                ].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-black text-muted py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays().map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[60px] rounded-lg border p-1.5 text-center transition-all",
                      day
                        ? day.isToday
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:bg-soft"
                        : "border-transparent",
                      day?.workingHours?.is_open === false && "opacity-40",
                    )}
                  >
                    {day && (
                      <>
                        <span
                          className={cn(
                            "text-[10px] font-black",
                            day.isToday ? "text-primary" : "text-main",
                          )}
                        >
                          {day.day}
                        </span>
                        {day.isToday && day.records.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            <div className="text-[8px] font-bold text-emerald-600">
                              {day.presentCount} حضور
                            </div>
                            {day.lateCount > 0 && (
                              <div className="text-[8px] font-bold text-amber-600">
                                {day.lateCount} تأخير
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Archive View */}
        {activeViewMode === "archive" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Filters */}
            <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
                    size={14}
                  />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="البحث في الأرشيف..."
                    className="h-10 w-full pr-9 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 w-full text-xs font-bold"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 w-full text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Archive Table */}
            <div className="overflow-hidden rounded-2xl border overflow-x-auto custom-scrollbar border-border bg-card shadow-soft">
              {archiveRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
                  <History size={40} className="text-muted" />
                  <div>
                    <p className="text-base font-black text-main">
                      لا توجد سجلات
                    </p>
                    <p className="mt-1 text-xs font-bold text-muted">
                      جرّب تغيير نطاق التاريخ أو معايير البحث
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">
                          الموظف
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">
                          نوع العملية
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">
                          التاريخ والوقت
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">
                          الحالة
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archiveRecords.slice(0, 50).map((rec, i) => (
                        <TableRow
                          key={i}
                          className="hover:bg-soft/50 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <EmployeeAvatar
                                name={rec.employee_name}
                                size="sm"
                              />
                              <span className="font-black text-main">
                                {rec.employee_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusColors[rec.status ?? ""] || "secondary"}
                              className="text-[9px] font-black"
                            >
                              {statusLabels[rec.status ?? ""] || rec.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-[10px] font-bold text-muted tabular-nums">
                            {new Date(String(rec.created_at || "")).toLocaleString("ar-EG", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                (rec.stats?.lateMinutes ?? 0) > 0
                                  ? "danger"
                                  : "success"
                              }
                              className="text-[9px] font-black"
                            >
                              {(rec.stats?.lateMinutes ?? 0) > 0
                                ? `متأخر ${rec.stats?.lateMinutes ?? 0}د`
                                : "طبيعي"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowSettings(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowLeaveForm(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
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

