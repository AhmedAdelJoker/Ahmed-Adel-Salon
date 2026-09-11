import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import payrollService from "@/services/payrollService";
import salaryAdvanceService from "@/services/salaryAdvanceService";
import { adaptList, adaptObject } from "@/services/apiAdapter";
import api from "@/services/api";
import toast from "react-hot-toast";
import exportService from "@/services/exportService";
import {
  AlertCircle,
  Archive,
  Banknote,
  FileSpreadsheet,
  MinusCircle,
  MoreVertical,
  RefreshCw,
  Pencil,
  Trash2,
  Clock,
  ShieldCheck,
  Users,
  Search,
  LayoutGrid,
  List as ListIcon,
  TrendingDown,
  ArrowUpRight,
  Wallet,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { cn } from "@/lib/core/utils";

const MONTHS = [
  { value: 1, label: "يناير" }, { value: 2, label: "فبراير" }, { value: 3, label: "مارس" }, { value: 4, label: "أبريل" },
  { value: 5, label: "مايو" }, { value: 6, label: "يونيو" }, { value: 7, label: "يوليو" }, { value: 8, label: "أغسطس" },
  { value: 9, label: "سبتمبر" }, { value: 10, label: "أكتوبر" }, { value: 11, label: "نوفمبر" }, { value: 12, label: "ديسمبر" },
];
const YEARS = [2024, 2025, 2026, 2027];
const money = (v) => `${Number(v||0).toLocaleString("ar-EG-u-nu-latn")} ج.م`;
const toNumber = (v) => Number(v||0);
const calculateNetSalary = (form: Record<string, unknown>) => toNumber(form.base_salary)+toNumber(form.commission_amount)+toNumber(form.bonus_amount)-toNumber(form.deduction_amount)-toNumber(form.advance_amount);

import type {
  AdvanceData,
  AdvanceRecord,
  EditData,
  PayData,
  PayrollRecord,
  PayrollSummary,
  Period,
} from "@/types/payroll";
import type { EmployeeRecord } from "@/types/employee";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cell, Legend, Pie, PieChart } from "recharts";

const SYSTEM_LINKS = [
  { label: "الموارد البشرية", icon: Users, desc: "بيانات الموظف والراتب الأساسي", color: "bg-primary", href: "/owner/hr" },
  { label: "الحضور", icon: Clock, desc: "الانضباط يحسب الحوافز والخصومات", color: "bg-emerald-500", href: "/attendance" },
  { label: "المصروفات", icon: TrendingDown, desc: "صرف الراتب ينشئ مصروف تلقائي", color: "bg-rose-500", href: "/expenses" },
  { label: "الخزنة", icon: Wallet, desc: "الصرف يخصم من رصيد الخزنة", color: "bg-amber-500", href: "/owner/cashbox" },
];

