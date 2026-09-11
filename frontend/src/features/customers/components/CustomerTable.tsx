/** Customers CustomerTable (moved from Customers page, no logic changes). */
import { Eye, History, Trash2 } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/core/utils";
import { customerId, customerName, getInitials, secondPhone } from "@/features/customers/utils/customer";

export default function CustomerTable({
  rows,
  loading,
  isOwner,
  onOpenDetails,
  onNavigate,
  onDelete,
}: {
  rows: any[];
  loading: boolean;
  isOwner: boolean;
  onOpenDetails: (customer: any) => void;
  onNavigate: (id: number | string) => void;
  onDelete: (customer: any) => void;
}) {
  return (
          <div className="overflow-x-auto">
            <table className="min-w-[52rem] w-full text-right">
              <thead>
                <tr className="border-b border-black/5 bg-gray-50 dark:border-white/10 bg-soft">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    ملف العميل
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    رقم التواصل
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    الزيارات
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                    الإنفاق
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {rows.map((customer, index) => (
                  <tr
                    key={customerId(customer) || index}
                    className={`cursor-pointer transition hover:bg-purple-50/60 dark:hover:bg-cyan-400/10 ${loading ? "pointer-events-none opacity-50" : ""}`}
                    onClick={() => onOpenDetails(customer)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-sm font-black text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
                          {getInitials(customerName(customer))}
                        </div>
                        <div>
                          <div className="font-black text-gray-950 dark:text-gray-50">
                            {customerName(customer)}
                          </div>
                          <div className="text-[10px] font-bold text-gray-500">
                            #{customerId(customer) || "---"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-black" dir="ltr">
                      <div>{customer.phone || "---"}</div>
                      {secondPhone(customer) ? (
                        <div className="mt-1 text-xs text-gray-400">
                          {secondPhone(customer)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                         
                        variant={
                          (Number(
                            customer.visits_count || customer.visits || 0,
                          ) > 10
                            ? ("accent" as any)
                            : Number(
                                  customer.visits_count || customer.visits || 0,
                                ) >= 2
                              ? "info"
                              : "outline") as any
                        }
                      >
                        {customer.visits_count || customer.visits || 0} زيارة
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-emerald-600">
                      {formatCurrency(
                        customer.lifetime_spend ||
                          customer.total_spend ||
                          customer.totalSpend ||
                          0,
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="primary"
                          size="icon"
                          title="عرض التفاصيل"
                          onClick={(event) => {
                            event.stopPropagation();
                            onNavigate(customerId(customer));
                          }}
                        >
                          <Eye size={18} />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenDetails(customer);
                          }}
                        >
                          <History size={18} />
                        </Button>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(customer);
                            }}
                          >
                            <Trash2 size={18} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-8 py-16 text-center text-gray-500"
                    >
                      لا يوجد عملاء مطابقين
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
  );
}
