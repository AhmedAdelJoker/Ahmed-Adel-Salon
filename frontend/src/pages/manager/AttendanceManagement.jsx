import { useAuth } from "../../context/AuthContext";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

import { useNavigate, useSearchParams } from "react-router-dom";
import {
  UserCheck,
  Clock,
  History,
  AlertCircle,
  MinusCircle,
  Plus,
  Search,
  ChevronDown,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  Award,
  Calendar,
  X,
  Download,
  Upload,
  User,
  Filter,
  Activity,
  FileSpreadsheet,
  RefreshCw,
  Cpu,
  TrendingUp,
  Brain,
  Zap,
  Coffee,
  Database,
  LayoutGrid,
  FileText
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import { adaptList } from "../../services/apiAdapter";
import exportService from "../../services/exportService";
import { toast } from "react-hot-toast";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import {
  calculateAdvancedHours,
  calculatePayroll,
  analyzeProductivity,
} from "../../lib/attendanceEngine";
import { cn } from "../../lib/utils";
import { EmployeeAvatar } from "../../components/shared/EmployeeAvatar";

const AttendanceManagement = () => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get("employeeId");

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeViewMode, setActiveViewMode] = useState("pulse"); // pulse | monthly | archive
  
  // Filters
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [penaltyReason, setPenaltyReason] = useState("");
  const [isSubmittingPenalty, setIsSubmittingPenalty] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // Registration States
  const [regEmployeeId, setRegEmployeeId] = useState("");
  const [regStatus, setRegStatus] = useState("in");
  const [regTime, setRegTime] = useState(new Date().toISOString().slice(0, 16));
  const [isRegistering, setIsRegistering] = useState(false);

  // Import States
  const [isImporting, setIsImporting] = useState(false);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/attendance/logs", { params: { limit: 1500 } });
      setRecords(adaptList(res));
    } catch (err) {
      toast.error("فشل تحميل سجلات الحضور");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get("/employees");
      setEmployees(adaptList(res));
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
    fetchEmployees();
  }, [fetchAttendance, fetchEmployees]);

  const handleManualRegister = async () => {
    if (!regEmployeeId) {
      toast.error("يرجى اختيار الموظف");
      return;
    }
    setIsRegistering(true);
    try {
      await api.post("/attendance/register", null, {
        params: {
          employee_id: regEmployeeId,
          status_type: regStatus,
          timestamp: regTime,
        },
      });
      toast.success("تم تسجيل العملية بنجاح");
      fetchAttendance();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "فشل تسجيل العملية");
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
    const endpoint = type === "excel" ? "/attendance/import-excel" : "/attendance/import-biometric";
    try {
      const res = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(res.message || "تم الاستيراد بنجاح");
      fetchAttendance();
    } catch (err) {
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
    
    let dataToExport = [];
    if (activeViewMode === "pulse") dataToExport = todayRecords;
    else if (activeViewMode === "monthly") dataToExport = processedData;
    else dataToExport = archiveRecords;

    const tableData = dataToExport.map((r) => [
      r.employee_name || r.full_name || "Unknown",
      r.status || (r.stats ? "Aggregated" : "N/A"),
      r.created_at ? new Date(r.created_at).toLocaleString("ar-EG") : "Report Data",
    ]);

    doc.autoTable({
      startY: 30,
      head: [["Employee", "Status", "Timestamp"]],
      body: tableData,
    });
    doc.save(`attendance_${activeViewMode}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("تم تحميل تقرير PDF");
  };

  // --- Logic Processing ---
  
  // Today's Pulse Filter
  const todayRecords = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = records.filter(r => r.created_at?.startsWith(todayStr));
    
    const grouped = {};
    todayLogs.forEach(rec => {
      const id = rec.employee_id;
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(rec);
    });

    return Object.keys(grouped).map(empId => {
      const empRecords = grouped[empId];
      const employee = employees.find(e => String(e.id) === String(empId)) || { full_name: empRecords[0].employee_name };
      const stats = calculateAdvancedHours(empRecords);
      const ai = analyzeProductivity(stats);
      return { ...empRecords[0], id: empId, stats, ai, all_logs: empRecords };
    });
  }, [records, employees]);

  // Monthly Aggregation
  const processedData = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthLogs = records.filter(r => r.created_at?.startsWith(currentMonth));
    
    const grouped = {};
    monthLogs.forEach(rec => {
      const id = rec.employee_id;
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(rec);
    });

    return Object.keys(grouped).map(empId => {
      const empRecords = grouped[empId];
      const employee = employees.find(e => String(e.id) === String(empId)) || { full_name: empRecords[0].employee_name };
      const stats = calculateAdvancedHours(empRecords);
      const payroll = calculatePayroll(employee, stats);
      const ai = analyzeProductivity(stats);
      return { ...empRecords[0], id: empId, stats, payroll, ai, all_logs: empRecords, full_name: employee.full_name };
    });
  }, [records, employees]);

  // Archive Filter
  const archiveRecords = useMemo(() => {
    return records.filter(r => {
      const recDate = r.created_at?.split("T")[0];
      const matchesDate = recDate >= startDate && recDate <= endDate;
      const matchesSearch = (r.employee_name || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEmployee = employeeIdFilter ? String(r.employee_id) === String(employeeIdFilter) : true;
      return matchesDate && matchesSearch && matchesEmployee;
    });
  }, [records, searchTerm, employeeIdFilter, startDate, endDate]);

  const lateEmployees = todayRecords.filter((r) => r.stats.lateMinutes > 0);

  if (loading)
    return (
      <div className="flex min-h-[70vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-[#17110e] text-[#d3a15c] flex items-center justify-center shadow-2xl animate-pulse">
            <UserCheck size={32} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8a5a25] animate-pulse">
            Establishing Intelligence Matrix...
          </p>
        </div>
      </div>
    );

  return (
    <div className="erp-page-container space-y-12 pb-24" dir="rtl">
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="تأكيد اعتماد الجزاء المالي؟"
        description="سيتم توثيق هذا الخصم في السجل الاستراتيجي للموظف واعتماده في مسير الرواتب القادم."
        onConfirm={() => {}}
      />

      {/* 1. Executive Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-[#17110e] rounded-[2.5rem] flex items-center justify-center shadow-2xl relative group">
            <div className="absolute inset-0 bg-[#d3a15c]/20 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <UserCheck className="text-[#d3a15c] w-10 h-10 relative z-10" strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black text-main tracking-tighter leading-none">Attendance Command</h1>
            <p className="text-base font-bold text-muted flex items-center gap-2">
              إدارة الحضور <span className="h-1 w-1 rounded-full bg-accent" /> الأرشيف التنفيذي <span className="h-1 w-1 rounded-full bg-accent" /> تحليلات الانضباط
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <Button variant="outline" onClick={handleExportPDF} className="h-14 rounded-2xl font-black px-8 border-border bg-white shadow-sm gap-3 hover:border-accent">
            تصدير PDF <Download className="text-[#8a5a25]" size={18} />
          </Button>
          <Button onClick={fetchAttendance} className="h-14 rounded-2xl font-black px-12 bg-[#17110e] text-[#d3a15c] shadow-2xl shadow-black/20 gap-3">
            <RefreshCw size={20} strokeWidth={2.5} /> مزامنة السجل
          </Button>
        </div>
      </div>

      {/* 2. Unified Navigation Tabs */}
      <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md p-2 rounded-[2.5rem] border border-white/20 w-fit">
         {[
           { id: "pulse", label: "نبض اليوم (Live)", icon: Zap },
           { id: "monthly", label: "إحصائيات الشهر", icon: TrendingUp },
           { id: "archive", label: "الأرشيف الكامل", icon: History },
         ].map(mode => (
           <button 
             key={mode.id}
             onClick={() => setActiveViewMode(mode.id)}
             className={cn(
               "h-14 px-10 rounded-[2rem] flex items-center gap-3 font-black text-sm transition-all",
               activeViewMode === mode.id ? "bg-[#17110e] text-[#d3a15c] shadow-xl" : "text-muted hover:bg-white hover:text-main"
             )}
           >
              <mode.icon size={18} /> {mode.label}
           </button>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12">
        {/* 3. Main Operational Area */}
        <div className="space-y-10">
          
          {activeViewMode === "pulse" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
               {/* Today's Stats Bento */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: "حضور اليوم", value: todayRecords.length, color: "text-[#d3a15c]", icon: UserCheck },
                    { label: "المتأخرين", value: lateEmployees.length, color: "text-red-500", icon: Clock },
                    { label: "في استراحة", value: todayRecords.filter(r => r.status === "break").length, color: "text-orange-500", icon: Coffee },
                  ].map((s, i) => (
                    <Card key={i} className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
                       <div className="relative z-10 flex flex-col gap-2">
                          <s.icon className={cn("mb-2", s.color)} size={24} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted">{s.label}</p>
                          <h4 className="text-4xl font-black text-main tabular-nums">{s.value}</h4>
                       </div>
                    </Card>
                  ))}
               </div>

               {/* Today's Cards */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {todayRecords.length > 0 ? todayRecords.map(rec => (
                    <motion.div layout key={rec.id} className="group relative bg-white rounded-[3rem] p-10 shadow-xl border border-transparent hover:border-[#d3a15c]/20 overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform" />
                       <div className="relative">
                          <div className="flex justify-between items-start mb-8">
                             <div className="flex items-center gap-5">
                                <EmployeeAvatar
                                  imageUrl={employees.find(e => String(e.id) === String(rec.id))?.profile_image_url}
                                  name={rec.employee_name}
                                  size="xl"
                                  status={rec.status === 'in' ? 'active' : 'inactive'}
                                />
                                <div className="space-y-1">
                                   <h3 className="text-2xl font-black text-main tracking-tight">{rec.employee_name}</h3>
                                   <Badge className={cn("rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest", rec.ai.color.replace("text-", "bg-").concat("/10"), rec.ai.color)}>{rec.ai.label}</Badge>
                                </div>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-8">
                             <div className="p-5 rounded-[2rem] bg-soft/50 border border-border/40 shadow-inner group-hover:bg-white transition-colors">
                                <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1">حالة الحضور</p>
                                <div className="flex items-center gap-2">
                                   <div className={cn("h-2 w-2 rounded-full animate-pulse", rec.status === "in" ? "bg-emerald-500" : (rec.status === "break" ? "bg-orange-500" : "bg-red-500"))} />
                                   <span className="text-sm font-black text-main">{rec.status === "in" ? "متواجد" : (rec.status === "break" ? "استراحة" : "انصراف")}</span>
                                </div>
                             </div>
                             <div className="p-5 rounded-[2rem] bg-soft/50 border border-border/40 shadow-inner group-hover:bg-white transition-colors">
                                <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1">توقيت القيد</p>
                                <span className="text-sm font-black text-main tabular-nums">{new Date(rec.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                             </div>
                          </div>

                          <div className="flex items-center justify-between pt-6 border-t border-border/40">
                             <p className={cn("text-xs font-black uppercase", rec.stats.lateMinutes > 0 ? "text-red-500" : "text-emerald-600")}>
                                {rec.stats.lateMinutes > 0 ? `تأخير: ${rec.stats.lateMinutes} دقيقة` : "انضباط ممتاز"}
                             </p>
                             <Button variant="ghost" className="h-10 px-6 rounded-xl font-black text-[10px] uppercase">التفاصيل الكاملة</Button>
                          </div>
                       </div>
                    </motion.div>
                  )) : (
                    <div className="md:col-span-2 py-32 text-center opacity-30">
                       <Activity size={80} className="mx-auto mb-4 text-muted" />
                       <p className="text-xl font-black uppercase">بانتظار تسجيل أول حضور اليوم</p>
                    </div>
                  )}
               </div>
            </div>
          )}

          {activeViewMode === "monthly" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {processedData.map(emp => (
                    <Card key={emp.id} className="p-10 rounded-[3rem] border-none shadow-xl bg-white hover:shadow-2xl transition-all group relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-40 h-40 bg-[#17110e]/5 rounded-full -mr-20 -mt-20 group-hover:scale-125 transition-transform" />
                       <div className="relative z-10 space-y-8">
                          <div className="flex items-center gap-6">
                             <EmployeeAvatar
                               imageUrl={employees.find(e => String(e.id) === String(emp.id))?.profile_image_url}
                               name={emp.full_name}
                               size="xl"
                             />
                             <div>
                                <h3 className="text-2xl font-black text-main">{emp.full_name}</h3>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Monthly Performance Summary</p>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6">
                             <div className="p-6 rounded-[2rem] bg-soft shadow-inner">
                                <p className="text-[9px] font-black text-muted uppercase mb-2">إجمالي الساعات</p>
                                <h4 className="text-2xl font-black text-main">{emp.stats.totalHours} <small className="text-xs">Hrs</small></h4>
                             </div>
                             <div className="p-6 rounded-[2rem] bg-soft shadow-inner">
                                <p className="text-[9px] font-black text-muted uppercase mb-2">صافي المستحق</p>
                                <h4 className="text-2xl font-black text-[#d3a15c]">{emp.payroll.netSalary} <small className="text-xs">EGP</small></h4>
                             </div>
                             <div className="p-6 rounded-[2rem] bg-soft shadow-inner">
                                <p className="text-[9px] font-black text-muted uppercase mb-2">أداء الـ AI</p>
                                <span className={cn("text-sm font-black", emp.ai.color)}>{emp.ai.label}</span>
                             </div>
                             <div className="p-6 rounded-[2rem] bg-soft shadow-inner">
                                <p className="text-[9px] font-black text-muted uppercase mb-2">ساعات إضافية</p>
                                <h4 className="text-2xl font-black text-emerald-600">{emp.stats.overtime} <small className="text-xs">Hrs</small></h4>
                             </div>
                          </div>
                          <Button variant="outline" onClick={() => navigate(`/owner/payroll?employeeId=${emp.id}&employeeName=${encodeURIComponent(emp.full_name)}`)} className="w-full h-14 rounded-2xl font-black text-[10px] uppercase border-border hover:border-accent">تحويل إلى مسير الرواتب</Button>
                       </div>
                    </Card>
                  ))}
               </div>
            </div>
          )}

          {activeViewMode === "archive" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
               <Card className="p-4 rounded-[2.5rem] border-none shadow-xl bg-white/50 backdrop-blur-sm">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="relative flex-1">
                      <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-muted" size={20} />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="البحث في الأرشيف (اسم الموظف)..."
                        className="h-14 rounded-[2rem] pr-14 bg-white border-none text-base font-black shadow-inner"
                      />
                    </div>
                    <div className="flex gap-4">
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-muted uppercase mr-4">من تاريخ</label>
                          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-14 rounded-[2rem] bg-white border-none font-black text-center shadow-inner" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-muted uppercase mr-4">إلى تاريخ</label>
                          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-14 rounded-[2rem] bg-white border-none font-black text-center shadow-inner" />
                       </div>
                    </div>
                  </div>
               </Card>

               <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                     <table className="w-full text-right">
                        <thead>
                           <tr className="bg-[#17110e] text-[#d3a15c]">
                              <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest">الموظف</th>
                              <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest">نوع العملية</th>
                              <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-center">التاريخ والوقت</th>
                              <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-center">الإجراء</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                           {archiveRecords.slice(0, 100).map(rec => (
                             <tr key={rec.id} className="hover:bg-soft/30 transition-colors group">
                                <td className="px-10 py-6">
                                   <EmployeeAvatar
                                     imageUrl={employees.find(e => String(e.id) === String(rec.employee_id))?.profile_image_url}
                                     name={rec.employee_name}
                                     size="sm"
                                     showInfo={true}
                                   />
                                </td>
                                <td className="px-10 py-6">
                                   <Badge className={cn("px-4 py-1.5 rounded-full font-black text-[9px] uppercase", 
                                     rec.status === "in" ? "bg-emerald-500/10 text-emerald-600" : (rec.status === "out" ? "bg-red-500/10 text-red-600" : "bg-orange-500/10 text-orange-600")
                                   )}>{rec.status === "in" ? "تسجيل حضور" : (rec.status === "out" ? "تسجيل انصراف" : "استراحة")}</Badge>
                                </td>
                                <td className="px-10 py-6 text-center text-sm font-bold text-muted tabular-nums">
                                   {new Date(rec.created_at).toLocaleString("ar-EG")}
                                </td>
                                <td className="px-10 py-6 text-center">
                                   <Button variant="ghost" size="icon" className="text-muted group-hover:text-accent"><MoreVertical size={18} /></Button>
                                </td>
                             </tr>
                           ))}
                           {archiveRecords.length === 0 && (
                             <tr>
                                <td colSpan="4" className="py-20 text-center opacity-20 font-black uppercase">لا توجد سجلات تطابق البحث</td>
                             </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </Card>
            </div>
          )}
        </div>

        {/* 4. Operational Sidebar */}
        <aside className="space-y-10">
          <Card className="rounded-[3rem] border-none shadow-2xl bg-[#17110e] overflow-hidden group">
            <div className="p-10 pb-0 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <Zap className="text-[#d3a15c]" size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">إدارة القيود</h3>
                <p className="text-[10px] font-bold text-[#d3a15c]/60 uppercase tracking-widest">Terminal Access Controls</p>
              </div>
            </div>

            <Tabs defaultValue="register" className="w-full mt-10" dir="rtl">
              <TabsList className="bg-white/5 h-16 w-full p-2 gap-2 rounded-none border-y border-white/5">
                <TabsTrigger value="register" className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-[#d3a15c] data-[state=active]:text-[#17110e] text-white/40 transition-all">يدوي</TabsTrigger>
                <TabsTrigger value="import" className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-[#d3a15c] data-[state=active]:text-[#17110e] text-white/40 transition-all">استيراد</TabsTrigger>
                <TabsTrigger value="penalty" className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-[#d3a15c] data-[state=active]:text-[#17110e] text-white/40 transition-all">جزاءات</TabsTrigger>
              </TabsList>

              <TabsContent value="register" className="p-10 space-y-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mr-2">الموظف المعني</label>
                    <Select value={regEmployeeId} onValueChange={setRegEmployeeId}>
                      <SelectTrigger className="h-14 rounded-2xl bg-white/5 border-white/10 text-white font-black text-sm"><SelectValue placeholder="اختر من القائمة..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-white/10 bg-[#17110e] text-white font-black">
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mr-2">نوع العملية</label>
                    <Select value={regStatus} onValueChange={setRegStatus}>
                      <SelectTrigger className="h-14 rounded-2xl bg-white/5 border-white/10 text-white font-black text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-white/10 bg-[#17110e] text-white font-black">
                        <SelectItem value="in">تسجيل حضور (IN)</SelectItem>
                        <SelectItem value="out">تسجيل انصراف (OUT)</SelectItem>
                        <SelectItem value="break">بدء استراحة (BREAK)</SelectItem>
                        <SelectItem value="break_end">نهاية الاستراحة (RETURN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mr-2">توقيت القيد</label>
                    <Input type="datetime-local" value={regTime} onChange={(e) => setRegTime(e.target.value)} className="h-14 rounded-2xl bg-white/5 border-white/10 text-white font-black" />
                  </div>
                  <Button onClick={handleManualRegister} disabled={isRegistering} loading={isRegistering} className="w-full h-16 rounded-2xl bg-[#d3a15c] text-[#17110e] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-black/40 hover:scale-[1.02] transition-all">
                    <Plus className="ml-2" size={18} /> توثيق القيد
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="import" className="p-12 space-y-6">
                <div className="grid grid-cols-1 gap-5">
                  <input type="file" id="excel-upload-main" className="hidden" onChange={(e) => handleFileUpload(e, "excel")} />
                  <label htmlFor="excel-upload-main" className="flex flex-col items-center justify-center p-14 border-2 border-dashed border-white/10 rounded-[2.5rem] cursor-pointer hover:bg-white/5 transition-all group/up">
                    <FileSpreadsheet className="text-[#d3a15c] mb-4 group-hover/up:scale-110 transition-transform" size={48} />
                    <span className="text-xs font-black text-white uppercase tracking-widest">Excel Smart Import</span>
                  </label>
                  
                  <input type="file" id="biometric-upload-main" className="hidden" onChange={(e) => handleFileUpload(e, "biometric")} />
                  <label htmlFor="biometric-upload-main" className="flex flex-col items-center justify-center p-14 border-2 border-dashed border-white/10 rounded-[2.5rem] cursor-pointer hover:bg-white/5 transition-all group/up">
                    <Cpu className="text-accent mb-4 group-hover/up:scale-110 transition-transform" size={48} />
                    <span className="text-xs font-black text-white uppercase tracking-widest">Biometric API Sync</span>
                  </label>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="rounded-[3rem] p-10 bg-linear-to-br from-[#17110e] to-main border-none shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl -mr-24 -mt-24" />
            <CardTitle className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-5 mb-10">
              <Activity size={28} className="text-[#d3a15c]" /> Pulse Matrix
            </CardTitle>
            <div className="space-y-5">
              {[
                { label: "حضور حي الآن", value: todayRecords.filter(r => r.status === "in").length, color: "text-[#d3a15c]", icon: UserCheck, bg: "bg-white/5" },
                { label: "معدل الانضباط", value: "92%", color: "text-emerald-500", icon: ShieldCheck, bg: "bg-white/5" },
                { label: "إجمالي السجلات", value: records.length, color: "text-white/40", icon: History, bg: "bg-white/5" },
              ].map((stat, i) => (
                <div key={i} className={cn("flex justify-between items-center p-7 rounded-[2rem] border border-white/5 transition-all hover:bg-white/5", stat.bg)}>
                  <div className="flex items-center gap-5">
                    <div className={cn("p-3.5 rounded-2xl bg-white/5 shadow-inner", stat.color)}><stat.icon size={22} strokeWidth={2.5} /></div>
                    <span className="text-xs font-black text-white/50 uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <span className={cn("text-3xl font-black tabular-nums", stat.color)}>{stat.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default AttendanceManagement;
