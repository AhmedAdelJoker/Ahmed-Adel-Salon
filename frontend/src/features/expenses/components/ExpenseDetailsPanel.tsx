import { FileText, Clock, Calendar, Wallet, ShieldCheck, ArrowUpRight, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";
import { CurrencyText, DateText } from "@/components/shared/DisplayComponents";
import { PAYMENT_METHODS, CATEGORY_COLORS } from "@/features/expenses/constants";
import type { ExpenseRecord } from "@/types/expenses";
import {
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpenseDetailsPanelProps {
  viewItem: ExpenseRecord | null;
  isOwner: boolean;
  onClose: () => void;
  onEdit: (item: ExpenseRecord) => void;
  onNavigate: (href: string) => void;
}

export function ExpenseDetailsPanel({
  viewItem,
  isOwner,
  onClose,
  onEdit,
  onNavigate,
}: ExpenseDetailsPanelProps) {
  const createdBy = (viewItem?.created_by as Record<string, unknown>) || {};
  const createdByUser = (viewItem?.created_by_user as Record<string, unknown>) || {};
  const creatorName = String(createdBy.full_name || createdByUser.full_name || createdBy.username || "غير معروف");
  const creatorRole = String(createdBy.role || createdByUser.role || "موظف");
  const creatorInitial = String(((createdBy.full_name as string) || (createdByUser.full_name as string) || viewItem?.recipient_name || "؟")[0]);
  const roleUpper = creatorRole.toUpperCase();

  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
              <FileText size={22} />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white leading-tight">{viewItem?.title || "تفاصيل المصروف"}</DialogTitle>
              <DialogDescription className="text-xs font-bold text-slate-300">عرض قراءة فقط • غير قابل للتعديل</DialogDescription>
            </div>
          </div>
          <Badge className={cn("rounded-full px-3 py-1 text-[10px] font-black border-0 shrink-0", viewItem?.status === "approved" ? "bg-emerald-500" : viewItem?.status === "pending_audit" ? "bg-amber-500" : "bg-rose-500")}>
            {viewItem?.status === "approved" ? "معتمد" : viewItem?.status === "pending_audit" ? "بانتظار" : viewItem?.status || "مسجل"}
          </Badge>
        </div>
      </div>
      {viewItem ? (
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Creator */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">
              {creatorInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-main truncate">
                {creatorName}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("h-5 rounded-full px-2 text-[9px] font-black border-0", roleUpper === "OWNER" ? "bg-blue-600 text-white" : roleUpper === "MANAGER" ? "bg-violet-600 text-white" : "bg-sky-600 text-white")}>
                  {creatorRole}
                </Badge>
                <span className="text-[11px] font-bold text-muted flex items-center gap-1"><Clock size={10} /><DateText value={viewItem.created_at as string} /></span>
              </div>
            </div>
            <div className="text-[10px] font-black text-muted">المنشئ</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-soft border border-border p-4 min-w-0">
              <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">المبلغ</div>
              <div className="text-lg font-black text-slate-900 truncate"><CurrencyText value={viewItem.amount} /></div>
              <div className="text-[11px] font-bold text-muted truncate">{PAYMENT_METHODS.find((m) => m.value === viewItem.payment_method)?.label}</div>
            </div>
            <div className="rounded-2xl bg-soft border border-border p-4">
              <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">التصنيف</div>
              <div className="text-sm font-black text-main flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs" style={{ backgroundColor: CATEGORY_COLORS[viewItem.category ?? ""] || "#6b7280" }}>{String(viewItem.category || "?")[0]}</span>
                {String(viewItem.category || "—")}
              </div>
              {viewItem.recipient_name ? <div className="text-[11px] font-bold text-muted mt-1 truncate">المستفيد: {String(viewItem.recipient_name)}</div> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-card border border-border p-3 min-w-0">
              <div className="text-[9px] font-black text-muted uppercase">التاريخ</div>
              <div className="font-black text-main mt-1 flex items-center gap-1.5"><Calendar size={12} /><DateText value={viewItem.expense_date as string} /></div>
            </div>
            <div className="rounded-xl bg-card border border-border p-3">
              <div className="text-[9px] font-black text-muted uppercase">طريقة الدفع</div>
              <div className="font-black text-main mt-1">{PAYMENT_METHODS.find((m) => m.value === viewItem.payment_method)?.label || String(viewItem.payment_method || "—")}</div>
            </div>
          </div>

          {/* Reference + Cashbox linkage */}
          {(viewItem.reference_type || viewItem.reference_id) && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
              <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><ArrowUpRight size={12} /> مرتبط بـ</div>
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-600 text-white rounded-full text-[10px] font-black">{String(viewItem.reference_type)}</Badge>
                <span className="font-black text-sm">#{String(viewItem.reference_id)}</span>
                <button onClick={() => {
                  const t = String(viewItem.reference_type);
                  const id = String(viewItem.reference_id);
                  if (t === "payroll") onNavigate(`/owner/payroll?employeeId=${id}`);
                  else if (t === "invoice") onNavigate(`/invoices`);
                  else if (t === "product") onNavigate(`/inventory`);
                  else if (t === "booking") onNavigate(`/bookings`);
                }} className="mr-auto text-xs font-black text-indigo-600 hover:underline">فتح المرجع</button>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border bg-soft/30 p-3 flex items-center gap-2">
            <Wallet size={14} className="text-muted" />
            <span className="text-xs font-bold text-muted">حركة الخزنة:</span>
            <span className="font-black text-xs">EXP-{String(viewItem.id)}</span>
            <button onClick={() => onNavigate("/owner/cashbox")} className="mr-auto text-xs font-black text-primary hover:underline">عرض في الخزنة</button>
          </div>

          {viewItem.description ? (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest">الوصف العام</div>
              <div className="rounded-2xl border border-border bg-soft/50 p-4">
                <p className="text-sm font-bold leading-relaxed text-main whitespace-pre-wrap">{String(viewItem.description)}</p>
              </div>
            </div>
          ) : null}
          {viewItem.internal_notes ? (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={12} /> ملاحظات داخلية (للمالك)</div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold leading-relaxed text-amber-900 whitespace-pre-wrap">{String(viewItem.internal_notes)}</p>
              </div>
            </div>
          ) : null}
          {viewItem.invoice_image_url ? (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest">صورة الفاتورة</div>
              <a href={String(viewItem.invoice_image_url).startsWith("http") ? String(viewItem.invoice_image_url) : `${staticURL}${String(viewItem.invoice_image_url)}`} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border border-border hover:opacity-90 transition-opacity">
                <img src={String(viewItem.invoice_image_url).startsWith("http") ? String(viewItem.invoice_image_url) : `${staticURL}${String(viewItem.invoice_image_url)}`} alt="فاتورة" className="w-full max-h-64 object-contain bg-soft" />
              </a>
            </div>
          ) : null}
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0"><Eye size={14} /></div>
            <p className="text-[11px] font-bold leading-relaxed text-amber-800">هذا العرض للقراءة فقط. للتعديل استخدم زر <b>تعديل</b> وصلاحية المالك مطلوبة.</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 h-11 rounded-xl font-black" onClick={onClose}>إغلاق</Button>
            {isOwner && <Button className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-black" onClick={() => { onClose(); onEdit(viewItem); }}>تعديل <FileText size={14} className="mr-2" /></Button>}
          </div>
        </div>
      ) : null}
    </>
  );
}
