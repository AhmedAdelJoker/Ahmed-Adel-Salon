/** Customers CustomerInvoicesTab (moved from CustomerDetail page, no logic changes). */
import { Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/core/utils";
import { getInvoiceStatusConfig } from "@/features/customers/utils/customer";
import CustomerInlineEmptyState from "@/features/customers/components/CustomerInlineEmptyState";
import { TabsContent } from "@/components/ui/tabs";

export default function CustomerInvoicesTab({
  invoices,
  loading,
}: {
  invoices: any[];
  loading: boolean;
}) {
  return (
          <TabsContent value="invoices" className="mt-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <CustomerInlineEmptyState
                icon={Receipt}
                title="لا توجد فواتير"
                description="لم يتم إصدار أي فواتير لهذا العميل"
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[500px] text-right">
                  <thead>
                    <tr className="border-b border-border bg-soft/50">
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        الفاتورة
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        التاريخ
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        المبلغ
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        الحالة
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {invoices.map((inv) => {
                      const conf = getInvoiceStatusConfig(inv.status);
                      return (
                        <tr key={inv.id} className="hover:bg-soft/30">
                          <td className="px-3 py-2 text-xs font-black text-main">
                            {inv.invoice_no || `#${inv.id}`}
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-muted">
                            {new Date(inv.created_at).toLocaleDateString(
                              "ar-EG",
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
                              {conf.label}
                            </span>
                          </td>
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