export default function Payroll() {
  const navigate = useNavigate();
  const { user: _user } = useAuth();
  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get("employeeId");
  const employeeNameFilter = searchParams.get("employeeName") || "";
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isExpectedModalOpen, setIsExpectedModalOpen] = useState(false);
  const [expectedData, setExpectedData] = useState<{
  metrics?: { attendance_percent?: number; missed_days?: number };
  attendance_bonus?: number;
  discipline_bonus?: number;
  auto_deduction?: number;
  net_salary?: number;
} | null>(null);
  const [_isExpectedLoading, setIsExpectedLoading] = useState(false);
  const [isSavingAdvance, setIsSavingAdvance] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [cancelId, setCancelId] = useState<number | string | null>(null);
  const [period, setPeriod] = useState<Period>({ month: new Date().getMonth()+1, year: new Date().getFullYear() });
  const [payData, setPayData] = useState<PayData>({ payment_method: "cash", notes: "" });
  const [advanceData, setAdvanceData] = useState<AdvanceData>({ employee_id: "", amount: "", description: "", advance_date: new Date().toISOString().split("T")[0] });
  const [editData, setEditData] = useState<EditData>({ base_salary: 0, commission_amount: 0, bonus_amount: 0, deduction_amount: 0, advance_amount: 0, payment_method: "cash", notes: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const payrollParams = { ...period, employee_id: employeeIdFilter || undefined };
      const [listRes, summaryRes, advancesRes, employeesRes] = await Promise.all([
        payrollService.list(payrollParams),
        payrollService.summary(payrollParams),
        salaryAdvanceService.list({ isDeducted: false, employee_id: employeeIdFilter || undefined }),
        api.get("/employees"),
      ]);
      setPayrolls(adaptList(listRes));
      setSummary(adaptObject(summaryRes, { total_payroll: 0, total_employees: 0 }));
      setAdvances(adaptList(advancesRes));
      setEmployees(adaptList(employeesRes));
    } catch (_err) {
      toast.error("فشل تحميل بيانات الرواتب");
    } finally { setLoading(false); }
  }, [period, employeeIdFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCalculate = async () => {
    try {
      await toast.promise(payrollService.calculate(period), { loading: "جاري حساب رواتب الشهر...", success: "تم تحديث حسابات الرواتب", error: "فشل حساب الرواتب" });
      fetchData();
    } catch (err) {}
  };
  const handlePay = async () => {
    if (!selectedRecord) return;
    try {
      await toast.promise(payrollService.pay(selectedRecord.id, payData), { loading: "جاري تأكيد الصرف...", success: "تم صرف الراتب وتسجيل المصروف", error: "فشل الصرف" });
      setIsPayModalOpen(false); setSelectedRecord(null); fetchData();
    } catch (err) {}
  };
  const handleCancel = async () => {
    if (!cancelId) return;
    try { await payrollService.cancel(cancelId); toast.success("تم الإلغاء"); setCancelId(null); fetchData(); } catch (err) { toast.error("فشل الإلغاء"); }
  };
  const handleCreateAdvance = async () => {
    if (!advanceData.employee_id || !advanceData.amount) return toast.error("أكمل بيانات السلفة");
    try {
      setIsSavingAdvance(true);
      await toast.promise(salaryAdvanceService.create(advanceData), { loading: "جاري تسجيل السلفة...", success: "تم تسجيل السلفة", error: "فشل التسجيل" });
      setIsAdvanceModalOpen(false); setAdvanceData({ employee_id: "", amount: "", description: "", advance_date: new Date().toISOString().split("T")[0] }); fetchData();
    } finally { setIsSavingAdvance(false); }
  };
  const handleDeleteAdvance = async (id) => { try { await salaryAdvanceService.remove(id); toast.success("تم الحذف"); fetchData(); } catch (err) { toast.error("فشل الحذف"); } };
  const fetchExpectedNet = async (empId) => {
    try { setIsExpectedLoading(true); const res = await payrollService.expectedNet({ employee_id: empId, ...period }); setExpectedData(res); setIsExpectedModalOpen(true); } catch (err) { toast.error("فشل تحميل التقرير"); } finally { setIsExpectedLoading(false); }
  };
  const openEditModal = (row) => {
    setEditingRecord(row);
    setEditData({ base_salary: row.base_salary ?? 0, commission_amount: row.commission_amount ?? 0, bonus_amount: row.bonus_amount ?? 0, deduction_amount: row.deduction_amount ?? 0, advance_amount: row.advance_amount ?? 0, payment_method: row.payment_method || "cash", notes: row.notes || "" });
    setIsEditModalOpen(true);
  };
  const closeEditModal = () => { setIsEditModalOpen(false); setEditingRecord(null); };
  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    try {
      setIsSavingEdit(true);
      await toast.promise(payrollService.update(editingRecord.id, { base_salary: toNumber(editData.base_salary), commission_amount: toNumber(editData.commission_amount), bonus_amount: toNumber(editData.bonus_amount), deduction_amount: toNumber(editData.deduction_amount), advance_amount: toNumber(editData.advance_amount), payment_method: editData.payment_method || null, notes: editData.notes?.trim() || null, net_salary: calculateNetSalary(editData as unknown as Record<string, unknown>) }), { loading: "جاري الحفظ...", success: "تم حفظ التعديلات", error: "فشل الحفظ" });
      closeEditModal(); fetchData();
    } finally { setIsSavingEdit(false); }
  };

  const payrollRows = Array.isArray(payrolls) ? payrolls : [];
  const filteredRows = payrollRows.filter(r => {
    if (employeeIdFilter && String(r.employee_id || r.employeeId) !== String(employeeIdFilter)) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (r.employee_name_snapshot||"").toLowerCase().includes(q) || String(r.net_salary||"").includes(q);
  });
  const editedNetSalary = calculateNetSalary(editData as unknown as Record<string, unknown>);

  if (loading && payrollRows.length === 0) {
    return (<div className="flex min-h-[60vh] items-center justify-center" dir="rtl"><div className="flex flex-col items-center gap-3 text-accent"><RefreshCw className="h-10 w-10 animate-spin" /><p className="text-xs font-black text-muted">جاري تدقيق الرواتب...</p></div></div>);
  }

  return (
    <div className="erp-page space-y-6 pb-10" dir="rtl">
      <ConfirmDialog open={!!cancelId} onOpenChange={(o)=>!o&&setCancelId(null)} title="إلغاء السجل؟" description="سيتم إلغاء هذا القيد من كشف الرواتب." onConfirm={handleCancel} />

      <PageHeader
        title="مسيرات الرواتب"
        subtitle="إدارة التعويضات والعمولات والكشوف الشهرية — احترافية عالمية"
        badge="الموارد المالية"
        icon={Banknote}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={()=>exportService.downloadExcel("/exports/payroll/excel","payroll_report",period as unknown as Record<string, unknown>)} className="h-11 rounded-xl px-4 text-xs font-black"><FileSpreadsheet size={16} className="ml-1.5 text-success" /><span className="hidden sm:inline">Excel</span></Button>
            <Button variant="outline" onClick={()=>setIsAdvanceModalOpen(true)} className="h-11 rounded-xl px-4 text-xs font-black text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-600 hover:text-white"><MinusCircle size={16} className="ml-1.5" /> سلفة</Button>
            <Button variant="outline" onClick={()=>navigate("/owner/payroll/archive")} className="h-11 rounded-xl px-4 text-xs font-black"><Archive size={16} className="ml-1.5" /> الأرشيف</Button>
            <Button onClick={handleCalculate} disabled={loading} className="h-11 rounded-xl px-6 bg-primary hover:bg-primary-strong text-white font-black shadow-lg"><RefreshCw size={16} className="ml-1.5" /> تحديث الحسابات</Button>
          </div>
        }
      />

      {/* System Relations */}
      <PremiumCard noPadding className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/20">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center"><Building2 size={16} /></div>
            <div><h3 className="text-sm font-black text-main">ترابط الرواتب بالنظام</h3><p className="text-[11px] font-bold text-muted">كل راتب هو حلقة وصل بين الحضور والعمولات والخزنة</p></div>
            <Badge className="mr-auto hidden rounded-full border-primary/20 bg-primary-soft text-primary text-[10px] font-black sm:flex">تكامل تلقائي</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {SYSTEM_LINKS.map(l=>(
              <button key={l.label} onClick={()=>navigate(l.href)} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right hover:border-primary hover:shadow-md transition-all">
                <div className={cn("h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0", l.color)}><l.icon size={18} /></div>
                <div className="min-w-0 flex-1"><div className="text-xs font-black text-main flex items-center gap-1">{l.label} <ArrowUpRight size={12} className="text-muted group-hover:text-primary" /></div><div className="text-[10px] font-bold text-muted leading-tight mt-0.5 line-clamp-2">{l.desc}</div></div>
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      {/* Staff Snapshot - Responsive */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary"><Users size={14} /></span> الكادر الحالي</h2>
          <span className="text-[11px] font-bold text-muted">{employees.length} موظف • اضغط للفلترة</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar xl:grid xl:grid-cols-5 xl:overflow-visible">
          {employees.slice(0,10).map(emp=>{
            const row = payrollRows.find(r=> (r.employee_id||r.employeeId)===emp.id);
            return (
              <Card key={emp.id} onClick={()=>navigate(`/owner/payroll?employeeId=${emp.id}&employeeName=${encodeURIComponent(emp.full_name||emp.fullName||"")}`)} className={cn("min-w-[200px] shrink-0 cursor-pointer rounded-2xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md lg:min-w-0", String(employeeIdFilter)===String(emp.id) && "border-primary/40 bg-primary-soft/40 ring-2 ring-primary/40")}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="relative">
                    <img src={emp.profile_image_url ? (typeof emp.profile_image_url === "string" && emp.profile_image_url.startsWith("http")? emp.profile_image_url : `${api.defaults.baseURL?.replace("/api/v1","")}${emp.profile_image_url}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(String(emp.full_name||"M"))}&background=random`} alt={String(emp.full_name||"")} className="h-14 w-14 rounded-2xl object-cover border-2 border-white shadow" />
                    <span className={cn("absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white", emp.status==="active"?"bg-success":"bg-muted")} />
                  </div>
                  <div className="space-y-0.5 w-full">
                    <div className="text-xs font-black text-main truncate">{emp.full_name || emp.fullName}</div>
                    <div className="truncate text-[10px] font-bold uppercase text-muted">{String(emp.job_title || emp.jobTitle || "موظف")}</div>
                  </div>
                  <div className="w-full pt-2 border-t border-border/40 flex justify-between text-[11px]">
                    <span className="text-muted font-bold">الأساسي</span><span className="font-black text-main">{money(emp.base_salary)}</span>
                  </div>
                  <div className="w-full flex justify-between text-[11px]">
                    <span className="text-muted font-bold">الصافي</span>                    <span className="font-black text-primary">{money(row?.net_salary || 0)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Period + Chart + Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
        <PremiumCard className="xl:col-span-3 p-5 flex flex-col min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-3">الفترة المالية</div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={String(period.month)} onValueChange={v=>setPeriod({...period, month:Number(v)})}>
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map(m=><SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(period.year)} onValueChange={v=>setPeriod({...period, year:Number(v)})}>
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="mt-4 p-4 rounded-2xl bg-primary text-white">
            <div className="text-[10px] font-black text-white/60 uppercase">إجمالي كتلة الرواتب</div>
            <div className="text-2xl font-black tabular-nums mt-1">{money(summary?.total_net_salary)}</div>
            <div className="flex gap-2 mt-2 text-[10px] font-bold">
              <span className="px-2 py-1 rounded-full bg-white/10">صرف {money(summary?.paid_total)}</span>
              <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300">متبقي {money(summary?.unpaid_total)}</span>
            </div>
          </div>
        </PremiumCard>
        <PremiumCard className="xl:col-span-5 p-5 min-w-0">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted mb-4">تحليل التكاليف</h3>
          <div className="h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{name:"الأساسي", value:toNumber(summary?.total_base_salary)}, {name:"العمولات", value:toNumber(summary?.total_commissions)}, {name:"المكافآت", value:toNumber(summary?.total_bonuses)}]} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                  <Cell fill="var(--primary)" /><Cell fill="var(--info)" /><Cell fill="var(--success)" />
                </Pie>
                <RechartsTooltip formatter={v=>money(v)} contentStyle={{borderRadius:12, border:"1px solid var(--border)", fontWeight:800}} />
                <Legend iconType="circle" wrapperStyle={{fontSize:11, fontWeight:800}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>
        <div className="xl:col-span-4 grid grid-cols-2 gap-3 min-w-0">
          <PremiumCard className="p-4 border-l-4 border-primary">
            <div className="text-[10px] font-black text-muted uppercase">الأساسي</div>
            <div className="text-lg font-black tabular-nums">{money(summary?.total_base_salary)}</div>
            <div className="text-[10px] font-bold text-muted">{summary?.employees_count || 0} موظف</div>
          </PremiumCard>
          <PremiumCard className="p-4 border-l-4 border-sky-500">
            <div className="text-[10px] font-black text-muted uppercase">العمولات</div>
            <div className="text-lg font-black tabular-nums text-sky-600">{money(summary?.total_commissions)}</div>
          </PremiumCard>
          <PremiumCard className="p-4 border-l-4 border-emerald-500">
            <div className="text-[10px] font-black text-muted uppercase">المكافآت</div>
            <div className="text-lg font-black text-emerald-600">{money(summary?.total_bonuses)}</div>
          </PremiumCard>
          <PremiumCard className="p-4 border-l-4 border-rose-500">
            <div className="text-[10px] font-black text-muted uppercase">استقطاعات</div>
            <div className="text-lg font-black text-rose-600">{money(toNumber(summary?.total_deductions)+toNumber(summary?.total_advances))}</div>
          </PremiumCard>
        </div>
      </div>

      {employeeIdFilter && (
        <PremiumCard className="flex flex-col gap-3 border-primary/20 bg-primary-soft/40 p-4 sm:flex-row sm:items-center justify-between">
          <div><div className="text-[10px] font-black uppercase text-primary">فلترة موظف</div><div className="font-black text-main">{employeeNameFilter || `موظف #${employeeIdFilter}`}</div></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={()=>navigate(`/owner/hr?employeeId=${employeeIdFilter}`)} className="rounded-xl font-black">ملف الموظف</Button>
            <Button variant="outline" size="sm" onClick={()=>navigate("/owner/payroll")} className="rounded-xl font-black">إلغاء الفلترة</Button>
          </div>
        </PremiumCard>
      )}

      {/* Payroll Table Header */}
      <PremiumCard noPadding className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border bg-soft/30 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-black">كشف الاستحقاقات</h2>
            <p className="text-xs font-bold text-muted">مراجعة دقيقة لمكونات الراتب • {filteredRows.length} سجل</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="بحث بالاسم..." className="h-10 pr-9 rounded-xl bg-card border-border font-bold text-sm" />
            </div>
            <div className="flex bg-soft border border-border p-1 rounded-xl">
              <button onClick={()=>setViewMode("table")} className={cn("h-8 w-8 rounded-lg flex items-center justify-center", viewMode==="table"?"bg-card shadow border border-border text-slate-900":"text-muted")}><ListIcon size={14} /></button>
              <button onClick={()=>setViewMode("grid")} className={cn("h-8 w-8 rounded-lg flex items-center justify-center", viewMode==="grid"?"bg-card shadow border border-border text-slate-900":"text-muted")}><LayoutGrid size={14} /></button>
            </div>
          </div>
        </div>

        {viewMode === "table" ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-soft/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">الموظف</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-muted">الأساسي</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-muted">العمولة</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center">إضافات</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center">خصومات</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center">الصافي</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center">الحالة</th>
                  <th className="px-4 py-4 text-center text-[10px] font-black uppercase text-muted">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredRows.map(row=>(
                  <tr key={row.id} className="hover:bg-soft/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-soft border border-border flex items-center justify-center font-black text-accent text-xs">{(row.employee_name_snapshot||"U")[0]}</div>
                        <div><div className="text-sm font-black text-main">{row.employee_name_snapshot}</div><div className="text-[10px] font-bold text-muted uppercase">{row.role_snapshot}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold tabular-nums">{money(row.base_salary)}</td>
                    <td className="px-4 py-4 text-sm font-black text-sky-600 tabular-nums">{money(row.commission_amount)}</td>
                    <td className="px-4 py-4 text-center text-sm font-black text-emerald-600 tabular-nums">+{money(row.bonus_amount)}</td>
                    <td className="px-4 py-4 text-center text-sm font-black text-rose-600 tabular-nums">-{money(toNumber(row.deduction_amount)+toNumber(row.advance_amount))}</td>
                    <td className="px-4 py-4 text-center"><span className="text-base font-black tabular-nums bg-primary text-white px-3 py-1 rounded-full">{money(row.net_salary)}</span></td>
                    <td className="px-4 py-4 text-center"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {row.status!=="paid" && row.status!=="cancelled" && <Button size="sm" onClick={()=>{setSelectedRecord(row); setIsPayModalOpen(true);}} className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-3">صرف</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 rounded-xl"><MoreVertical size={14} /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                            <DropdownMenuItem onClick={()=>exportService.downloadPdf(`/exports/payroll/${row.id}/pdf`, `payslip_${row.employee_name_snapshot}`)} className="font-bold text-xs"><FileSpreadsheet size={12} className="ml-2" /> PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>fetchExpectedNet(row.employee_id||row.employeeId)} className="font-bold text-xs"><ShieldCheck size={12} className="ml-2" /> تقرير الانضباط</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>openEditModal(row)} className="font-bold text-xs"><Pencil size={12} className="ml-2" /> تعديل يدوي</DropdownMenuItem>
                            {row.status!=="cancelled" && <DropdownMenuItem onClick={()=>setCancelId(row.id as number | string)} className="font-bold text-xs text-rose-600"><Trash2 size={12} className="ml-2" /> إلغاء</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length===0 && <tr><td colSpan={8} className="py-16 text-center"><div className="flex flex-col items-center gap-2 text-muted"><AlertCircle size={32} /><p className="font-black">لا توجد سجلات</p><p className="text-xs">اضغط تحديث الحسابات</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRows.map(row=>(
              <PremiumCard key={row.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-soft border flex items-center justify-center font-black text-accent">{(row.employee_name_snapshot||"U")[0]}</div><div><div className="text-sm font-black">{row.employee_name_snapshot}</div><div className="text-[10px] font-bold text-muted">{row.role_snapshot}</div></div></div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-soft p-2"><div className="text-[9px] font-black text-muted uppercase">الأساسي</div><div className="font-black">{money(row.base_salary)}</div></div>
                  <div className="rounded-xl bg-sky-50 p-2"><div className="text-[9px] font-black text-muted uppercase">العمولة</div><div className="font-black text-sky-600">{money(row.commission_amount)}</div></div>
                  <div className="rounded-xl bg-emerald-50 p-2"><div className="text-[9px] font-black text-muted uppercase">إضافات</div><div className="font-black text-emerald-600">+{money(row.bonus_amount)}</div></div>
                  <div className="rounded-xl bg-rose-50 p-2"><div className="text-[9px] font-black text-muted uppercase">خصومات</div><div className="font-black text-rose-600">-{money(toNumber(row.deduction_amount)+toNumber(row.advance_amount))}</div></div>
                </div>
                <div className="flex items-center justify-between bg-primary text-white rounded-xl p-3">
                  <span className="text-[10px] font-black text-white/60 uppercase">الصافي</span><span className="font-black">{money(row.net_salary)}</span>
                </div>
                <div className="flex gap-2">
                  {row.status!=="paid"&&row.status!=="cancelled"&&<Button onClick={()=>{setSelectedRecord(row); setIsPayModalOpen(true);}} className="flex-1 h-9 rounded-xl bg-emerald-600 text-white font-black text-xs">صرف</Button>}
                  <Button variant="outline" onClick={()=>openEditModal(row)} className="flex-1 h-9 rounded-xl font-black text-xs">تعديل</Button>
                </div>
              </PremiumCard>
            ))}
          </div>
        )}
      </PremiumCard>

      {/* Advances */}
      <PremiumCard noPadding className="overflow-hidden">
        <div className="p-5 border-b border-border bg-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h3 className="font-black flex items-center gap-2"><Banknote size={16} className="text-rose-600" /> السلف المعلقة</h3><p className="text-xs font-bold text-muted">لم تخصم بعد من الرواتب</p></div>
          <Badge className="bg-rose-500 text-white rounded-full w-fit">{advances.length} سلفة</Badge>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right min-w-[600px]">
            <thead><tr className="bg-soft/50 border-b border-border"><th className="px-6 py-3 text-[10px] font-black uppercase text-muted">الموظف</th><th className="px-6 py-3 text-[10px] font-black uppercase text-muted">المبلغ</th><th className="px-6 py-3 text-[10px] font-black uppercase text-muted">التاريخ</th><th className="px-6 py-3 text-[10px] font-black uppercase text-muted">البيان</th><th className="px-6 py-3 text-center text-[10px] font-black uppercase text-muted">حذف</th></tr></thead>
            <tbody className="divide-y divide-border/30">
              {advances.length===0 ? <tr><td colSpan={5} className="py-10 text-center font-bold text-muted">لا توجد سلف معلقة</td></tr> : advances.map(adv=>(
                <tr key={adv.id} className="hover:bg-soft/20">
                  <td className="px-6 py-4 font-black text-sm">{String(adv.employee_name || `موظف #${adv.employee_id}`)}</td>
                  <td className="px-6 py-4 font-black text-rose-600">{money(adv.amount)}</td>
                  <td className="px-6 py-4 text-xs font-bold text-muted">{adv.advance_date ? new Date(adv.advance_date).toLocaleDateString("ar-EG") : "---"}</td>
                  <td className="px-6 py-4 text-xs font-bold text-muted truncate max-w-[200px]">{String(adv.description||"---")}</td>
                  <td className="px-6 py-4 text-center"><Button variant="ghost" size="icon" onClick={()=>handleDeleteAdvance(adv.id)} className="h-8 w-8 text-rose-400 hover:text-rose-600"><Trash2 size={14} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      {/* Modals - keep existing but styled */}
      <Dialog open={isEditModalOpen} onOpenChange={(o)=>!o&&closeEditModal()}>
        <DialogContent className="max-w-3xl rounded-[1.5rem] p-0 overflow-hidden max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-3"><span className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center"><Pencil size={16} /></span> تعديل بنود الراتب</DialogTitle>
            <DialogDescription className="text-white/60 text-xs font-bold">مراجعة يدوية للفترة {editingRecord?.period_month}/{editingRecord?.period_year}</DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<Field label="الأساسي"><Input type="number" value={editData.base_salary} onChange={e=>setEditData({...editData, base_salary:Number(e.target.value)})} className="h-11 rounded-xl bg-soft font-black" /></Field>
<Field label="العمولة"><Input type="number" value={editData.commission_amount} onChange={e=>setEditData({...editData, commission_amount:Number(e.target.value)})} className="h-11 rounded-xl bg-soft font-black text-sky-600" /></Field>
<Field label="المكافآت"><Input type="number" value={editData.bonus_amount} onChange={e=>setEditData({...editData, bonus_amount:Number(e.target.value)})} className="h-11 rounded-xl bg-soft font-black text-emerald-600" /></Field>
<Field label="الخصومات"><Input type="number" value={editData.deduction_amount} onChange={e=>setEditData({...editData, deduction_amount:Number(e.target.value)})} className="h-11 rounded-xl bg-soft font-black text-rose-600" /></Field>
<Field label="السلف"><Input type="number" value={editData.advance_amount} onChange={e=>setEditData({...editData, advance_amount:Number(e.target.value)})} className="h-11 rounded-xl bg-soft font-black text-rose-600" /></Field>
                <Field label="طريقة الدفع">
                  <Select value={editData.payment_method} onValueChange={v=>setEditData({...editData, payment_method:v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-soft font-black"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">نقدي</SelectItem><SelectItem value="card">بطاقة</SelectItem><SelectItem value="bank_transfer">تحويل بنكي</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="ملاحظات"><textarea rows={2} value={editData.notes} onChange={e=>setEditData({...editData, notes:e.target.value})} className="w-full rounded-xl border border-border bg-soft p-3 text-sm font-bold outline-none resize-none focus:border-primary" placeholder="سبب التعديل..." /></Field>
              <div className="rounded-2xl bg-primary text-white p-4 flex items-center justify-between">
                <span className="text-[10px] font-black text-white/60 uppercase">الصافي الجديد</span><span className="text-xl font-black">{money(editedNetSalary)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="p-4 border-t border-border bg-soft/20 gap-2 shrink-0">
            <Button variant="outline" onClick={closeEditModal} className="flex-1 h-11 rounded-xl font-black">إلغاء</Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 h-11 rounded-xl bg-primary text-white font-black">{isSavingEdit?"جاري الحفظ...":"اعتماد"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="max-w-md rounded-[1.5rem] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-6 bg-emerald-600 text-white">
            <DialogTitle className="text-lg font-black flex items-center gap-2"><Banknote size={18} /> صرف المستحقات</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {selectedRecord && <div className="rounded-2xl border bg-soft p-4 space-y-2"><div className="flex justify-between text-sm"><span className="font-bold text-muted">الموظف</span><span className="font-black">{selectedRecord.employee_name_snapshot}</span></div><div className="flex justify-between"><span className="text-xs font-bold text-muted">الصافي</span><span className="text-lg font-black text-emerald-600">{money(selectedRecord.net_salary)}</span></div></div>}
            <div className="space-y-1.5"><label className="text-[10px] font-black text-muted uppercase">طريقة الصرف</label>
              <Select value={payData.payment_method} onValueChange={v=>setPayData({...payData, payment_method:v})}><SelectTrigger className="h-11 rounded-xl bg-soft font-black"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">نقدي</SelectItem><SelectItem value="card">بطاقة</SelectItem><SelectItem value="bank_transfer">تحويل بنكي</SelectItem></SelectContent></Select>
            </div>
          </div>
          <DialogFooter className="p-4 border-t flex gap-2">
            <Button variant="outline" onClick={()=>setIsPayModalOpen(false)} className="flex-1 h-11 rounded-xl">إغلاق</Button>
            <Button onClick={handlePay} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-black">تأكيد الصرف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdvanceModalOpen} onOpenChange={setIsAdvanceModalOpen}>
        <DialogContent className="max-w-lg rounded-[1.5rem] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-6 bg-rose-600 text-white">
            <DialogTitle className="text-lg font-black flex items-center gap-2"><MinusCircle size={18} /> تسجيل سلفة</DialogTitle>
            <DialogDescription className="text-white/70 text-xs font-bold">ستنشئ مصروف تلقائي وتخصم من الراتب القادم</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <Field label="الموظف">
              <Select value={String(advanceData.employee_id)} onValueChange={v=>setAdvanceData({...advanceData, employee_id:v})}>
                <SelectTrigger className="h-11 rounded-xl bg-soft font-black"><SelectValue placeholder="اختر موظف..." /></SelectTrigger>
                <SelectContent>{employees.map(emp=><SelectItem key={emp.id} value={String(emp.id)}>{String(emp.full_name)} ({String(emp.job_title || emp.jobTitle || "")})</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="المبلغ"><Input type="number" value={advanceData.amount} onChange={e=>setAdvanceData({...advanceData, amount:e.target.value})} className="h-11 rounded-xl bg-soft font-black text-lg" placeholder="0.00" /></Field>
            <Field label="البيان"><textarea rows={2} value={advanceData.description} onChange={e=>setAdvanceData({...advanceData, description:e.target.value})} className="w-full rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none" placeholder="سبب السلفة..." /></Field>
          </div>
          <DialogFooter className="p-4 border-t">
            <Button onClick={handleCreateAdvance} disabled={isSavingAdvance} className="w-full h-11 rounded-xl bg-rose-600 text-white font-black">{isSavingAdvance?"جاري الحفظ...":"اعتماد السلفة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExpectedModalOpen} onOpenChange={setIsExpectedModalOpen}>
        <DialogContent className="max-w-lg rounded-[1.5rem] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="bg-info p-6 text-white">
            <DialogTitle className="text-lg font-black">تحليل الانضباط</DialogTitle>
            <DialogDescription className="text-white/60 text-xs">تأثير الحضور على الحوافز</DialogDescription>
          </DialogHeader>
          {expectedData && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft p-4 border"><div className="text-[10px] font-black text-muted uppercase">نسبة الحضور</div><div className="text-2xl font-black">{expectedData.metrics?.attendance_percent ?? 0}%</div></div>
                <div className="rounded-2xl bg-soft p-4 border"><div className="text-[10px] font-black text-muted uppercase">الغياب</div><div className="text-2xl font-black text-rose-600">{expectedData.metrics?.missed_days ?? 0} يوم</div></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100"><span className="text-sm font-bold text-emerald-800">مكافأة حضور</span><span className="font-black text-emerald-600">+{money(expectedData.attendance_bonus ?? 0)}</span></div>
                <div className="flex justify-between p-3 rounded-xl bg-sky-50 border border-sky-100"><span className="text-sm font-bold text-sky-800">حافز انضباط</span><span className="font-black text-sky-600">+{money(expectedData.discipline_bonus ?? 0)}</span></div>
                <div className="flex justify-between p-3 rounded-xl bg-rose-50 border border-rose-100"><span className="text-sm font-bold text-rose-800">خصم غياب</span><span className="font-black text-rose-600">-{money(expectedData.auto_deduction ?? 0)}</span></div>
              </div>
              <div className="rounded-2xl bg-primary text-white p-4 flex justify-between items-center"><span className="text-xs font-bold text-white/60">الصافي المتوقع</span><span className="text-xl font-black">{money(expectedData.net_salary ?? 0)}</span></div>
            </div>
          )}
          <DialogFooter className="p-4"><Button variant="outline" onClick={()=>setIsExpectedModalOpen(false)} className="h-11 w-full rounded-xl font-black">إغلاق</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = { paid: { label: "تم الصرف", variant: "success" }, cancelled: { label: "ملغي", variant: "danger" }, audited: { label: "مدقق", variant: "info" }, calculated: { label: "محسوب", variant: "outline" } };
  const cur = cfg[status] || { label: status || "غير معروف", variant: "secondary" };
  return <Badge variant={cur.variant} className="h-6 px-3 rounded-full font-black text-[10px]">{cur.label}</Badge>;
}
function Field({ label, children }) { return <label className="block space-y-1.5"><span className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</span>{children}</label>; }
