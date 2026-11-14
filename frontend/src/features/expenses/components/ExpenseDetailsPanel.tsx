import { FileText, Clock, Calendar, Wallet, ShieldCheck, ArrowUpRight, Eye, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("owner");
  const createdBy = (viewItem?.created_by as Record<string, unknown>) || {};
  const createdByUser = (viewItem?.created_by_user as Record<string, unknown>) || {};
  const creatorName = String(createdBy.full_name || createdByUser.full_name || createdBy.username || t("expenses.creatorUnknown"));
  const creatorRole = String(createdBy.role || createdByUser.role || t("expenses.creatorRoleFallback"));
  const creatorInitial = String(((createdBy.full_name as string) || (createdByUser.full_name as string) || viewItem?.recipient_name || "؟")[0]);
  const roleUpper = creatorRole.toUpperCase();
  const statusBadge = viewItem?.status === "approved"
    ? { label: t("expenses.statusApproved"), cls: "bg-emerald-500" }
    : viewItem?.status === "pending_audit"
      ? { label: t("expenses.statusPending"), cls: "bg-amber-500" }
      : viewItem?.status === "rejected"
        ? { label: t("expenses.statusRejected"), cls: "bg-rose-500" }
        : { label: viewItem?.status || "—", cls: "bg-rose-500" };

  const handlePrintVoucher = () => {
    if (!viewItem) return;
    const item = viewItem;
    const escapeHtml = (v: unknown) =>
      String(v ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(t("expenses.voucherTitle"))} — EXP-${escapeHtml(item.id)}</title>
<style>
@page{size:A5 portrait;margin:10mm}
body{font-family:"Cairo","Segoe UI",Tahoma,Arial,sans-serif;color:#18181b;padding:18px;font-size:12px}
.wm{text-align:center;border-bottom:2px solid #18181b;padding-bottom:10px}
.wm .brand{font-size:20px;font-weight:900;letter-spacing:.35em}
.wm .doc{font-size:11px;font-weight:800;color:#a16207;text-transform:uppercase;letter-spacing:.2em;margin-top:2px}
.ref{display:flex;justify-content:space-between;font-family:Consolas,monospace;font-size:10px;color:#71717a;margin:10px 0;border-bottom:1px dashed #d4d4d8;padding-bottom:8px}
.amount{text-align:center;padding:18px 0;border-bottom:2px solid #18181b}
.amount .v{font-size:30px;font-weight:900}
.amount .l{font-size:9px;color:#71717a;letter-spacing:.15em;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin-top:12px}
td{padding:6px 8px;border-bottom:1px solid #e4e4e7;font-size:11px}
td:first-child{color:#71717a;font-weight:800;width:35%}
.foot{text-align:center;font-size:9px;color:#71717a;margin-top:16px;border-top:1px dashed #d4d4d8;padding-top:10px}
@media print{body{padding:0}}
</style></head><body>
<div class="wm"><div class="brand">SALONPRO</div><div class="doc">${escapeHtml(t("expenses.voucherTitle"))}</div></div>
<div class="ref"><span>${escapeHtml(t("expenses.voucherRef"))}: EXP-${escapeHtml(item.id)}</span><span>${escapeHtml(new Date(String(item.created_at || item.expense_date || Date.now())).toLocaleString("ar-EG"))}</span></div>
<div class="amount"><div class="l">${escapeHtml(t("expenses.voucherAmount"))}</div><div class="v">${escapeHtml(formatCurrency(item.amount))}</div></div>
<table><tbody>
<tr><td>${escapeHtml(t("expenses.fieldTitle").replace(" *", ""))}</td><td>${escapeHtml(item.title)}</td></tr>
<tr><td>${escapeHtml(t("expenses.voucherCategory"))}</td><td>${escapeHtml(item.category)}</td></tr>
<tr><td>${escapeHtml(t("expenses.voucherMethod"))}</td><td>${escapeHtml(PAYMENT_METHODS.find((m) => m.value === item.payment_method)?.label || item.payment_method)}</td></tr>
<tr><td>${escapeHtml(t("expenses.voucherDate"))}</td><td>${escapeHtml(new Date(String(item.expense_date || Date.now())).toLocaleString("ar-EG"))}</td></tr>
<tr><td>${escapeHtml(t("expenses.voucherStatus"))}</td><td>${escapeHtml(statusBadge.label)}</td></tr>
${item.recipient_name ? `<tr><td>${escapeHtml(t("expenses.fieldRecipient").replace(/ \*$/, ""))}</td><td>${escapeHtml(item.recipient_name)}</td></tr>` : ""}
</tbody></table>
<div class="foot">${escapeHtml(t("expenses.voucherFooter"))}</div>
</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    try {
      const d = iframe.contentWindow?.document;
      if (!d) throw new Error("iframe unavailable");
      d.open();
      d.write(html);
      d.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 2000);
    } catch {
      iframe.remove();
    }
  };

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
              <DialogTitle className="text-lg font-black text-white leading-tight">{viewItem?.title || t("expenses.detailsTitleFallback")}</DialogTitle>
              <DialogDescription className="text-xs font-bold text-slate-300">{t("expenses.readOnlyNotice")}</DialogDescription>
            </div>
          </div>
          <Badge className={cn("rounded-full px-3 py-1 text-[10px] font-black border-0 shrink-0", statusBadge.cls)}>
            {statusBadge.label}
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
            <div className="text-[10px] font-black text-muted">{t("expenses.creatorLabel")}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-soft border border-border p-4 min-w-0">
              <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">{t("expenses.amountLabel")}</div>
              <div className="text-lg font-black text-slate-900 truncate"><CurrencyText value={viewItem.amount} /></div>
              <div className="text-[11px] font-bold text-muted truncate">{PAYMENT_METHODS.find((m) => m.value === viewItem.payment_method)?.label}</div>
            </div>
            <div className="rounded-2xl bg-soft border border-border p-4">
              <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">{t("expenses.categoryLabel")}</div>
              <div className="text-sm font-black text-main flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs" style={{ backgroundColor: CATEGORY_COLORS[viewItem.category ?? ""] || "var(--text-muted)" }}>{String(viewItem.category || "?")[0]}</span>
                {String(viewItem.category || "—")}
              </div>
              {viewItem.recipient_name ? <div className="text-[11px] font-bold text-muted mt-1 truncate">{t("expenses.recipientLabel")} {String(viewItem.recipient_name)}</div> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-card border border-border p-3 min-w-0">
              <div className="text-[9px] font-black text-muted uppercase">{t("expenses.dateLabel")}</div>
              <div className="font-black text-main mt-1 flex items-center gap-1.5"><Calendar size={12} /><DateText value={viewItem.expense_date as string} /></div>
            </div>
            <div className="rounded-xl bg-card border border-border p-3">
              <div className="text-[9px] font-black text-muted uppercase">{t("expenses.paymentMethodLabel")}</div>
              <div className="font-black text-main mt-1">{PAYMENT_METHODS.find((m) => m.value === viewItem.payment_method)?.label || String(viewItem.payment_method || "—")}</div>
            </div>
          </div>

          {/* Reference + Cashbox linkage */}
          {(viewItem.reference_type || viewItem.reference_id) && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
              <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><ArrowUpRight size={12} /> {t("expenses.linkedTo")}</div>
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-600 text-white rounded-full text-[10px] font-black">{String(viewItem.reference_type)}</Badge>
                <span className="font-black text-sm">#{String(viewItem.reference_id)}</span>
                <button onClick={() => {
                  const ty = String(viewItem.reference_type);
                  const id = String(viewItem.reference_id);
                  if (ty === "payroll") onNavigate(`/owner/payroll?employeeId=${id}`);
                  else if (ty === "invoice") onNavigate(`/invoices`);
                  else if (ty === "product") onNavigate(`/inventory`);
                  else if (ty === "booking") onNavigate(`/bookings`);
                }} className="me-auto text-xs font-black text-indigo-600 hover:underline">{t("expenses.openReference")}</button>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border bg-soft/30 p-3 flex items-center gap-2">
            <Wallet size={14} className="text-muted" />
            <span className="text-xs font-bold text-muted">{t("expenses.cashboxMovement")}</span>
            <span className="font-black text-xs">EXP-{String(viewItem.id)}</span>
            <button onClick={() => onNavigate("/owner/cashbox")} className="me-auto text-xs font-black text-primary hover:underline">{t("expenses.viewInCashbox")}</button>
          </div>

          {viewItem.description ? (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.descriptionLabel")}</div>
              <div className="rounded-2xl border border-border bg-soft/50 p-4">
                <p className="text-sm font-bold leading-relaxed text-main whitespace-pre-wrap">{String(viewItem.description)}</p>
              </div>
            </div>
          ) : null}
          {viewItem.internal_notes ? (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={12} /> {t("expenses.internalNotesLabel")}</div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold leading-relaxed text-amber-900 whitespace-pre-wrap">{String(viewItem.internal_notes)}</p>
              </div>
            </div>
          ) : null}
          {viewItem.invoice_image_url ? (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest">{t("expenses.invoiceLabel")}</div>
              <a href={String(viewItem.invoice_image_url).startsWith("http") ? String(viewItem.invoice_image_url) : `${staticURL}${String(viewItem.invoice_image_url)}`} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border border-border hover:opacity-90 transition-opacity">
                <img src={String(viewItem.invoice_image_url).startsWith("http") ? String(viewItem.invoice_image_url) : `${staticURL}${String(viewItem.invoice_image_url)}`} alt="" className="w-full max-h-64 object-contain bg-soft" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </a>
            </div>
          ) : null}
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0"><Eye size={14} /></div>
            <p className="text-[11px] font-bold leading-relaxed text-amber-800">{t("expenses.readOnlyEditNote", { edit: t("expenses.edit") })}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="h-11 rounded-xl px-4 font-black" onClick={handlePrintVoucher} title={t("expenses.printVoucher")} aria-label={t("expenses.printVoucher")}>
              <Printer size={15} />
            </Button>
            <Button variant="outline" className="flex-1 h-11 rounded-xl font-black" onClick={onClose}>{t("expenses.close")}</Button>
            {isOwner && <Button className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-black" onClick={() => { onClose(); onEdit(viewItem); }}>{t("expenses.edit")} <FileText size={14} className="me-2" /></Button>}
          </div>
        </div>
      ) : null}
    </>
  );
}
