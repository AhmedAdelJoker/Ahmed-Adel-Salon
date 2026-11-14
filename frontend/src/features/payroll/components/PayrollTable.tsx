import { cn, formatCurrency } from "@/lib/core/utils";
import { toNumber } from "@/features/payroll";
import { useTranslation } from "react-i18next";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import exportService from "@/services/exportService";
import { AlertCircle, CheckSquare, ChevronDown, ChevronUp, FileSpreadsheet, LayoutGrid, List as ListIcon, MoreVertical, Pencil, Search, ShieldCheck, Square, Trash2 } from "lucide-react";
import type { PayrollRecord, Period, PayData } from "@/types/payroll";

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("owner");
  const cfg: Record<string, { label: string; variant: "success" | "danger" | "info" | "secondary" | "warning" }> = { paid: { label: t("payroll.statusPaidLong"), variant: "success" }, cancelled: { label: t("payroll.statusCancelledShort"), variant: "danger" }, audited: { label: t("payroll.statusAuditedLong"), variant: "info" }, calculated: { label: t("payroll.statusCalculatedBadge"), variant: "secondary" } };
  const cur = cfg[status] || { label: status || t("payroll.unknownStatus"), variant: "secondary" as const };
  return <Badge variant={cur.variant} className="h-6 px-3 rounded-full font-black text-[10px]">{cur.label}</Badge>;
}

type PayrollTableProps = {
  filteredRows: PayrollRecord[];
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  viewMode: "table" | "grid";
  setViewMode: React.Dispatch<React.SetStateAction<"table" | "grid">>;
  sortKey: "net" | "name" | "base";
  setSortKey: React.Dispatch<React.SetStateAction<"net" | "name" | "base">>;
  sortDir: "asc" | "desc";
  setSortDir: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  selectedIds: Set<string>;
  selectableRows: PayrollRecord[];
  allSelected: boolean;
  toggleSelect: (id: string | number) => void;
  toggleSelectAll: () => void;
  payData: PayData;
  setPayData: React.Dispatch<React.SetStateAction<PayData>>;
  handleBulkPay: () => Promise<void>;
  bulkPaying: boolean;
  setSelectedRecord: React.Dispatch<React.SetStateAction<PayrollRecord | null>>;
  setIsPayModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openEditModal: (row: PayrollRecord) => void;
  setCancelId: React.Dispatch<React.SetStateAction<number | string | null>>;
  fetchExpectedNet: (empId: number | string) => Promise<void>;
  period: Period;
};

