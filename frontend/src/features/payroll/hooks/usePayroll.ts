import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import payrollService from "@/services/payrollService";
import salaryAdvanceService from "@/features/payroll/services/salaryAdvanceService";
import { adaptList, adaptObject } from "@/services/apiAdapter";
import api from "@/services/api";

function readTotalCount(response: unknown, fallback: number): number {
  const h = (response as { headers?: Record<string, unknown> } | null)?.headers ?? {};
  const raw = h["x-total-count"] ?? h["X-Total-Count"];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/core/utils";
import { pctGrowth } from "@/lib/money/financialAnalytics";
import { Clock, TrendingDown, Users, Wallet } from "lucide-react";

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

export const YEARS = [2024, 2025, 2026, 2027];
export const toNumber = (v: unknown) => Number(v || 0);
export const calculateNetSalary = (form: Record<string, unknown>) => toNumber(form.base_salary) + toNumber(form.commission_amount) + toNumber(form.bonus_amount) - toNumber(form.deduction_amount) - toNumber(form.advance_amount);

function prevPeriodOf(p: Period): Period {
  if (p.month === 1) return { month: 12, year: p.year - 1 };
  return { month: p.month - 1, year: p.year };
}

export function formatSignedPct(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "+";
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

export function pctLabel(part: unknown, total: unknown): string {
  const p = toNumber(part);
  const t = toNumber(total);
  if (t <= 0) return "—";
  return `${((p / t) * 100).toFixed(1)}%`;
}

export function usePayroll() {
  const { t, i18n } = useTranslation("owner");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get("employeeId");
  const employeeNameFilter = searchParams.get("employeeName") || "";
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [isSavingAdvance, setIsSavingAdvance] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [cancelId, setCancelId] = useState<number | string | null>(null);
  const [period, setPeriod] = useState<Period>({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [payData, setPayData] = useState<PayData>({ payment_method: "cash", notes: "" });
  const [advanceData, setAdvanceData] = useState<AdvanceData>({ employee_id: "", amount: "", description: "", advance_date: new Date().toISOString().split("T")[0] });
  const [editData, setEditData] = useState<EditData>({ base_salary: 0, commission_amount: 0, bonus_amount: 0, deduction_amount: 0, advance_amount: 0, payment_method: "cash", notes: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [sortKey, setSortKey] = useState<"net" | "name" | "base">("net");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAllStaff, setShowAllStaff] = useState(false);
  // Phase 2: pagination — server-side via /payroll?page=&size=
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPaying, setBulkPaying] = useState(false);

  const activeRole = String((user as unknown as { role?: string })?.role || "").toLowerCase();
  void activeRole;

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const payrollParams = { ...period, employee_id: employeeIdFilter || undefined, page, size };
      const prev = prevPeriodOf(period);
      const [listRes, summaryRes, prevSummaryRes, advancesRes, employeesRes] = await Promise.all([
        payrollService.list(payrollParams),
        payrollService.summary(payrollParams),
        payrollService.summary({ ...prev, employee_id: employeeIdFilter || undefined }).catch(() => null),
        salaryAdvanceService.list({ isDeducted: false, employee_id: employeeIdFilter || undefined }),
        api.get("/employees"),
      ]);
      setPayrolls(adaptList(listRes));
      // Phase 2: read X-Total-Count header (set by /payroll endpoint)
      setTotalCount(readTotalCount(listRes, adaptList(listRes).length));
      setSummary(adaptObject(summaryRes, { total_payroll: 0, total_employees: 0 }) as PayrollSummary);
      setPrevSummary(prevSummaryRes ? (adaptObject(prevSummaryRes, null) as PayrollSummary | null) : null);
      setAdvances(adaptList(advancesRes));
      setEmployees(adaptList(employeesRes));
    } catch {
      toast.error(t("payroll.loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, employeeIdFilter, i18n.language]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  const handleCalculate = async () => {
    try {
      await toast.promise(payrollService.calculate(period), { loading: t("payroll.calcLoading"), success: t("payroll.calcSuccess"), error: t("payroll.calcError") });
      fetchData(true);
    } catch {}
  };

  const handlePay = async () => {
    if (!selectedRecord) return;
    try {
      await toast.promise(payrollService.pay(selectedRecord.id as string | number, payData), { loading: t("payroll.payLoading"), success: t("payroll.paySuccess"), error: t("payroll.payError") });
      setIsPayModalOpen(false); setSelectedRecord(null); fetchData(true);
    } catch {}
  };

  const handleBulkPay = async () => {
    const ids = Array.from(selectedIds);
    const rows = payrolls.filter((r) => ids.includes(String(r.id)) && r.status !== "paid" && r.status !== "cancelled");
    if (rows.length === 0) {
      toast.error(t("payroll.selectPayable"));
      return;
    }
    setBulkPaying(true);
    let ok = 0;
    let fail = 0;
    for (const r of rows) {
      try {
        await payrollService.pay(r.id as string | number, { payment_method: payData.payment_method || "cash" });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBulkPaying(false);
    setSelectedIds(new Set());
    if (ok) toast.success(t("payroll.bulkPaySuccess", { count: ok }));
    if (fail) toast.error(t("payroll.bulkPayFailed", { count: fail }));
    fetchData(true);
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try { await payrollService.cancel(cancelId); toast.success(t("payroll.cancelledOk")); setCancelId(null); fetchData(true); } catch { toast.error(t("payroll.cancelFailed")); }
  };

  const handleCreateAdvance = async () => {
    if (!advanceData.employee_id || !advanceData.amount) return toast.error(t("payroll.advanceIncomplete"));
    const amt = toNumber(advanceData.amount);
    if (amt <= 0) return toast.error(t("payroll.amountPositive"));
    try {
      setIsSavingAdvance(true);
      await toast.promise(salaryAdvanceService.create({ ...advanceData, amount: amt } as unknown as AdvanceData), { loading: t("payroll.advanceLoading"), success: t("payroll.advanceSuccess"), error: t("payroll.advanceError") });
      setIsAdvanceModalOpen(false); setAdvanceData({ employee_id: "", amount: "", description: "", advance_date: new Date().toISOString().split("T")[0] }); fetchData(true);
    } finally { setIsSavingAdvance(false); }
  };

  const handleDeleteAdvance = async (id: number | string) => { try { await salaryAdvanceService.remove(id); toast.success(t("payroll.deleteOk")); fetchData(true); } catch { toast.error(t("payroll.deleteFailed")); } };

  const fetchExpectedNet = async (empId: number | string) => {
    try { const res = await payrollService.expectedNet({ employee_id: empId, ...period }); setExpectedData(res as unknown as typeof expectedData); setIsExpectedModalOpen(true); } catch { toast.error(t("payroll.expectedNetFailed")); }
  };

  const openEditModal = (row: PayrollRecord) => {
    setEditingRecord(row);
    setEditData({ base_salary: toNumber(row.base_salary), commission_amount: toNumber(row.commission_amount), bonus_amount: toNumber(row.bonus_amount), deduction_amount: toNumber(row.deduction_amount), advance_amount: toNumber(row.advance_amount), payment_method: (row.payment_method as string) || "cash", notes: (row.notes as string) || "" });
    setIsEditModalOpen(true);
  };
  const closeEditModal = () => { setIsEditModalOpen(false); setEditingRecord(null); };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    const base = toNumber(editData.base_salary);
    const comm = toNumber(editData.commission_amount);
    const bonus = toNumber(editData.bonus_amount);
    const ded = toNumber(editData.deduction_amount);
    const adv = toNumber(editData.advance_amount);
    if (base < 0 || comm < 0 || bonus < 0 || ded < 0 || adv < 0) return toast.error(t("payroll.negativeValues"));
    const totalAdd = base + comm + bonus;
    const totalDed = ded + adv;
    if (totalDed > totalAdd) return toast.error(t("payroll.deductionsExceed"));
    try {
      setIsSavingEdit(true);
      await toast.promise(payrollService.update(editingRecord.id as string | number, { base_salary: base, commission_amount: comm, bonus_amount: bonus, deduction_amount: ded, advance_amount: adv, payment_method: editData.payment_method || null, notes: editData.notes?.trim() || null, net_salary: calculateNetSalary(editData as unknown as Record<string, unknown>) } as unknown as Parameters<typeof payrollService.update>[1]), { loading: t("payroll.saveLoading"), success: t("payroll.saveSuccess"), error: t("payroll.saveError") });
      closeEditModal(); fetchData(true);
    } finally { setIsSavingEdit(false); }
  };

  const rawRows = Array.isArray(payrolls) ? payrolls : [];
  const filteredRows = useMemo(() => {
    let rows = rawRows.filter((r) => {
      if (employeeIdFilter && String(r.employee_id || r.employeeId) !== String(employeeIdFilter)) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (String(r.employee_name_snapshot || "").toLowerCase().includes(q) || String(r.net_salary || "").includes(q));
    });
    rows = [...rows].sort((a, b) => {
      if (sortKey === "name") {
        const av = String(a.employee_name_snapshot || "");
        const bv = String(b.employee_name_snapshot || "");
        return sortDir === "asc" ? av.localeCompare(bv, "ar") : bv.localeCompare(av, "ar");
      }
      if (sortKey === "base") {
        const av = toNumber(a.base_salary);
        const bv = toNumber(b.base_salary);
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const av = toNumber(a.net_salary);
      const bv = toNumber(b.net_salary);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [rawRows, employeeIdFilter, searchTerm, sortKey, sortDir]);

  const editedNetSalary = calculateNetSalary(editData as unknown as Record<string, unknown>);

  const growth = useMemo(() => {
    const curr = toNumber(summary?.total_net_salary ?? summary?.total_payroll);
    const prev = toNumber(prevSummary?.total_net_salary ?? prevSummary?.total_payroll);
    return pctGrowth(curr, prev);
  }, [summary, prevSummary]);

  const paidGrowth = useMemo(() => pctGrowth(toNumber(summary?.paid_total), toNumber(prevSummary?.paid_total)), [summary, prevSummary]);
  const unpaidGrowth = useMemo(() => pctGrowth(toNumber(summary?.unpaid_total), toNumber(prevSummary?.unpaid_total)), [summary, prevSummary]);

  const avgSalary = useMemo(() => {
    const total = toNumber(summary?.total_net_salary);
    const count = toNumber(summary?.employees_count || summary?.total_employees || filteredRows.length);
    return count > 0 ? total / count : 0;
  }, [summary, filteredRows.length]);

  const paidPct = useMemo(() => {
    const total = toNumber(summary?.total_net_salary);
    const paid = toNumber(summary?.paid_total);
    return total > 0 ? Math.round((paid / total) * 100) : 0;
  }, [summary]);

  const selectableRows = useMemo(() => filteredRows.filter((r) => r.status !== "paid" && r.status !== "cancelled"), [filteredRows]);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selectedIds.has(String(r.id)));
  const toggleSelect = (id: string | number) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableRows.map((r) => String(r.id))));
  };

  const handlePrint = () => window.print();

  const pieData = useMemo(() => [
    { name: t("payroll.pieBase"), value: toNumber(summary?.total_base_salary) },
    { name: t("payroll.pieCommissions"), value: toNumber(summary?.total_commissions) },
    { name: t("payroll.pieBonuses"), value: toNumber(summary?.total_bonuses) },
    { name: t("payroll.pieDeductions"), value: toNumber(summary?.total_deductions) },
    { name: t("payroll.pieAdvances"), value: toNumber(summary?.total_advances) },
  ], [summary, i18n.language]);

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const systemLinks = useMemo(() => {
    const advCount = advances.length;
    const unpaid = toNumber(summary?.unpaid_total);
    const paid = toNumber(summary?.paid_total);
    return [
      { label: t("payroll.sysHR"), icon: Users, desc: t("payroll.sysHRDesc", { count: employees.length }), color: "bg-primary", href: "/manager/hr", badge: `${employees.length}` },
      { label: t("payroll.sysAttendance"), icon: Clock, desc: t("payroll.sysAttendanceDesc"), color: "bg-emerald-500", href: "/attendance", badge: t("payroll.recordsBadge", { count: toNumber(summary?.employees_count) || employees.length }) },
      { label: t("payroll.sysAdvances"), icon: TrendingDown, desc: advCount ? t("payroll.sysAdvancesPending", { count: advCount }) : t("payroll.sysAdvancesNone"), color: "bg-rose-500", href: "/owner/payroll#advances", badge: `${advCount}` },
      { label: t("payroll.sysCashbox"), icon: Wallet, desc: unpaid > 0 ? t("payroll.sysCashboxUnpaid", { amount: formatCurrency(unpaid) }) : t("payroll.sysCashboxPaid", { amount: formatCurrency(paid) }), color: "bg-amber-500", href: "/owner/cashbox", badge: unpaid > 0 ? t("payroll.remainingBadge") : t("payroll.completeBadge") },
    ];
  }, [employees.length, advances.length, summary, i18n.language]);

  const applyPreset = (preset: "current" | "prev") => {
    const now = new Date();
    if (preset === "current") setPeriod({ month: now.getMonth() + 1, year: now.getFullYear() });
    else setPeriod(prevPeriodOf({ month: now.getMonth() + 1, year: now.getFullYear() }));
  };

  const isCurrentPreset = useMemo(() => {
    const now = new Date();
    return period.month === now.getMonth() + 1 && period.year === now.getFullYear();
  }, [period]);

  const prevLabel = useMemo(() => {
    const p = prevPeriodOf(period);
    return `${t(`payroll.months.m${p.month}`)} ${p.year}`;
  }, [period, i18n.language]);

  return {
    navigate,
    employeeIdFilter,
    employeeNameFilter,
    employees,
    payrolls,
    advances,
    summary,
    prevSummary,
    loading,
    refreshing,
    isPayModalOpen,
    setIsPayModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    isAdvanceModalOpen,
    setIsAdvanceModalOpen,
    isExpectedModalOpen,
    setIsExpectedModalOpen,
    expectedData,
    isSavingAdvance,
    isSavingEdit,
    selectedRecord,
    setSelectedRecord,
    editingRecord,
    setEditingRecord,
    cancelId,
    setCancelId,
    period,
    setPeriod,
    payData,
    setPayData,
    advanceData,
    setAdvanceData,
    editData,
    setEditData,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    showAllStaff,
    setShowAllStaff,
    selectedIds,
    setSelectedIds,
    bulkPaying,
    setBulkPaying,
    activeRole,
    fetchData,
    handleCalculate,
    handlePay,
    handleBulkPay,
    handleCancel,
    handleCreateAdvance,
    handleDeleteAdvance,
    fetchExpectedNet,
    openEditModal,
    closeEditModal,
    handleSaveEdit,
    rawRows,
    filteredRows,
    editedNetSalary,
    growth,
    // Phase 2: pagination
    page,
    setPage,
    size,
    setSize,
    totalCount,
    paidGrowth,
    unpaidGrowth,
    avgSalary,
    paidPct,
    selectableRows,
    allSelected,
    toggleSelect,
    toggleSelectAll,
    handlePrint,
    pieData,
    pieTotal,
    systemLinks,
    applyPreset,
    isCurrentPreset,
    prevLabel,
  };
}
