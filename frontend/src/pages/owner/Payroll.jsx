import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useState } from "react";



import { useNavigate, useSearchParams } from "react-router-dom";
import payrollService from "../../services/payrollService";
import salaryAdvanceService from "../../services/salaryAdvanceService";
import { adaptList, adaptObject } from "../../services/apiAdapter";
import toast from "react-hot-toast";
import exportService from "../../services/exportService";
import {
  AlertCircle,
  Archive,
  Banknote,
  ChevronDown,
  CreditCard,
  FileDown,
  FileSpreadsheet,
  MinusCircle,
  MoreVertical,
  Percent,
  PlusCircle,
  RefreshCw,
  Eye,
  Save,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { motion, AnimatePresence } from "framer-motion";

const MONTHS = [
  { value: 1, label: "يناير" },
  { value: 2, label: "فبراير" },
  { value: 3, label: "مارس" },
  { value: 4, label: "أبريل" },
  { value: 5, label: "مايو" },
  { value: 6, label: "يونيو" },
  { value: 7, label: "يوليو" },
  { value: 8, label: "أغسطس" },
  { value: 9, label: "سبتمبر" },
  { value: 10, label: "أكتوبر" },
  { value: 11, label: "نوفمبر" },
  { value: 12, label: "ديسمبر" },
];

const YEARS = [2024, 2025, 2026, 2027];

const money = (value) => `${Number(value || 0).toLocaleString("ar-EG")} ج.م`;
const toNumber = (value) => Number(value || 0);
const calculateNetSalary = (form) =>
  toNumber(form.base_salary) +
  toNumber(form.commission_amount) +
  toNumber(form.bonus_amount) -
  toNumber(form.deduction_amount) -
  toNumber(form.advance_amount);

const Payroll = () => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get("employeeId");
  const employeeNameFilter = searchParams.get("employeeName") || "";

  const [payrolls, setPayrolls] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [period, setPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [payData, setPayData] = useState({
    payment_method: "cash",
    notes: "",
  });
  const [editData, setEditData] = useState({
    base_salary: 0,
    commission_amount: 0,
    bonus_amount: 0,
    deduction_amount: 0,
    advance_amount: 0,
    payment_method: "cash",
    notes: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const payrollParams = {
        ...period,
        employee_id: employeeIdFilter || undefined,
        employeeId: employeeIdFilter || undefined,
      };

      const [listRes, summaryRes, advancesRes] = await Promise.all([
        payrollService.list(payrollParams),
        payrollService.summary(payrollParams),
        salaryAdvanceService.list({
          isDeducted: false,
          employee_id: employeeIdFilter || undefined,
          employeeId: employeeIdFilter || undefined,
        }),
      ]);
      setPayrolls(adaptList(listRes));
      setSummary(adaptObject(summaryRes, {}));
      setAdvances(adaptList(advancesRes));
    } catch (err) {
      console.error("Payroll load error:", err);
      toast.error("فشل تحميل بيانات الرواتب");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdvance = async (id) => {
    try {
      await salaryAdvanceService.remove(id);
      toast.success("تم حذف السلفة بنجاح");
      fetchData();
    } catch (err) {
      toast.error("فشل حذف السلفة");
    }
  };

  useEffect(() => {

    fetchData();
  }, [period.month, period.year, employeeIdFilter]);

  const handleCalculate = async () => {
    try {
      await toast.promise(payrollService.calculate(period), {
        loading: "جاري حساب رواتب الشهر...",
        success: "تم تحديث حسابات الرواتب بنجاح",
        error: "فشل حساب الرواتب",
      });
      fetchData();
    } catch (err) {
      console.error("Payroll calculate error:", err);
    }
  };

  const handlePay = async () => {
    if (!selectedRecord) return;
    try {
      await toast.promise(payrollService.pay(selectedRecord.id, payData), {
        loading: "جاري تأكيد عملية الصرف...",
        success: "تم صرف الراتب وتسجيل المصروف بنجاح",
        error: "فشل تأكيد الصرف",
      });
      setIsPayModalOpen(false);
      setSelectedRecord(null);
      fetchData();
    } catch (err) {
      console.error("Payroll pay error:", err);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await payrollService.cancel(cancelId);
      toast.success("تم الإلغاء");
      setCancelId(null);
      fetchData();
    } catch (err) {
      console.error("Payroll cancel error:", err);
      toast.error("فشل الإلغاء");
    }
  };

  const payrollRows = Array.isArray(payrolls) ? payrolls : [];
  const visiblePayrollRows = employeeIdFilter
    ? payrollRows.filter(
        (row) =>
          String(
            row.employee_id || row.employeeId || row.employee?.id || "",
          ) === String(employeeIdFilter),
      )
    : payrollRows;

  const selectedEmployeeLabel =
    employeeNameFilter ||
    visiblePayrollRows[0]?.employee_name_snapshot ||
    "موظف محدد";

  const editedNetSalary = calculateNetSalary(editData);

  const openEditModal = (row) => {
    setEditingRecord(row);
    setEditData({
      base_salary: row.base_salary ?? 0,
      commission_amount: row.commission_amount ?? 0,
      bonus_amount: row.bonus_amount ?? 0,
      deduction_amount: row.deduction_amount ?? 0,
      advance_amount: row.advance_amount ?? 0,
      payment_method: row.payment_method || "cash",
      notes: row.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingRecord(null);
  };

  const handleEditChange = (field, value) => {
    setEditData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    try {
      setIsSavingEdit(true);
      await toast.promise(
        payrollService.update(editingRecord.id, {
          base_salary: toNumber(editData.base_salary),
          commission_amount: toNumber(editData.commission_amount),
          bonus_amount: toNumber(editData.bonus_amount),
          deduction_amount: toNumber(editData.deduction_amount),
          advance_amount: toNumber(editData.advance_amount),
          payment_method: editData.payment_method || null,
          notes: editData.notes?.trim() || null,
          net_salary: editedNetSalary,
        }),
        {
          loading: "جاري تحديث بيانات الراتب...",
          success: "تم حفظ التعديلات بنجاح",
          error: "فشل حفظ التعديلات",
        },
      );
      closeEditModal();
      fetchData();
    } catch (err) {
      console.error("Payroll update error:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (loading && payrollRows.length === 0) {
    return (
      <div className="flex min-h-125 items-center justify-center erp-page-container">
        <div className="flex flex-col items-center gap-4 text-accent">
          <RefreshCw className="h-12 w-12 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
            جاري تدقيق حسابات الرواتب...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 erp-page-container" dir="rtl">
      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="إبطال سجل المستحقات؟"
        description="سيتم إلغاء هذا القيد المالي من كشوف الرواتب الحالية. هل تود المتابعة؟"
        onConfirm={handleCancel}
      />

      <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div className="flex items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/20">
            <Banknote className="h-8 w-8" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black uppercase tracking-tight text-main leading-none">
              مسيرات الرواتب
            </h1>
            <p className="text-base font-medium text-muted">
              إدارة التعويضات، العمولات، وكشوف الاستحقاق الشهرية
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <Button
            type="button"
            variant="outline"
            title="تصدير كشف الرواتب إلى Excel"
            onClick={() =>
              exportService.downloadExcel(
                "/exports/payroll/excel",
                "payroll_report",
                period,
              )
            }
            className="h-12 rounded-xl border-border px-6 text-xs font-black uppercase tracking-widest"
          >
            Excel <FileSpreadsheet className="mr-2 text-success" size={16} />
          </Button>
          <Button
            type="button"
            variant="outline"
            title="تصدير كشف الرواتب إلى CSV"
            onClick={() =>
              exportService.downloadCsv(
                "/exports/payroll/csv",
                "payroll_report",
                period,
              )
            }
            className="h-12 rounded-xl border-border px-6 text-xs font-black uppercase tracking-widest"
          >
            CSV <FileDown className="mr-2 text-info" size={16} />
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => navigate("/owner/payroll/archive")}
            variant="outline"
            title="الانتقال إلى أرشيف الرواتب المعتمدة"
            className="h-12 rounded-xl border-border bg-card px-8 text-xs font-black uppercase tracking-widest"
          >
            الأرشيف <Archive className="mr-2" size={18} />
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={handleCalculate}
            title="إعادة احتساب مستحقات الموظفين للفترة المختارة"
            className="h-12 flex-1 rounded-xl px-10 md:flex-none shadow-lg shadow-accent/20 font-black text-lg"
          >
            تحديث الحسابات{" "}
            <RefreshCw className="mr-2" size={20} strokeWidth={2.5} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 pt-2">
        <Card className="flex flex-col justify-between rounded-premium border border-border/60 bg-card p-8 shadow-soft transition-all hover:border-accent/20 group">
          <div className="space-y-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-accent transition-colors">
              الفترة المالية المستهدفة
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                value={String(period.month) || ""}
                onValueChange={(val) =>
                  setPeriod({ ...period, month: Number(val) })
                }
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-soft font-black text-xs uppercase transition-all focus:bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card shadow-premium">
                  {MONTHS.map((month) => (
                    <SelectItem
                      key={month.value}
                      value={String(month.value) || ""}
                      className="font-bold"
                    >
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(period.year) || ""}
                onValueChange={(val) =>
                  setPeriod({ ...period, year: Number(val) })
                }
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-soft font-black text-xs uppercase transition-all focus:bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card shadow-premium">
                  {YEARS.map((year) => (
                    <SelectItem
                      key={year}
                      value={String(year) || ""}
                      className="font-bold"
                    >
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-10 border-t border-border/40 pt-8">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted">
              إجمالي كتلة الرواتب
            </div>
            <div className="text-4xl font-black tracking-tighter text-accent leading-none tabular-nums">
              {money(summary?.total_net_salary)}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
          <SummaryCard
            icon={Banknote}
            title="الرواتب الأساسية"
            value={summary?.total_base_salary || ""}
          />
          <SummaryCard
            icon={Percent}
            title="إجمالي العمولات"
            value={summary?.total_commissions || ""}
            accent
          />
          <SummaryCard
            icon={PlusCircle}
            title="المكافآت والحوافز"
            value={summary?.total_bonuses || ""}
            success
          />
          <SummaryCard
            icon={MinusCircle}
            title="الاستقطاعات والسلف"
            value={
              toNumber(summary?.total_deductions) +
                toNumber(summary?.total_advances) || ""
            }
            danger
          />
        </div>
      </div>

      {employeeIdFilter && (
        <Card className="rounded-premium border border-accent/20 bg-accent-subtle/30 p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-accent">
                عرض مخصص لموظف واحد
              </div>
              <div className="text-xl font-black text-main">
                {selectedEmployeeLabel}
              </div>
              <p className="text-sm font-medium text-muted">
                سجل راتب وسلف الموظف مع روابط مباشرة لملفه الإداري وتقاريره.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() =>
                  navigate(`/owner/hr?employeeId=${employeeIdFilter}`)
                }
                className="h-11 rounded-xl px-6 text-xs font-black uppercase tracking-widest"
              >
                ملف الموظف
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() =>
                  navigate(
                    `/owner/reports?scope=employee&employeeId=${employeeIdFilter}&employeeName=${encodeURIComponent(selectedEmployeeLabel)}`,
                  )
                }
                className="h-11 rounded-xl px-6 text-xs font-black uppercase tracking-widest"
              >
                تقرير الموظف
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => navigate("/owner/payroll")}
                className="h-11 rounded-xl px-6 text-xs font-black uppercase tracking-widest"
              >
                كل الرواتب
              </Button>
            </div>
          </div>
        </Card>
      )}
      <Card className="overflow-hidden rounded-premium border border-border/60 bg-card shadow-soft transition-all hover:shadow-premium">
        <div className="flex flex-col justify-between gap-6 border-b border-border/40 p-8 lg:flex-row lg:items-center bg-soft/30">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-main leading-none">
              كشف استحقاقات الكادر
            </h2>
            <p className="mt-2 text-sm font-medium text-muted">
              مراجعة دقيقة لمكونات الراتب والعمولات المحققة
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge
              variant="success"
              className="h-8 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest"
            >
              تم الصرف: {money(summary?.paid_total)}
            </Badge>
            <Badge
              variant="warning"
              className="h-8 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest"
            >
              قيد الانتظار: {money(summary?.unpaid_total)}
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-border bg-soft/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  الموظف
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  الأساسي
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  العمولات
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                  إضافات (+)
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                  خصومات (-)
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                  صافي الراتب
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                  حالة الصرف
                </th>
                <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {visiblePayrollRows.map((row) => (
                <tr
                  key={row.id}
                  className="group transition-all hover:bg-accent-subtle/30"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/10 bg-accent-soft font-black text-accent text-sm shadow-sm transition-transform group-hover:scale-110">
                        {(row.employee_name_snapshot || "U").charAt(0)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-base font-black text-main leading-none group-hover:text-accent transition-colors">
                          {row.employee_name_snapshot || "مجهول"}
                        </div>
                        <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                          {row.role_snapshot || "موظف"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-main tabular-nums">
                    {money(row.base_salary)}
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-accent tabular-nums">
                    {money(row.commission_amount)}
                  </td>
                  <td className="px-8 py-5 text-center text-sm font-black text-success tabular-nums">
                    +{money(row.bonus_amount)}
                  </td>
                  <td className="px-8 py-5 text-center text-sm font-black text-danger tabular-nums">
                    <div className="flex flex-col items-center">
                      <span>
                        -
                        {money(
                          toNumber(row.deduction_amount) +
                            toNumber(row.advance_amount),
                        )}
                      </span>
                      {toNumber(row.advance_amount) > 0 && (
                        <span className="text-[9px] font-bold opacity-70">
                          (سلف: {money(row.advance_amount)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-lg font-black text-main tracking-tighter tabular-nums">
                      {money(row.net_salary)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-3">
                      {row.status !== "paid" && row.status !== "cancelled" && (
                        <Button
                          type="button"
                          variant="success"
                          title="صرف مستحقات الموظف فوراً"
                          onClick={() => {
                            setSelectedRecord(row);
                            setIsPayModalOpen(true);
                          }}
                          className="h-10 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-success/10"
                        >
                          صرف الآن
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-10 w-10 rounded-xl border border-border group-hover:border-accent/20 transition-all shadow-sm"
                            title="خيارات إدارية متقدمة"
                          >
                            <MoreVertical size={18} strokeWidth={2.5} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="rounded-xl border-border bg-card shadow-premium w-48"
                        >
                          <DropdownMenuItem
                            className="text-[11px] font-black uppercase tracking-widest p-3 cursor-pointer"
                            disabled={loading}
                            onClick={() => openEditModal(row)}
                          >
                            تعديل يدوي (Manual Edit)
                          </DropdownMenuItem>
                          {row.status !== "cancelled" && (
                            <DropdownMenuItem
                              className="text-[11px] font-black uppercase tracking-widest text-danger p-3 cursor-pointer"
                              disabled={loading}
                              onClick={() => setCancelId(row.id)}
                            >
                              إلغاء السجل (Void Record)
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}

              {visiblePayrollRows.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-24 text-center opacity-40">
                    <div className="flex flex-col items-center gap-4">
                      <AlertCircle
                        size={80}
                        strokeWidth={1}
                        className="text-muted"
                      />
                      <h4 className="text-2xl font-black text-main uppercase tracking-tight">
                        لا يوجد سجلات حالية
                      </h4>
                      <p className="text-sm font-medium">
                        يرجى الضغط على زر "تحديث الحسابات" لتوليد كشوف هذا الشهر
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => !open && closeEditModal()}
      >
        <DialogContent
          className="max-w-3xl rounded-[32px] border-border bg-card p-0 shadow-premium overflow-hidden"
          dir="rtl"
        >
          <DialogHeader className="p-10 pb-6 bg-[#1B1714] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -mr-32 -mt-32" />
            <div className="relative z-10 space-y-2">
              <DialogTitle className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-4 leading-none">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Pencil size={24} />
                </div>
                تعديل بنود الراتب
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/50 uppercase tracking-widest">
                مراجعة وضبط المستحقات المالية للموظف يدوياً للفترة الحالية
              </DialogDescription>
            </div>
          </DialogHeader>

          {editingRecord && (
            <div className="p-10 space-y-10 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6 p-6 rounded-[28px] border border-border bg-soft/30">
                <InfoRow
                  label="اسم الموظف"
                  value={editingRecord.employee_name_snapshot || ""}
                />
                <InfoRow
                  label="الدورة المالية"
                  value={`${MONTHS.find((m) => m.value === editingRecord.period_month)?.label || ""} ${editingRecord.period_year}`}
                />
              </div>

              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <Field label="الراتب الأساسي المعتمد">
                  <Input
                    type="number"
                    className="h-14 rounded-xl bg-soft border-border font-black text-lg"
                    value={editData.base_salary || ""}
                    onChange={(e) =>
                      handleEditChange("base_salary", e.target.value)
                    }
                  />
                </Field>
                <Field label="قيمة العمولات المحققة">
                  <Input
                    type="number"
                    className="h-14 rounded-xl bg-soft border-border font-black text-lg text-accent"
                    value={editData.commission_amount || ""}
                    onChange={(e) =>
                      handleEditChange("commission_amount", e.target.value)
                    }
                  />
                </Field>
                <Field label="المكافآت (Bonuses)">
                  <Input
                    type="number"
                    className="h-14 rounded-xl bg-soft border-border font-black text-lg text-success"
                    value={editData.bonus_amount || ""}
                    onChange={(e) =>
                      handleEditChange("bonus_amount", e.target.value)
                    }
                  />
                </Field>
                <Field label="الخصومات الإدارية">
                  <Input
                    type="number"
                    className="h-14 rounded-xl bg-soft border-border font-black text-lg text-danger"
                    value={editData.deduction_amount || ""}
                    onChange={(e) =>
                      handleEditChange("deduction_amount", e.target.value)
                    }
                  />
                </Field>
                <Field label="السلف والمسحوبات">
                  <Input
                    type="number"
                    className="h-14 rounded-xl bg-soft border-border font-black text-lg text-danger"
                    value={editData.advance_amount || ""}
                    onChange={(e) =>
                      handleEditChange("advance_amount", e.target.value)
                    }
                  />
                </Field>
                <Field label="طريقة صرف المستحقات">
                  <Select
                    value={editData.payment_method || ""}
                    onValueChange={(v) => handleEditChange("payment_method", v)}
                  >
                    <SelectTrigger className="h-14 rounded-xl border-border bg-soft font-black text-xs uppercase transition-all focus:bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card shadow-premium">
                      <SelectItem value="cash" className="font-bold">
                        نقدي (Cash)
                      </SelectItem>
                      <SelectItem value="card" className="font-bold">
                        بطاقة (Card)
                      </SelectItem>
                      <SelectItem value="bank_transfer" className="font-bold">
                        تحويل بنكي (IBAN)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="ملاحظات الملف المالي">
                <textarea
                  rows={3}
                  value={editData.notes || ""}
                  onChange={(e) => handleEditChange("notes", e.target.value)}
                  className="w-full rounded-2xl border border-border bg-soft p-5 text-sm font-medium focus:bg-white focus:border-accent outline-none transition-all resize-none"
                  placeholder="توثيق أسباب التعديلات اليدوية..."
                />
              </Field>

              <div className="rounded-[28px] border-2 border-accent/20 bg-accent-subtle/30 p-8 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-accent">
                    الصافي النهائي المعدل
                  </div>
                  <div className="text-sm font-bold text-muted">
                    بناءً على المعايير الجديدة المدخلة
                  </div>
                </div>
                <div className="text-4xl font-black tracking-tighter text-accent tabular-nums">
                  {money(editedNetSalary)}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-10 pt-6 border-t border-border bg-card flex gap-4">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={closeEditModal}
              className="flex-1 rounded-xl font-black uppercase tracking-widest h-14"
            >
              إلغاء التعديل
            </Button>
            <Button
              disabled={loading}
              onClick={handleSaveEdit}
              loading={isSavingEdit}
              className="flex-2 rounded-xl font-black text-lg h-14 shadow-lg shadow-accent/20"
            >
              اعتماد المستحقات الجديدة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redesigned Pay Modal */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent
          className="max-w-md rounded-[32px] border-border bg-card p-0 shadow-premium overflow-hidden"
          dir="rtl"
        >
          <DialogHeader className="p-8 pb-4 bg-success relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
            <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                <Banknote size={20} />
              </div>
              صرف المستحقات
            </DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-8">
            {selectedRecord && (
              <div className="space-y-5 rounded-xl border border-border bg-soft/50 p-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted uppercase tracking-widest">
                    اسم المستحق
                  </span>
                  <span className="text-sm font-black text-main">
                    {selectedRecord.employee_name_snapshot}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted uppercase tracking-widest">
                    الدورة الشهرية
                  </span>
                  <span className="text-sm font-bold text-main">
                    {
                      MONTHS.find(
                        (m) => m.value === selectedRecord.period_month,
                      )?.label
                    }{" "}
                    {selectedRecord.period_year}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-5 mt-5">
                  <span className="text-xs font-black text-main uppercase">
                    المبلغ النهائي المعتمد:
                  </span>
                  <span className="text-2xl font-black text-success tabular-nums">
                    {money(selectedRecord.net_salary)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">
                قناة الصرف النهائية
              </label>
              <Select
                value={payData.payment_method || ""}
                onValueChange={(val) =>
                  setPayData({ ...payData, payment_method: val })
                }
              >
                <SelectTrigger className="h-14 rounded-xl border-border bg-soft font-black text-xs uppercase focus:bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-premium">
                  <SelectItem value="cash" className="font-bold">
                    صرف نقدي (Cash Out)
                  </SelectItem>
                  <SelectItem value="card" className="font-bold">
                    تحويل بطاقة (Card Transfer)
                  </SelectItem>
                  <SelectItem value="bank_transfer" className="font-bold">
                    تحويل بنكي (IBAN)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-8 pt-6 border-t border-border bg-card flex gap-4">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setIsPayModalOpen(false)}
              className="flex-1 rounded-xl font-black h-14"
            >
              إغلاق
            </Button>
            <Button
              disabled={loading}
              onClick={handlePay}
              className="flex-2 rounded-xl font-black text-lg h-14 bg-success hover:bg-success-dark text-white shadow-lg shadow-success/20"
            >
              تأكيد عملية الصرف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="overflow-hidden rounded-premium border border-border/60 bg-card shadow-soft transition-all hover:shadow-premium mt-8">
        <div className="flex flex-col justify-between gap-6 border-b border-border/40 p-8 lg:flex-row lg:items-center bg-success-soft/30">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-main leading-none flex items-center gap-3">
              <Banknote className="text-success" /> إدارة السلف المعلقة
            </h2>
            <p className="mt-2 text-sm font-medium text-muted">
              السلف التي لم يتم خصمها من أي راتب حتى الآن
            </p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-border bg-soft/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  الموظف
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  المبلغ
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  التاريخ
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  البيان
                </th>
                <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {advances.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-8 py-10 text-center text-muted font-bold"
                  >
                    لا توجد سلف معلقة حالياً
                  </td>
                </tr>
              ) : (
                advances.map((adv) => (
                  <tr
                    key={adv.id}
                    className="group hover:bg-soft/30 transition-all"
                  >
                    <td className="px-8 py-5">
                      <div className="text-sm font-black text-main">
                        {adv.employee_name}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-black text-danger">
                      {money(adv.amount)}
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-muted">
                      {new Date(adv.advance_date).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-muted">
                      {adv.description || "---"}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={loading}
                        onClick={() => handleDeleteAdvance(adv.id)}
                        className="h-9 w-9 text-danger/40 hover:text-danger hover:bg-danger-soft transition-all"
                        title="حذف السلفة"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

function SummaryCard({ icon: Icon, title, value, accent, success, danger }) {
  const color = accent
    ? "text-accent"
    : success
      ? "text-success"
      : danger
        ? "text-danger"
        : "text-muted";
  return (
    <Card className="flex min-h-42.5 flex-col justify-between rounded-premium border border-border/60 bg-card p-8 shadow-soft transition-all hover:border-accent/20 group">
      <div
        className={`w-fit rounded-2xl bg-soft p-3.5 ${color} transition-transform group-hover:scale-110 shadow-sm`}
      >
        <Icon size={24} strokeWidth={2} />
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-accent transition-colors mb-1">
          {title}
        </div>
        <div className="text-2xl font-black text-main tabular-nums tracking-tighter">
          {money(value)}
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }) {
  const config = {
    paid: { label: "تم الصرف", variant: "success" },
    cancelled: { label: "ملغي إدارياً", variant: "danger" },
    calculated: { label: "محسوب (مسودة)", variant: "outline" },
  };
  const current = config[status] || {
    label: "غير معروف",
    variant: "secondary",
  };
  return (
    <Badge
      variant={current.variant}
      className="h-6 px-4 rounded-lg font-black text-[9px] uppercase tracking-widest"
    >
      {current.label}
    </Badge>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted">
        {label}
      </span>
      <span className="text-sm font-black text-main">{value || "---"}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="space-y-3 block">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">
        {label}
      </span>
      {children}
    </label>
  );
}

export default Payroll;