export default function PayrollTable({
  filteredRows,
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  selectedIds,
  selectableRows,
  allSelected,
  toggleSelect,
  toggleSelectAll,
  payData,
  setPayData,
  handleBulkPay,
  bulkPaying,
  setSelectedRecord,
  setIsPayModalOpen,
  openEditModal,
  setCancelId,
  fetchExpectedNet,
  period,
}: PayrollTableProps) {
  const { t } = useTranslation("owner");
  return (
    <PremiumCard noPadding className="overflow-hidden print:shadow-none">
      <div className="p-4 sm:p-5 border-b border-border bg-soft/30 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2">{t("payroll.tableTitle")} <Badge className="bg-primary text-white rounded-full">{filteredRows.length}</Badge></h2>
            <p className="text-xs font-bold text-muted">{t("payroll.tableHint", { sortBy: sortKey === "net" ? t("payroll.netLabel") : sortKey === "name" ? t("payroll.nameLabel") : t("payroll.baseLabel"), dir: sortDir === "desc" ? "↓" : "↑" })}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t("payroll.searchPlaceholderName")} className="h-10 pe-9 rounded-xl bg-card border-border font-bold text-sm" />
            </div>
            <div className="flex bg-soft border border-border p-1 rounded-xl shrink-0">
              <button onClick={() => setViewMode("table")} className={cn("h-8 w-8 rounded-lg flex items-center justify-center", viewMode === "table" ? "bg-card shadow border border-border text-slate-900" : "text-muted")} aria-label={t("payroll.viewTable")}><ListIcon size={14} /></button>
              <button onClick={() => setViewMode("grid")} className={cn("h-8 w-8 rounded-lg flex items-center justify-center", viewMode === "grid" ? "bg-card shadow border border-border text-slate-900" : "text-muted")} aria-label={t("payroll.viewGrid")}><LayoutGrid size={14} /></button>
            </div>
          </div>
        </div>
        {selectableRows.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 print:hidden">
            <label className="flex items-center gap-2 text-sm font-black cursor-pointer">
              <button onClick={toggleSelectAll} className="h-8 w-8 rounded-lg border bg-white flex items-center justify-center">
                {allSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted" />}
              </button>
              {t("payroll.selectAllPayable", { count: selectableRows.length, selected: selectedIds.size })}
            </label>
            <div className="flex gap-2">
              <Select value={payData.payment_method} onValueChange={(v) => setPayData({ ...payData, payment_method: v })}>
                <SelectTrigger className="h-9 rounded-xl bg-white font-black text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">{t("payroll.tblCash")}</SelectItem><SelectItem value="card">{t("payroll.tblCard")}</SelectItem><SelectItem value="bank_transfer">{t("payroll.tblBank")}</SelectItem></SelectContent>
              </Select>
              <Button onClick={handleBulkPay} disabled={selectedIds.size === 0 || bulkPaying} className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4">
                {bulkPaying ? t("payroll.bulkPayingLabel") : t("payroll.bulkPayLabel", { count: selectedIds.size })}
              </Button>
            </div>
          </div>
        )}
      </div>

      {viewMode === "table" ? (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-start min-w-[980px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-soft/70 backdrop-blur">
                <th className="px-3 py-3 text-center w-10">
                  <button onClick={toggleSelectAll} className="h-8 w-8 rounded-lg border bg-card flex items-center justify-center mx-auto">
                    {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">
                  <button onClick={() => { if (sortKey === "name") setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey("name"); setSortDir("asc"); } }} className="flex items-center gap-1">{t("payroll.tblEmployee")} {sortKey === "name" ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}</button>
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-muted">
                  <button onClick={() => { if (sortKey === "base") setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey("base"); setSortDir("desc"); } }} className="flex items-center gap-1">{t("payroll.baseLabel")} {sortKey === "base" ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}</button>
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-muted">{t("payroll.commissionHeader")}</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-center">{t("payroll.extrasHeader")}</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-center">{t("payroll.deductionsHeader")}</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-center">
                  <button onClick={() => { if (sortKey === "net") setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey("net"); setSortDir("desc"); } }} className="flex items-center gap-1 mx-auto">{t("payroll.netLabel")} {sortKey === "net" ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}</button>
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-center">{t("payroll.statusHeader")}</th>
                <th className="px-4 py-4 text-center text-[10px] font-black uppercase text-muted print:hidden">{t("payroll.actionHeader")}</th>
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
                        {canPay && <Button size="sm" onClick={() => { setSelectedRecord(row); setIsPayModalOpen(true); }} className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-3">{t("payroll.payButton")}</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 rounded-xl"><MoreVertical size={14} /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                            <DropdownMenuItem onClick={() => exportService.downloadPdf(`/exports/payroll/${row.id}/pdf`, `payslip_${row.employee_name_snapshot}`)} className="font-bold text-xs"><FileSpreadsheet size={12} className="ms-2" /> PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => fetchExpectedNet(row.employee_id as string | number || row.employeeId as string | number)} className="font-bold text-xs"><ShieldCheck size={12} className="ms-2" /> {t("payroll.disciplineReport")}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(row)} className="font-bold text-xs"><Pencil size={12} className="ms-2" /> {t("payroll.manualEdit")}</DropdownMenuItem>
                            {String(row.status) !== "cancelled" && <DropdownMenuItem onClick={() => setCancelId(row.id as number | string)} className="font-bold text-xs text-rose-600"><Trash2 size={12} className="ms-2" /> {t("payroll.cancelRecord")}</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && <tr><td colSpan={9} className="py-16 text-center"><div className="flex flex-col items-center gap-2 text-muted"><AlertCircle size={32} /><p className="font-black">{t("payroll.noRecords")}</p><p className="text-xs font-bold">{t("payroll.noRecordsHint", { period: `${t(`payroll.months.m${period.month}`)} ${period.year}` })}</p></div></td></tr>}
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
                  <div className="rounded-xl bg-soft p-2"><div className="text-[9px] font-black text-muted uppercase">{t("payroll.baseLabel")}</div><div className="font-black">{formatCurrency(row.base_salary)}</div></div>
                  <div className="rounded-xl bg-sky-50 p-2"><div className="text-[9px] font-black text-muted uppercase">{t("payroll.commissionHeader")}</div><div className="font-black text-sky-600">{formatCurrency(row.commission_amount)}</div></div>
                  <div className="rounded-xl bg-emerald-50 p-2"><div className="text-[9px] font-black text-muted uppercase">{t("payroll.extrasHeader")}</div><div className="font-black text-emerald-600">+{formatCurrency(row.bonus_amount)}</div></div>
                  <div className="rounded-xl bg-rose-50 p-2"><div className="text-[9px] font-black text-muted uppercase">{t("payroll.deductionsHeader")}</div><div className="font-black text-rose-600">-{formatCurrency(toNumber(row.deduction_amount) + toNumber(row.advance_amount))}</div></div>
                </div>
                <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl p-3">
                  <span className="text-[10px] font-black text-white/60 uppercase">{t("payroll.netLabel")}</span><span className="font-black">{formatCurrency(row.net_salary)}</span>
                </div>
                <div className="flex gap-2">
                  {canPay && <Button onClick={() => { setSelectedRecord(row); setIsPayModalOpen(true); }} className="flex-1 h-9 rounded-xl bg-emerald-600 text-white font-black text-xs">{t("payroll.payButton")}</Button>}
                  <Button variant="outline" onClick={() => openEditModal(row)} className="flex-1 h-9 rounded-xl font-black text-xs">{t("payroll.editButton")}</Button>
                </div>
              </PremiumCard>
            );
          })}
        </div>
      )}
    </PremiumCard>
  );
}

export { StatusBadge };
