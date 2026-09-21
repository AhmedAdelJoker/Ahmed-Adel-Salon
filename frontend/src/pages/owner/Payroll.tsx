import { usePayroll, MONTHS, toNumber, formatSignedPct, PeriodChartPanel, StaffSnapshot, PayrollTable, PayrollModals } from "@/features/payroll";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import exportService from "@/services/exportService";
import {
  Archive,
  Banknote,
  FileSpreadsheet,
  MinusCircle,
  RefreshCw,
  Trash2,
  Clock,
  ArrowUpRight,
  Wallet,
  Building2,
  Printer,
  CheckSquare,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn, formatCurrency } from "@/lib/core/utils";
import { PageHeader, PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { CurrencyStatCard, StatCard as DisplayStatCard } from "@/components/shared/DisplayComponents";
import { Badge } from "@/components/ui/badge";

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
    // Phase 2: pagination
    page,
    setPage,
    size,
    totalCount,
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
      <div className="erp-page-container space-y-6 pb-10">
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
    <div className="erp-page-container space-y-6 pb-10">
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

      <PeriodChartPanel
        period={period}
        setPeriod={setPeriod}
        summary={summary}
        paidPct={paidPct}
        pieData={pieData}
        pieTotal={pieTotal}
        growth={growth}
        prevLabel={prevLabel}
      />

      {employeeIdFilter && (
        <PremiumCard className="flex flex-col gap-3 border-primary/20 bg-primary-soft/40 p-4 sm:flex-row sm:items-center justify-between" animate={false}>
          <div><div className="text-[10px] font-black uppercase text-primary">فلترة موظف</div><div className="font-black text-main">{employeeNameFilter || `موظف #${employeeIdFilter}`}</div></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/owner/hr?employeeId=${employeeIdFilter}`)} className="rounded-xl font-black">ملف الموظف</Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/owner/payroll")} className="rounded-xl font-black">إلغاء الفلترة</Button>
          </div>
        </PremiumCard>
      )}

      <StaffSnapshot
        employees={employees}
        rawRows={rawRows}
        employeeIdFilter={employeeIdFilter}
        showAllStaff={showAllStaff}
        setShowAllStaff={setShowAllStaff}
        navigate={navigate}
      />

      <PayrollTable
        filteredRows={filteredRows}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortKey={sortKey}
        setSortKey={setSortKey}
        sortDir={sortDir}
        setSortDir={setSortDir}
        selectedIds={selectedIds}
        selectableRows={selectableRows}
        allSelected={allSelected}
        toggleSelect={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        payData={payData}
        setPayData={setPayData}
        handleBulkPay={handleBulkPay}
        bulkPaying={bulkPaying}
        setSelectedRecord={setSelectedRecord}
        setIsPayModalOpen={setIsPayModalOpen}
        openEditModal={openEditModal}
        setCancelId={setCancelId}
        fetchExpectedNet={fetchExpectedNet}
        period={period}
      />

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

      {/* Phase 2: unified pagination — reads X-Total-Count header */}
      {totalCount > 0 && (() => {
        const paginator = createPaginationState({
          page,
          size,
          total: totalCount,
        });
        return (
          <PremiumCard className="p-3">
            <Pagination
              paginator={paginator}
              onPageChange={setPage}
              showSizeChanger={false}
              locale="ar"
            />
            <p className="mt-1 text-center text-[10px] font-bold text-muted">
              صفحة {page} • {totalCount} سجل إجمالي
            </p>
          </PremiumCard>
        );
      })()}

      <PayrollModals
        isEditModalOpen={isEditModalOpen}
        closeEditModal={closeEditModal}
        editingRecord={editingRecord}
        editData={editData}
        setEditData={setEditData}
        editedNetSalary={editedNetSalary}
        handleSaveEdit={handleSaveEdit}
        isSavingEdit={isSavingEdit}
        isPayModalOpen={isPayModalOpen}
        setIsPayModalOpen={setIsPayModalOpen}
        selectedRecord={selectedRecord}
        payData={payData}
        setPayData={setPayData}
        handlePay={handlePay}
        isAdvanceModalOpen={isAdvanceModalOpen}
        setIsAdvanceModalOpen={setIsAdvanceModalOpen}
        advanceData={advanceData}
        setAdvanceData={setAdvanceData}
        employees={employees}
        handleCreateAdvance={handleCreateAdvance}
        isSavingAdvance={isSavingAdvance}
        isExpectedModalOpen={isExpectedModalOpen}
        setIsExpectedModalOpen={setIsExpectedModalOpen}
        expectedData={expectedData}
      />
    </div>
  );
}
