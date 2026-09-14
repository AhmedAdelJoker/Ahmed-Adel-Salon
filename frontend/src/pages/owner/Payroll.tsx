import { usePayroll, MONTHS, YEARS, toNumber, formatSignedPct, pctLabel, calculateNetSalary } from "@/features/payroll";
import exportService from "@/services/exportService";
import api from "@/services/api";
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
  Printer,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown,
  Sparkles,
  TrendingUp,
  Target,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { cn, formatCurrency } from "@/lib/core/utils";
import { PageHeader, PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { CurrencyStatCard, StatCard as DisplayStatCard } from "@/components/shared/DisplayComponents";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Payroll() {
  const {
    navigate,
    employeeIdFilter,
    employeeNameFilter,
    employees,
    advances,
    summary,
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
    bulkPaying,
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
  } = usePayroll();

  if (loading && rawRows.length === 0) {
    return (
      <div className="erp-page-container space-y-6 pb-10" dir="rtl">
        <div className="flex flex-col items-center gap-3 py-10">
          <Sparkles className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted">جاري تدقيق الرواتب...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" height={260} />
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-6 pb-10" dir="rtl">
      <ConfirmDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)} title="إلغاء السجل؟" description="سيتم إلغاء هذا القيد من كشف الرواتب." onConfirm={handleCancel} />

      <PageHeader
        title="مسيرات الرواتب"
        subtitle="إدارة التعويضات والعمولات والكشوف الشهرية — احترافية عالمية"
        badge="الموارد المالية"
        icon={Banknote}
        actions={
          <div className="flex flex-col gap-2 w-full xl:w-auto print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={isCurrentPreset ? "primary" : "outline"} size="sm" onClick={() => applyPreset("current")} className="h-9 rounded-xl text-[11px] font-black">الشهر الحالي</Button>
              <Button variant={!isCurrentPreset ? "primary" : "outline"} size="sm" onClick={() => applyPreset("prev")} className="h-9 rounded-xl text-[11px] font-black">الشهر السابق</Button>
              <span className="hidden sm:inline h-6 w-px bg-border" />
              <Button variant="outline" onClick={() => exportService.downloadExcel("/exports/payroll/excel", "payroll_report", period as unknown as Record<string, unknown>)} className="h-9 rounded-xl px-3 text-[11px] font-black"><FileSpreadsheet size={14} className="ml-1.5 text-success" />Excel</Button>
              <Button variant="outline" onClick={handlePrint} className="h-9 rounded-xl px-3 text-[11px] font-black"><Printer size={14} className="ml-1.5" /> طباعة / PDF</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setIsAdvanceModalOpen(true)} className="h-9 rounded-xl px-3 text-[11px] font-black text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-600 hover:text-white"><MinusCircle size={14} className="ml-1.5" /> سلفة</Button>
              <Button variant="outline" onClick={() => navigate("/owner/payroll/archive")} className="h-9 rounded-xl px-3 text-[11px] font-black"><Archive size={14} className="ml-1.5" /> الأرشيف</Button>
              <Button onClick={handleCalculate} disabled={loading || refreshing} className="h-9 rounded-xl px-5 bg-primary hover:bg-primary-strong text-white font-black shadow-lg"><RefreshCw size={14} className={cn("ml-1.5", refreshing && "animate-spin")} /> تحديث الحسابات</Button>
            </div>
          </div>
        }
      />

      {/* Dynamic System Relations */}
      <PremiumCard noPadding className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/20" animate={false}>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center"><Building2 size={16} /></div>
            <div><h3 className="text-sm font-black text-main">ترابط الرواتب بالنظام</h3><p className="text-[11px] font-bold text-muted">كل راتب هو حلقة وصل بين الحضور والعمولات والخزنة — الأرقام حية من نفس الفترة</p></div>
            <Badge className="mr-auto hidden rounded-full border-primary/20 bg-primary-soft text-primary text-[10px] font-black sm:flex">تكامل تلقائي • {MONTHS.find((m) => m.value === period.month)?.label} {period.year}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {systemLinks.map((l) => (
              <button key={l.label} onClick={() => { if (l.href.includes("#advances")) document.getElementById("advances")?.scrollIntoView({ behavior: "smooth" }); else navigate(l.href); }} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right hover:border-primary hover:shadow-md transition-all">
                <div className={cn("h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0", l.color)}><l.icon size={18} /></div>
                <div className="min-w-0 flex-1"><div className="text-xs font-black text-main flex items-center gap-1">{l.label} <span className="mr-auto rounded-full bg-soft border border-border px-2 py-0.5 text-[9px] font-black">{l.badge}</span> <ArrowUpRight size={12} className="text-muted group-hover:text-primary shrink-0" /></div><div className="text-[10px] font-bold text-muted leading-tight mt-0.5 line-clamp-2 text-start">{l.desc}</div></div>
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      {/* KPIs with growth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CurrencyStatCard
          label="كتلة الرواتب"
          value={toNumber(summary?.total_net_salary)}
          icon={Wallet}
          variant="primary"
          trend={growth === null ? undefined : growth >= 0 ? "positive" : "negative"}
          trendValue={growth === null ? undefined : formatSignedPct(growth)}
          hint={`${toNumber(summary?.employees_count) || employees.length} موظف • عن ${prevLabel}`}
        />
        <CurrencyStatCard
          label="تم صرفه"
          value={toNumber(summary?.paid_total)}
          icon={CheckSquare}
          variant="success"
          trend={paidGrowth === null ? undefined : paidGrowth >= 0 ? "positive" : "negative"}
          trendValue={paidGrowth === null ? undefined : formatSignedPct(paidGrowth)}
          hint={`${paidPct}% من الإجمالي`}
        />
        <CurrencyStatCard
          label="متبقي للصرف"
          value={toNumber(summary?.unpaid_total)}
          icon={Clock}
          variant={unpaidGrowth === null ? "warning" : unpaidGrowth > 0 ? "danger" : "warning"}
          trend={unpaidGrowth === null ? undefined : unpaidGrowth > 0 ? "negative" : "positive"}
          trendValue={unpaidGrowth === null ? undefined : formatSignedPct(unpaidGrowth)}
          hint={toNumber(summary?.unpaid_total) === 0 ? "مكتمل ✅" : "بانتظار الصرف"}
        />
        <DisplayStatCard
          label="متوسط الراتب"
          value={formatCurrency(avgSalary)}
          icon={Target}
          variant="info"
          hint={`عن ${MONTHS.find((m) => m.value === period.month)?.label} ${period.year}`}
        />
      </div>

      {/* Period + Chart + Stats - improved */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
        <PremiumCard className="xl:col-span-3 p-5 flex flex-col min-w-0" animate={false}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted">الفترة المالية</div>
            <span className="text-[10px] font-black rounded-full bg-soft border border-border px-2 py-0.5">{prevLabel} للمقارنة</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={String(period.month)} onValueChange={(v) => setPeriod({ ...period, month: Number(v) })}>
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(period.year)} onValueChange={(v) => setPeriod({ ...period, year: Number(v) })}>
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="mt-4 p-4 rounded-2xl bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="text-[10px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2"><Activity size={12} /> إجمالي كتلة الرواتب</div>
              <div className="text-2xl font-black tabular-nums mt-1">{formatCurrency(summary?.total_net_salary)}</div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] font-bold mb-1"><span className="text-white/70">نسبة الصرف</span><span>{paidPct}%</span></div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${paidPct}%` }} /></div>
              </div>
              <div className="flex gap-2 mt-3 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded-full bg-white/10">صرف {formatCurrency(summary?.paid_total)}</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-200">متبقي {formatCurrency(summary?.unpaid_total)}</span>
              </div>
              {growth !== null && (
                <div className="mt-3 flex items-center gap-1 text-[11px] font-black">
                  {growth >= 0 ? <TrendingUp size={14} className="text-emerald-300" /> : <TrendingDown size={14} className="text-rose-300" />}
                  <span className={growth >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatSignedPct(growth)} عن {prevLabel}</span>
                </div>
              )}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="xl:col-span-5 p-5 min-w-0 flex flex-col" animate={false}>
          <h3 className="text-xs font-black uppercase tracking-widest text-muted mb-1 flex items-center gap-2"><Sparkles size={12} className="text-primary" /> تحليل التكاليف — 5 مكونات</h3>
          <p className="text-[10px] font-bold text-muted mb-3">تقسيم الكتلة إلى أساسي + عمولات + مكافآت مقابل الاستقطاعات والسلف</p>
          <div className="h-[220px] w-full min-w-0 flex-1">
            {pieTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">
                    <Cell fill="#0f172a" />
                    <Cell fill="#0ea5e9" />
                    <Cell fill="#10b981" />
                    <Cell fill="#f43f5e" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <RechartsTooltip formatter={(v: number | string) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontWeight: 800, fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 800, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-muted">
                <div className="h-12 w-12 rounded-2xl bg-soft border flex items-center justify-center"><Activity size={18} /></div>
                <p className="text-xs font-black">لا توجد بيانات تكاليف</p><p className="text-[11px] font-bold">اضغط تحديث الحسابات</p>
              </div>
            )}
          </div>
          {pieTotal > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40">
              <div className="text-center"><div className="text-[9px] font-black text-muted uppercase">الاستحقاقات</div><div className="text-xs font-black text-main">{formatCurrency(toNumber(summary?.total_base_salary) + toNumber(summary?.total_commissions) + toNumber(summary?.total_bonuses))}</div></div>
              <div className="text-center border-x border-border/40"><div className="text-[9px] font-black text-muted uppercase">الاستقطاعات</div><div className="text-xs font-black text-rose-600">{formatCurrency(toNumber(summary?.total_deductions) + toNumber(summary?.total_advances))}</div></div>
              <div className="text-center"><div className="text-[9px] font-black text-muted uppercase">الصافي</div><div className="text-xs font-black text-primary">{formatCurrency(summary?.total_net_salary)}</div></div>
            </div>
          )}
        </PremiumCard>

        <div className="xl:col-span-4 grid grid-cols-2 gap-3 min-w-0 content-start">
          <PremiumCard className="p-4 border-l-4 border-slate-900" animate={false}>
            <div className="text-[10px] font-black text-muted uppercase">الأساسي</div>
            <div className="text-lg font-black tabular-nums">{formatCurrency(summary?.total_base_salary)}</div>
            <div className="text-[10px] font-bold text-muted">{toNumber(summary?.employees_count) || 0} موظف</div>
          </PremiumCard>
          <PremiumCard className="p-4 border-l-4 border-sky-500" animate={false}>
            <div className="text-[10px] font-black text-muted uppercase">العمولات</div>
            <div className="text-lg font-black tabular-nums text-sky-600">{formatCurrency(summary?.total_commissions)}</div>
            <div className="text-[10px] font-bold text-sky-600/70">{pctLabel(summary?.total_commissions, summary?.total_net_salary)}</div>
          </PremiumCard>
          <PremiumCard className="p-4 border-l-4 border-emerald-500" animate={false}>
            <div className="text-[10px] font-black text-muted uppercase">المكافآت</div>
            <div className="text-lg font-black text-emerald-600">{formatCurrency(summary?.total_bonuses)}</div>
            <div className="text-[10px] font-bold text-emerald-600/70">{pctLabel(summary?.total_bonuses, summary?.total_net_salary)}</div>
          </PremiumCard>
          <PremiumCard className="p-4 border-l-4 border-rose-500" animate={false}>
            <div className="text-[10px] font-black text-muted uppercase">استقطاعات + سلف</div>
            <div className="text-lg font-black text-rose-600">{formatCurrency(toNumber(summary?.total_deductions) + toNumber(summary?.total_advances))}</div>
            <div className="text-[10px] font-bold text-rose-600/70">يخصم من الصافي</div>
          </PremiumCard>
          <PremiumCard className="col-span-2 p-3 bg-amber-50/50 border-amber-200" animate={false}>
            <div className="flex items-center justify-between text-[11px] font-black">
              <span className="text-muted flex items-center gap-1"><AlertCircle size={12} /> ملاحظة التحليل</span>
              <span className="text-amber-700">{paidPct === 100 ? "مكتمل ✅" : paidPct > 50 ? "متقدم" : "يحتاج صرف"}</span>
            </div>
            <p className="text-[11px] font-bold text-muted mt-1 leading-relaxed">الدونات يوضح توزيع الكتلة. الصرف ينشئ مصروف "رواتب" ويخصم من الخزنة تلقائياً.</p>
          </PremiumCard>
        </div>
      </div>

      {employeeIdFilter && (
        <PremiumCard className="flex flex-col gap-3 border-primary/20 bg-primary-soft/40 p-4 sm:flex-row sm:items-center justify-between" animate={false}>
          <div><div className="text-[10px] font-black uppercase text-primary">فلترة موظف</div><div className="font-black text-main">{employeeNameFilter || `موظف #${employeeIdFilter}`}</div></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/owner/hr?employeeId=${employeeIdFilter}`)} className="rounded-xl font-black">ملف الموظف</Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/owner/payroll")} className="rounded-xl font-black">إلغاء الفلترة</Button>
          </div>
        </PremiumCard>
      )}

      {/* Staff Snapshot - with show all */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary"><Users size={14} /></span> الكادر الحالي</h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted hidden sm:inline">{employees.length} موظف • اضغط للفلترة</span>
            {employees.length > 10 && (
              <Button variant="outline" size="sm" onClick={() => setShowAllStaff((v) => !v)} className="h-8 rounded-xl text-[11px] font-black">
                {showAllStaff ? "عرض أقل" : `عرض الكل (+${employees.length - 10})`}
              </Button>
            )}
          </div>
        </div>
        <div className={cn("flex gap-3 overflow-x-auto pb-2 custom-scrollbar", showAllStaff ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 overflow-visible" : "xl:grid xl:grid-cols-5 xl:overflow-visible")}>
          {(showAllStaff ? employees : employees.slice(0, 10)).map((emp) => {
            const row = rawRows.find((r) => String(r.employee_id || r.employeeId) === String(emp.id));
            const isFiltered = String(employeeIdFilter) === String(emp.id);
            return (
              <Card key={emp.id} onClick={() => navigate(`/owner/payroll?employeeId=${emp.id}&employeeName=${encodeURIComponent(String(emp.full_name || emp.fullName || ""))}`)} className={cn("min-w-[200px] shrink-0 cursor-pointer rounded-2xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md lg:min-w-0", isFiltered && "border-primary/40 bg-primary-soft/40 ring-2 ring-primary/40")}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="relative">
                    <img src={emp.profile_image_url ? (typeof emp.profile_image_url === "string" && emp.profile_image_url.startsWith("http") ? emp.profile_image_url : `${api.defaults.baseURL?.replace("/api/v1", "")}${emp.profile_image_url}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(String(emp.full_name || "M"))}&background=random`} alt={String(emp.full_name || "")} className="h-14 w-14 rounded-2xl object-cover border-2 border-white shadow" />
                    <span className={cn("absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white", emp.status === "active" ? "bg-emerald-500" : "bg-muted")} />
                  </div>
                  <div className="space-y-0.5 w-full">
                    <div className="text-xs font-black text-main truncate">{String(emp.full_name || emp.fullName || "—")}</div>
                    <div className="truncate text-[10px] font-bold uppercase text-muted">{String(emp.job_title || emp.jobTitle || "موظف")}</div>
                  </div>
                  <div className="w-full pt-2 border-t border-border/40 flex justify-between text-[11px]">
                    <span className="text-muted font-bold">الأساسي</span><span className="font-black text-main tabular-nums">{formatCurrency(emp.base_salary)}</span>
                  </div>
                  <div className="w-full flex justify-between text-[11px]">
                    <span className="text-muted font-bold">الصافي</span><span className="font-black text-primary tabular-nums">{formatCurrency(row?.net_salary || 0)}</span>
                  </div>
                  {row && <StatusBadge status={String(row.status || "")} />}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payroll Table */}
      <PremiumCard noPadding className="overflow-hidden print:shadow-none">
        <div className="p-4 sm:p-5 border-b border-border bg-soft/30 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div>
              <h2 className="text-lg font-black flex items-center gap-2">كشف الاستحقاقات <Badge className="bg-primary text-white rounded-full">{filteredRows.length}</Badge></h2>
              <p className="text-xs font-bold text-muted">مراجعة دقيقة لمكونات الراتب • ترتيب حسب {sortKey === "net" ? "الصافي" : sortKey === "name" ? "الاسم" : "الأساسي"} {sortDir === "desc" ? "↓" : "↑"}</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="بحث بالاسم..." className="h-10 pr-9 rounded-xl bg-card border-border font-bold text-sm" />
              </div>
              <div className="flex bg-soft border border-border p-1 rounded-xl shrink-0">
                <button onClick={() => setViewMode("table")} className={cn("h-8 w-8 rounded-lg flex items-center justify-center", viewMode === "table" ? "bg-card shadow border border-border text-slate-900" : "text-muted")} aria-label="جدول"><ListIcon size={14} /></button>
                <button onClick={() => setViewMode("grid")} className={cn("h-8 w-8 rounded-lg flex items-center justify-center", viewMode === "grid" ? "bg-card shadow border border-border text-slate-900" : "text-muted")} aria-label="شبكة"><LayoutGrid size={14} /></button>
              </div>
            </div>
          </div>
          {selectableRows.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 print:hidden">
              <label className="flex items-center gap-2 text-sm font-black cursor-pointer">
                <button onClick={toggleSelectAll} className="h-8 w-8 rounded-lg border bg-white flex items-center justify-center">
                  {allSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted" />}
                </button>
                تحديد الكل ({selectableRows.length} قابل للصرف) • {selectedIds.size} محدد
              </label>
              <div className="flex gap-2">
                <Select value={payData.payment_method} onValueChange={(v) => setPayData({ ...payData, payment_method: v })}>
                  <SelectTrigger className="h-9 rounded-xl bg-white font-black text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">نقدي</SelectItem><SelectItem value="card">بطاقة</SelectItem><SelectItem value="bank_transfer">تحويل بنكي</SelectItem></SelectContent>
                </Select>
                <Button onClick={handleBulkPay} disabled={selectedIds.size === 0 || bulkPaying} className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4">
                  {bulkPaying ? "جاري الصرف..." : `صرف جماعي (${selectedIds.size})`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {viewMode === "table" ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right min-w-[980px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-soft/70 backdrop-blur">
                  <th className="px-3 py-3 text-center w-10">
                    <button onClick={toggleSelectAll} className="h-8 w-8 rounded-lg border bg-card flex items-center justify-center mx-auto">
                      {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">
                    <button onClick={() => { if (sortKey === "name") setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey("name"); setSortDir("asc"); } }} className="flex items-center gap-1">الموظف {sortKey === "name" ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}</button>
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-muted">
                    <button onClick={() => { if (sortKey === "base") setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey("base"); setSortDir("desc"); } }} className="flex items-center gap-1">الأساسي {sortKey === "base" ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}</button>
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-muted">العمولة</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center">إضافات</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center">خصومات</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center">
                    <button onClick={() => { if (sortKey === "net") setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey("net"); setSortDir("desc"); } }} className="flex items-center gap-1 mx-auto">الصافي {sortKey === "net" ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}</button>
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center">الحالة</th>
                  <th className="px-4 py-4 text-center text-[10px] font-black uppercase text-muted print:hidden">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredRows.map((row) => {
                  const isSel = selectedIds.has(String(row.id));
                  const canPay = row.status !== "paid" && row.status !== "cancelled";
                  return (
                    <tr key={String(row.id)} className={cn("hover:bg-soft/30 transition-colors group", isSel && "bg-amber-50/60")}>
                      <td className="px-3 py-4 text-center">
                        <button disabled={!canPay} onClick={() => toggleSelect(row.id as string | number)} className={cn("h-8 w-8 rounded-lg border flex items-center justify-center mx-auto", !canPay && "opacity-30 cursor-not-allowed", isSel ? "bg-primary border-primary text-white" : "bg-card")}>
                          {isSel ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-soft border border-border flex items-center justify-center font-black text-accent text-xs shrink-0">{(String(row.employee_name_snapshot || "U"))[0]}</div>
                          <div className="min-w-0"><div className="text-sm font-black text-main truncate">{String(row.employee_name_snapshot || "—")}</div><div className="text-[10px] font-bold text-muted uppercase truncate">{String(row.role_snapshot || "—")}</div></div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-bold tabular-nums">{formatCurrency(row.base_salary)}</td>
                      <td className="px-4 py-4 text-sm font-black text-sky-600 tabular-nums">{formatCurrency(row.commission_amount)}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-emerald-600 tabular-nums">+{formatCurrency(row.bonus_amount)}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-rose-600 tabular-nums">-{formatCurrency(toNumber(row.deduction_amount) + toNumber(row.advance_amount))}</td>
                      <td className="px-4 py-4 text-center"><span className="text-base font-black tabular-nums bg-slate-900 text-white px-3 py-1 rounded-full">{formatCurrency(row.net_salary)}</span></td>
                      <td className="px-4 py-4 text-center"><StatusBadge status={String(row.status || "")} /></td>
                      <td className="px-4 py-4 print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          {canPay && <Button size="sm" onClick={() => { setSelectedRecord(row); setIsPayModalOpen(true); }} className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-3">صرف</Button>}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 rounded-xl"><MoreVertical size={14} /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl w-48">
                              <DropdownMenuItem onClick={() => exportService.downloadPdf(`/exports/payroll/${row.id}/pdf`, `payslip_${row.employee_name_snapshot}`)} className="font-bold text-xs"><FileSpreadsheet size={12} className="ml-2" /> PDF</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => fetchExpectedNet(row.employee_id as string | number || row.employeeId as string | number)} className="font-bold text-xs"><ShieldCheck size={12} className="ml-2" /> تقرير الانضباط</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditModal(row)} className="font-bold text-xs"><Pencil size={12} className="ml-2" /> تعديل يدوي</DropdownMenuItem>
                              {String(row.status) !== "cancelled" && <DropdownMenuItem onClick={() => setCancelId(row.id as number | string)} className="font-bold text-xs text-rose-600"><Trash2 size={12} className="ml-2" /> إلغاء</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && <tr><td colSpan={9} className="py-16 text-center"><div className="flex flex-col items-center gap-2 text-muted"><AlertCircle size={32} /><p className="font-black">لا توجد سجلات</p><p className="text-xs font-bold">اضغط تحديث الحسابات لحساب رواتب {MONTHS.find((m) => m.value === period.month)?.label} {period.year}</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRows.map((row) => {
              const isSel = selectedIds.has(String(row.id));
              const canPay = row.status !== "paid" && row.status !== "cancelled";
              return (
                <PremiumCard key={String(row.id)} className={cn("p-4 space-y-3 relative", isSel && "ring-2 ring-amber-300")} animate={false}>
                  {canPay && (
                    <button onClick={() => toggleSelect(row.id as string | number)} className="absolute top-3 left-3 h-7 w-7 rounded-lg border bg-card flex items-center justify-center">
                      {isSel ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
                    </button>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-soft border flex items-center justify-center font-black text-accent">{(String(row.employee_name_snapshot || "U"))[0]}</div><div><div className="text-sm font-black">{String(row.employee_name_snapshot || "—")}</div><div className="text-[10px] font-bold text-muted">{String(row.role_snapshot || "—")}</div></div></div>
                    <StatusBadge status={String(row.status || "")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-soft p-2"><div className="text-[9px] font-black text-muted uppercase">الأساسي</div><div className="font-black">{formatCurrency(row.base_salary)}</div></div>
                    <div className="rounded-xl bg-sky-50 p-2"><div className="text-[9px] font-black text-muted uppercase">العمولة</div><div className="font-black text-sky-600">{formatCurrency(row.commission_amount)}</div></div>
                    <div className="rounded-xl bg-emerald-50 p-2"><div className="text-[9px] font-black text-muted uppercase">إضافات</div><div className="font-black text-emerald-600">+{formatCurrency(row.bonus_amount)}</div></div>
                    <div className="rounded-xl bg-rose-50 p-2"><div className="text-[9px] font-black text-muted uppercase">خصومات</div><div className="font-black text-rose-600">-{formatCurrency(toNumber(row.deduction_amount) + toNumber(row.advance_amount))}</div></div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl p-3">
                    <span className="text-[10px] font-black text-white/60 uppercase">الصافي</span><span className="font-black">{formatCurrency(row.net_salary)}</span>
                  </div>
                  <div className="flex gap-2">
                    {canPay && <Button onClick={() => { setSelectedRecord(row); setIsPayModalOpen(true); }} className="flex-1 h-9 rounded-xl bg-emerald-600 text-white font-black text-xs">صرف</Button>}
                    <Button variant="outline" onClick={() => openEditModal(row)} className="flex-1 h-9 rounded-xl font-black text-xs">تعديل</Button>
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        )}
      </PremiumCard>

      {/* Advances */}
      <div id="advances">
        <PremiumCard noPadding className="overflow-hidden" animate={false}>
          <div className="p-5 border-b border-border bg-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h3 className="font-black flex items-center gap-2"><Banknote size={16} className="text-rose-600" /> السلف المعلقة <Badge className="bg-rose-500 text-white rounded-full">{advances.length}</Badge></h3><p className="text-xs font-bold text-muted">لم تخصم بعد من الرواتب • تُخصم تلقائياً عند صرف الراتب</p></div>
          <Button variant="outline" size="sm" onClick={() => setIsAdvanceModalOpen(true)} className="rounded-xl font-black text-rose-600 border-rose-200">سلفة جديدة</Button>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right min-w-[640px]">
            <thead><tr className="bg-soft/50 border-b border-border"><th className="px-6 py-3 text-[10px] font-black uppercase text-muted">الموظف</th><th className="px-6 py-3 text-[10px] font-black uppercase text-muted">المبلغ</th><th className="px-6 py-3 text-[10px] font-black uppercase text-muted">التاريخ</th><th className="px-6 py-3 text-[10px] font-black uppercase text-muted">البيان</th><th className="px-6 py-3 text-center text-[10px] font-black uppercase text-muted">حذف</th></tr></thead>
            <tbody className="divide-y divide-border/30">
              {advances.length === 0 ? <tr><td colSpan={5} className="py-12 text-center font-bold text-muted">لا توجد سلف معلقة • السجل نظيف ✅</td></tr> : advances.map((adv) => (
                <tr key={String(adv.id)} className="hover:bg-soft/20">
                  <td className="px-6 py-4 font-black text-sm">{String((adv as unknown as { employee_name?: string }).employee_name || `موظف #${String(adv.employee_id)}`)}</td>
                  <td className="px-6 py-4 font-black text-rose-600 tabular-nums">{formatCurrency(adv.amount)}</td>
                  <td className="px-6 py-4 text-xs font-bold text-muted">{adv.advance_date ? new Date(String(adv.advance_date)).toLocaleDateString("ar-EG") : "—"}</td>
                  <td className="px-6 py-4 text-xs font-bold text-muted truncate max-w-[220px]">{String(adv.description || "—")}</td>
                  <td className="px-6 py-4 text-center"><Button variant="ghost" size="icon" onClick={() => handleDeleteAdvance(adv.id as number | string)} className="h-8 w-8 text-rose-400 hover:text-rose-600"><Trash2 size={14} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </PremiumCard>
      </div>

      {/* Modals */}
      <Dialog open={isEditModalOpen} onOpenChange={(o) => !o && closeEditModal()}>
        <DialogContent className="max-w-3xl rounded-[1.5rem] p-0 overflow-hidden max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-3"><span className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center"><Pencil size={16} /></span> تعديل بنود الراتب</DialogTitle>
            <DialogDescription className="text-white/60 text-xs font-bold">مراجعة يدوية للفترة {String(editingRecord?.period_month)}/{String(editingRecord?.period_year)} • {String(editingRecord?.employee_name_snapshot || "")} • تحقق يمنع صافي سالب</DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="الأساسي"><Input type="number" min={0} value={editData.base_salary} onChange={(e) => setEditData({ ...editData, base_salary: Number(e.target.value) })} className="h-11 rounded-xl bg-soft font-black" /></Field>
                <Field label="العمولة"><Input type="number" min={0} value={editData.commission_amount} onChange={(e) => setEditData({ ...editData, commission_amount: Number(e.target.value) })} className="h-11 rounded-xl bg-soft font-black text-sky-600" /></Field>
                <Field label="المكافآت"><Input type="number" min={0} value={editData.bonus_amount} onChange={(e) => setEditData({ ...editData, bonus_amount: Number(e.target.value) })} className="h-11 rounded-xl bg-soft font-black text-emerald-600" /></Field>
                <Field label="الخصومات"><Input type="number" min={0} value={editData.deduction_amount} onChange={(e) => setEditData({ ...editData, deduction_amount: Number(e.target.value) })} className="h-11 rounded-xl bg-soft font-black text-rose-600" /></Field>
                <Field label="السلف"><Input type="number" min={0} value={editData.advance_amount} onChange={(e) => setEditData({ ...editData, advance_amount: Number(e.target.value) })} className="h-11 rounded-xl bg-soft font-black text-rose-600" /></Field>
                <Field label="طريقة الدفع">
                  <Select value={editData.payment_method} onValueChange={(v) => setEditData({ ...editData, payment_method: v })}>
                    <SelectTrigger className="h-11 rounded-xl bg-soft font-black"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">نقدي</SelectItem><SelectItem value="card">بطاقة</SelectItem><SelectItem value="bank_transfer">تحويل بنكي</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="ملاحظات"><textarea rows={2} value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} className="w-full rounded-xl border border-border bg-soft p-3 text-sm font-bold outline-none resize-none focus:border-primary" placeholder="سبب التعديل..." /></Field>
              {toNumber(editData.deduction_amount) + toNumber(editData.advance_amount) > toNumber(editData.base_salary) + toNumber(editData.commission_amount) + toNumber(editData.bonus_amount) && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 flex items-center gap-2"><AlertCircle size={14} /> الاستقطاعات تتجاوز الاستحقاقات — سيُمنع الحفظ</div>
              )}
              <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
                <span className="text-[10px] font-black text-white/60 uppercase">الصافي الجديد</span><span className="text-xl font-black tabular-nums">{formatCurrency(editedNetSalary)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="p-4 border-t border-border bg-soft/20 gap-2 shrink-0">
            <Button variant="outline" onClick={closeEditModal} className="flex-1 h-11 rounded-xl font-black">إلغاء</Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit || toNumber(editData.deduction_amount) + toNumber(editData.advance_amount) > toNumber(editData.base_salary) + toNumber(editData.commission_amount) + toNumber(editData.bonus_amount)} className="flex-1 h-11 rounded-xl bg-primary text-white font-black">{isSavingEdit ? "جاري الحفظ..." : "اعتماد"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="max-w-md rounded-[1.5rem] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-6 bg-emerald-600 text-white">
            <DialogTitle className="text-lg font-black flex items-center gap-2"><Banknote size={18} /> صرف المستحقات</DialogTitle>
            <DialogDescription className="text-white/80 text-xs font-bold">سينشئ مصروف رواتب ويخصم من الخزنة</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {selectedRecord && <div className="rounded-2xl border bg-soft p-4 space-y-2"><div className="flex justify-between text-sm"><span className="font-bold text-muted">الموظف</span><span className="font-black">{String(selectedRecord.employee_name_snapshot || "—")}</span></div><div className="flex justify-between items-center"><span className="text-xs font-bold text-muted">الصافي</span><span className="text-lg font-black text-emerald-600 tabular-nums">{formatCurrency(selectedRecord.net_salary)}</span></div></div>}
            <div className="space-y-1.5"><label className="text-[10px] font-black text-muted uppercase">طريقة الصرف</label>
              <Select value={payData.payment_method} onValueChange={(v) => setPayData({ ...payData, payment_method: v })}><SelectTrigger className="h-11 rounded-xl bg-soft font-black"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">نقدي</SelectItem><SelectItem value="card">بطاقة</SelectItem><SelectItem value="bank_transfer">تحويل بنكي</SelectItem></SelectContent></Select>
            </div>
          </div>
          <DialogFooter className="p-4 border-t flex gap-2">
            <Button variant="outline" onClick={() => setIsPayModalOpen(false)} className="flex-1 h-11 rounded-xl">إغلاق</Button>
            <Button onClick={handlePay} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-black">تأكيد الصرف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdvanceModalOpen} onOpenChange={setIsAdvanceModalOpen}>
        <DialogContent className="max-w-lg rounded-[1.5rem] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-6 bg-rose-600 text-white">
            <DialogTitle className="text-lg font-black flex items-center gap-2"><MinusCircle size={18} /> تسجيل سلفة</DialogTitle>
            <DialogDescription className="text-white/70 text-xs font-bold">ستُخصم تلقائياً من الراتب القادم</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <Field label="الموظف">
              <Select value={String(advanceData.employee_id)} onValueChange={(v) => setAdvanceData({ ...advanceData, employee_id: v })}>
                <SelectTrigger className="h-11 rounded-xl bg-soft font-black"><SelectValue placeholder="اختر موظف..." /></SelectTrigger>
                <SelectContent>{employees.map((emp) => <SelectItem key={String(emp.id)} value={String(emp.id)}>{String(emp.full_name || emp.fullName || "—")} ({String(emp.job_title || (emp as unknown as { jobTitle?: string }).jobTitle || "")})</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="المبلغ"><Input type="number" min={1} value={advanceData.amount} onChange={(e) => setAdvanceData({ ...advanceData, amount: e.target.value })} className="h-11 rounded-xl bg-soft font-black text-lg" placeholder="0.00" /></Field>
            <Field label="تاريخ السلفة"><Input type="date" value={advanceData.advance_date} onChange={(e) => setAdvanceData({ ...advanceData, advance_date: e.target.value })} className="h-11 rounded-xl bg-soft font-black" /></Field>
            <Field label="البيان"><textarea rows={2} value={advanceData.description} onChange={(e) => setAdvanceData({ ...advanceData, description: e.target.value })} className="w-full rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none" placeholder="سبب السلفة..." /></Field>
          </div>
          <DialogFooter className="p-4 border-t">
            <Button onClick={handleCreateAdvance} disabled={isSavingAdvance || !advanceData.employee_id || toNumber(advanceData.amount) <= 0} className="w-full h-11 rounded-xl bg-rose-600 text-white font-black">{isSavingAdvance ? "جاري الحفظ..." : "اعتماد السلفة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExpectedModalOpen} onOpenChange={setIsExpectedModalOpen}>
        <DialogContent className="max-w-lg rounded-[1.5rem] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="bg-sky-600 p-6 text-white">
            <DialogTitle className="text-lg font-black flex items-center gap-2"><ShieldCheck size={16} /> تحليل الانضباط</DialogTitle>
            <DialogDescription className="text-white/70 text-xs font-bold">تأثير الحضور على الحوافز</DialogDescription>
          </DialogHeader>
          {expectedData && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft p-4 border"><div className="text-[10px] font-black text-muted uppercase">نسبة الحضور</div><div className="text-2xl font-black">{expectedData.metrics?.attendance_percent ?? 0}%</div></div>
                <div className="rounded-2xl bg-soft p-4 border"><div className="text-[10px] font-black text-muted uppercase">الغياب</div><div className="text-2xl font-black text-rose-600">{expectedData.metrics?.missed_days ?? 0} يوم</div></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100"><span className="text-sm font-bold text-emerald-800">مكافأة حضور</span><span className="font-black text-emerald-600 tabular-nums">+{formatCurrency(expectedData.attendance_bonus ?? 0)}</span></div>
                <div className="flex justify-between p-3 rounded-xl bg-sky-50 border border-sky-100"><span className="text-sm font-bold text-sky-800">حافز انضباط</span><span className="font-black text-sky-600 tabular-nums">+{formatCurrency(expectedData.discipline_bonus ?? 0)}</span></div>
                <div className="flex justify-between p-3 rounded-xl bg-rose-50 border border-rose-100"><span className="text-sm font-bold text-rose-800">خصم غياب</span><span className="font-black text-rose-600 tabular-nums">-{formatCurrency(expectedData.auto_deduction ?? 0)}</span></div>
              </div>
              <div className="rounded-2xl bg-slate-900 text-white p-4 flex justify-between items-center"><span className="text-xs font-bold text-white/60">الصافي المتوقع</span><span className="text-xl font-black tabular-nums">{formatCurrency(expectedData.net_salary ?? 0)}</span></div>
            </div>
          )}
          <DialogFooter className="p-4"><Button variant="outline" onClick={() => setIsExpectedModalOpen(false)} className="h-11 w-full rounded-xl font-black">إغلاق</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; variant: "success" | "danger" | "info" | "secondary" | "warning" }> = { paid: { label: "تم الصرف", variant: "success" }, cancelled: { label: "ملغي", variant: "danger" }, audited: { label: "مدقق", variant: "info" }, calculated: { label: "محسوب", variant: "secondary" } };
  const cur = cfg[status] || { label: status || "غير معروف", variant: "secondary" as const };
  return <Badge variant={cur.variant} className="h-6 px-3 rounded-full font-black text-[10px]">{cur.label}</Badge>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</span>{children}</label>; }
