import { formatCurrency } from "@/lib/core/utils";
import { toNumber } from "@/features/payroll";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Banknote, MinusCircle, Pencil, ShieldCheck } from "lucide-react";
import type { PayrollRecord, PayData, AdvanceData, EditData } from "@/types/payroll";
import type { EmployeeRecord } from "@/types/employee";

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</span>{children}</label>; }

type ExpectedData = {
  metrics?: { attendance_percent?: number; missed_days?: number };
  attendance_bonus?: number;
  discipline_bonus?: number;
  auto_deduction?: number;
  net_salary?: number;
} | null;

type PayrollModalsProps = {
  isEditModalOpen: boolean;
  closeEditModal: () => void;
  editingRecord: PayrollRecord | null;
  editData: EditData;
  setEditData: React.Dispatch<React.SetStateAction<EditData>>;
  editedNetSalary: number;
  handleSaveEdit: () => Promise<unknown>;
  isSavingEdit: boolean;
  isPayModalOpen: boolean;
  setIsPayModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRecord: PayrollRecord | null;
  payData: PayData;
  setPayData: React.Dispatch<React.SetStateAction<PayData>>;
  handlePay: () => Promise<unknown>;
  isAdvanceModalOpen: boolean;
  setIsAdvanceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  advanceData: AdvanceData;
  setAdvanceData: React.Dispatch<React.SetStateAction<AdvanceData>>;
  employees: EmployeeRecord[];
  handleCreateAdvance: () => Promise<unknown>;
  isSavingAdvance: boolean;
  isExpectedModalOpen: boolean;
  setIsExpectedModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  expectedData: ExpectedData;
};

export default function PayrollModals({
  isEditModalOpen,
  closeEditModal,
  editingRecord,
  editData,
  setEditData,
  editedNetSalary,
  handleSaveEdit,
  isSavingEdit,
  isPayModalOpen,
  setIsPayModalOpen,
  selectedRecord,
  payData,
  setPayData,
  handlePay,
  isAdvanceModalOpen,
  setIsAdvanceModalOpen,
  advanceData,
  setAdvanceData,
  employees,
  handleCreateAdvance,
  isSavingAdvance,
  isExpectedModalOpen,
  setIsExpectedModalOpen,
  expectedData,
}: PayrollModalsProps) {
  return (
    <>
      <Dialog open={isEditModalOpen} onOpenChange={(o) => !o && closeEditModal()}>
        <DialogContent className="max-w-3xl rounded-[1.5rem] p-0 overflow-hidden max-h-[90vh] flex flex-col">
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
        <DialogContent className="max-w-md rounded-[1.5rem] p-0 overflow-hidden">
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
        <DialogContent className="max-w-lg rounded-[1.5rem] p-0 overflow-hidden">
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
        <DialogContent className="max-w-lg rounded-[1.5rem] p-0 overflow-hidden">
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
    </>
  );
}

export { Field };
