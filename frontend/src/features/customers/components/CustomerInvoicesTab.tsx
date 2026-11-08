/** Customers CustomerInvoicesTab (moved from CustomerDetail page, no logic changes). */
import { Eye, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/core/utils";
import { getInvoiceStatusConfig } from "@/features/customers/utils/customer";
import { EmptyState } from "@/components/shared/EmptyState";
import { TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

export default function CustomerInvoicesTab({
  invoices,
  loading,
  onViewInvoice,
}: {
  invoices: any[];
  loading: boolean;
  /** When provided, every row gets a details button. The dialog itself lives
   * on the page: `InvoiceDetailsDialog` belongs to the invoices feature's
   * public API, and pages may import cross-feature barrels. */
  onViewInvoice?: (invoice: (typeof invoices)[number]) => void;
}) {
  const { t, i18n } = useTranslation("customers");
  const dateLocale = i18n.language.startsWith("ar") ? "ar-EG" : "en-GB";

  return (
          <TabsContent value="invoices" className="mt-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <EmptyState variant="inline"
                icon={Receipt}
                title={t("invoices.noInvoices")}
                message={t("invoices.emptyMessage")}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[500px] text-end">
                  <thead>
                    <tr className="border-b border-border bg-soft/50">
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        {t("invoices.tableInvoice")}
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        {t("invoices.tableDate")}
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        {t("invoices.tableAmount")}
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        {t("invoices.tableStatus")}
                      </th>
                      {onViewInvoice && (
                        <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                          <span className="sr-only">{t("invoices.actions")}</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {invoices.map((inv) => {
                      const conf = getInvoiceStatusConfig(inv);
                      return (
                        <tr key={inv.id} className="hover:bg-soft/30">
                          <td className="px-3 py-2 text-xs font-black text-main">
                            {inv.invoice_no || `#${inv.id}`}
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-muted">
                            {new Date(inv.created_at).toLocaleDateString(
                              dateLocale,
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs font-black text-emerald-600">
                            {formatCurrency(inv.total_amount)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "text-[9px] font-black px-2 py-1 rounded-lg",
                                conf.bg,
                                conf.color,
                              )}
                            >
                              {t(conf.label)}
                            </span>
                          </td>
                          {onViewInvoice && (
                            <td className="px-3 py-2">
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                title={t("invoices.details")}
                                aria-label={t("invoices.details")}
                                onClick={() => onViewInvoice(inv)}
                              >
                                <Eye size={15} />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
  );
}
