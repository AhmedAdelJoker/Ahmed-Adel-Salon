/** Customers CustomerCards (moved from Customers page, no logic changes). */
import { motion } from "framer-motion";
import { History, Trash2 } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/core/utils";
import { customerId, customerName, getInitials } from "@/features/customers/utils/customer";

export default function CustomerCards({
  rows,
  isOwner,
  onOpenDetails,
  onDelete,
}: {
  rows: any[];
  isOwner: boolean;
  onOpenDetails: (customer: any) => void;
  onDelete: (customer: any) => void;
}) {
  return (
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((customer, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  key={customerId(customer) || index}
                  onClick={() => onOpenDetails(customer)}
                  className="group flex flex-col rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">
                        {getInitials(customerName(customer))}
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-main leading-tight">
                          {customerName(customer)}
                        </h3>
                        <p className="text-[9px] font-bold text-muted">
                          #{customerId(customer) || "---"}
                        </p>
                      </div>
                    </div>
                    <Badge
                       
                      variant={
                        (Number(customer.visits_count || customer.visits || 0) >
                        10
                          ? ("accent" as any)
                          : Number(
                                customer.visits_count || customer.visits || 0,
                              ) >= 2
                            ? "info"
                            : "outline") as any
                      }
                      className="rounded-md px-2 py-0.5 text-[8px] font-black shrink-0"
                    >
                      {customer.visits || 0}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted font-bold">الهاتف:</span>
                      <span className="font-black text-main" dir="ltr">
                        {customer.phone || "---"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted font-bold">الإنفاق:</span>
                      <span className="font-black text-success">
                        {formatCurrency(
                          customer.lifetime_spend ||
                            customer.total_spend ||
                            customer.totalSpend ||
                            0,
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-border/40 mt-auto">
                    <Button
                      variant="secondary"
                      className="flex-1 h-9 rounded-xl text-[10px] font-black"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetails(customer);
                      }}
                    >
                      <History className="h-3.5 w-3.5 ml-1.5" /> السجل
                    </Button>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        className="w-9 h-9 rounded-xl text-danger/60 hover:text-danger hover:bg-danger/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(customer);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            {rows.length === 0 && (
              <div className="py-12 text-center text-muted font-bold">
                لا يوجد عملاء مطابقين
              </div>
            )}
          </div>
  );
}
