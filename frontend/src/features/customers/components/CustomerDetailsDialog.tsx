/** Customers CustomerDetailsDialog (moved from Customers page, no logic changes). */
import { Archive, Clock, CreditCard, FileText, History, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateTime, cn } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import CustomerMiniStat from "@/features/customers/components/CustomerMiniStat";
import { customerName, getInitials, secondPhone } from "@/features/customers/utils/customer";

export default function CustomerDetailsDialog({
  open,
  onOpenChange,
  customer,
  loading,
  onEdit,
  onClose,
  archived = false,
  onRestore,
  lastVisit,
  activityLogs = [],
  invoices = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  loading: boolean;
  onEdit?: () => void;
  onClose: () => void;
  /** Archive mode: hides editing, shows archive metadata + restore action. */
  archived?: boolean;
  onRestore?: () => void;
  /** Pre-computed last visit date string (from appointments), if available. */
  lastVisit?: string | null;
  /** Activity logs for tier change history extraction. */
  activityLogs?: any[];
  /** Invoices for extracting applied discounts/coupons. */
  invoices?: any[];
}) {
  const { t, i18n } = useTranslation("customers");
  const dateLocale = i18n.language.startsWith("ar") ? "ar-EG" : "en-GB";

  // Resolve last visit from: explicit prop > customer.last_visit > customer.last_visit_at
  // > most recent completed appointment date (sorted desc).
  const resolvedLastVisit = (() => {
    if (!customer) return null;
    if (lastVisit) return lastVisit;
    if (customer.last_visit) return customer.last_visit;
    if (customer.last_visit_at) return customer.last_visit_at;
    if (customer.appointments && customer.appointments.length > 0) {
      const completed = customer.appointments.filter((a: any) =>
        ["completed", "done", "checked_out", "paid"].includes(
          String(a.status || "").toLowerCase(),
        ),
      );
      if (completed.length > 0) {
        const sorted = [...completed].sort(
          (a: any, b: any) =>
            new Date(b.appointment_date || b.created_at || 0).getTime() -
            new Date(a.appointment_date || a.created_at || 0).getTime(),
        );
        return sorted[0].appointment_date || sorted[0].created_at;
      }
      // Fallback: most recent appointment regardless of status
      const sorted = [...customer.appointments].sort(
        (a: any, b: any) =>
          new Date(b.appointment_date || b.created_at || 0).getTime() -
          new Date(a.appointment_date || a.created_at || 0).getTime(),
      );
      return sorted[0].appointment_date || sorted[0].created_at;
    }
    return null;
  })();

  // Extract tier change history from activity logs
  const tierChangeHistory = (activityLogs || [])
    .filter((log: any) => {
      const action = String(log.action || log.description || "").toLowerCase();
      return /tier|loyalty|rank|category|vip|bronze|silver|gold/.test(action);
    })
    .map((log: any) => {
      const action = String(log.action || log.description || "");
      const tierMatch = action.match(/(bronze|silver|gold|vip)/i);
      return {
        date: log.created_at || log.date || "",
        tier: tierMatch ? tierMatch[0].charAt(0).toUpperCase() + tierMatch[0].slice(1) : "Unknown",
        changedBy: log.user_name || "النظام",
      };
    })
    .sort((a: any, b: any) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

  // Extract applied discounts from invoices
  const appliedDiscounts = (invoices || [])
    .filter((inv: any) => Number(inv.discount_amount || inv.discount || 0) > 0)
    .map((inv: any) => ({
      date: inv.created_at || inv.date || "",
      amount: Number(inv.discount_amount || inv.discount || 0),
      type: inv.discount_type || "percentage",
      invoiceNo: inv.invoice_no || `#${inv.id}`,
    }))
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("details.title")}
            </DialogTitle>
            <DialogDescription>
              {archived ? t("details.archivedDescription") : t("details.description")}
            </DialogDescription>
          </DialogHeader>
          {customer ? (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
              <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-5 bg-soft">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground">
                  {getInitials(customerName(customer))}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-950 dark:text-gray-50">
                    {customerName(customer)}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-gray-500" dir="ltr">
                    {customer.phone || t("table.idFallback")}
                  </p>
                  {secondPhone(customer) ? (
                    <p
                      className="mt-1 text-xs font-bold text-gray-400"
                      dir="ltr"
                    >
                      {t("details.secondPhone")}: {secondPhone(customer)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <CustomerMiniStat
                  label={t("details.visits")}
                  value={`${customer.visits_count || customer.visits || 0}`}
                  icon={History}
                />
                <CustomerMiniStat
                  label={t("details.totalSpend")}
                  value={
                    formatCurrency(
                      customer.lifetime_spend ||
                        customer.total_spend ||
                        customer.totalSpend ||
                        0,
                    ) || ""
                  }
                  icon={CreditCard}
                />
                <CustomerMiniStat
                  label={t("details.lastVisit")}
                  value={
                    resolvedLastVisit
                      ? new Date(resolvedLastVisit).toLocaleDateString(dateLocale)
                      : t("table.idFallback")
                  }
                  icon={Clock}
                />
              </div>
              {archived ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <CustomerMiniStat
                    label={t("details.archivedAt")}
                    value={
                      customer.deleted_at
                        ? formatDateTime(customer.deleted_at)
                        : "---"
                    }
                    icon={Archive}
                  />
                  <CustomerMiniStat
                    label={t("details.tier")}
                    value={t("tier." + (customer.current_tier || "bronze"))}
                  icon={ShieldCheck}
                  />
                  <CustomerMiniStat
                    label={t("details.loyaltyPoints")}
                    value={`${customer.loyalty_points || 0}`}
                    icon={History}
                  />
                </div>
              ) : null}
              {customer.email || customer.address || customer.notes ? (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4 text-sm">
                  {customer.email ? (
                    <p className="font-bold text-main" dir="ltr">
                      {customer.email}
                    </p>
                  ) : null}
                  {customer.address ? (
                    <p className="font-bold text-muted">{customer.address}</p>
                  ) : null}
                  {customer.notes ? (
                    <p className="text-xs font-bold leading-relaxed text-muted">
                      {customer.notes}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Tier Change History */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-warning" /> {t("tierHistory.title")}
                </h3>
                {tierChangeHistory.length === 0 ? (
                  <p className="text-xs font-bold text-muted text-center py-4">
                    {t("tierHistory.noHistory")}
                  </p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-soft/50">
                        <th className="px-3 py-2 text-[10px] font-black uppercase text-muted w-1/3">
                          {t("tierHistory.date")}
                        </th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase text-muted w-1/3">
                          {t("tierHistory.changedTo")}
                        </th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase text-muted w-1/3">
                          {t("tierHistory.changedBy")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {tierChangeHistory.map((change) => (
                        <tr key={change.date}>
                          <td className="px-3 py-2 text-xs font-bold text-muted">
                            {new Date(change.date).toLocaleString(dateLocale, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-main">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5",
                              change.tier === "gold" ? "bg-amber-100 text-amber-700" :
                              change.tier === "silver" ? "bg-slate-100 text-slate-700" :
                              "bg-orange-100 text-orange-700"
                            )}>
                              {change.tier}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-muted">
                            {change.changedBy || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}

          {/* Applied Discounts / Coupons */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
              <FileText size={14} className="text-emerald-600" /> {t("coupons.title")}
            </h3>
            {appliedDiscounts.length === 0 ? (
              <p className="text-xs font-bold text-muted text-center py-4">
                {t("coupons.noCoupons")}
              </p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-soft/50">
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-muted w-1/4">
                      {t("coupons.invoice")}
                    </th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-muted w-1/4">
                      {t("coupons.date")}
                    </th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-muted w-1/4">
                      {t("coupons.type")}
                    </th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-muted w-1/4 text-right">
                      {t("coupons.amount")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {appliedDiscounts.map((d: any) => (
                    <tr key={d.invoiceNo}>
                      <td className="px-3 py-2 text-xs font-bold text-muted">
                        {d.invoiceNo}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold text-muted">
                        {new Date(d.date).toLocaleDateString(dateLocale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold text-muted">
                        {t(`coupons.discountType.${d.type}`, { defaultValue: d.type })}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold text-emerald-600 text-right">
                        -{formatCurrency(d.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            {archived ? (
              <Button
                disabled={loading}
                onClick={() => onRestore?.()}
                className="gap-1.5"
                aria-label={t("details.restore")}
              >
                <RotateCcw size={16} aria-hidden="true" /> {t("details.restore")}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  customer && onEdit?.()
                }
                aria-label={t("details.edit")}
              >
                {t("details.edit")}
              </Button>
            )}
            <Button
              variant={archived ? "outline" : undefined}
              disabled={loading && !archived}
              onClick={() => onClose()}
              aria-label={t("details.ok")}
            >
              {t("details.ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}