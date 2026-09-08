import { motion } from "framer-motion";
import { Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, getInitials } from "@/lib/core/utils";
import {
  customerId,
  customerName,
  getTierLabel,
  getTierVariant,
} from "@/pages/cashier/customers/useCustomers";
import { Badge } from "@/components/ui/badge";
import { CreditCard, History, Phone, Star, Trash2 } from "lucide-react";

export function CustomerCard({ customer, index, onDetails, onEdit, onDelete }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={() => onDetails(customer)}
      className="group relative flex flex-col rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-all active:scale-[0.98] hover:border-accent/20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 font-black text-accent">
            {getInitials(customerName(customer))}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-main truncate text-sm">
              {customerName(customer)}
            </h3>
            <p className="text-[10px] font-bold text-muted">
              #{customerId(customer) || "---"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge
             
            variant={
              ((customer.visits_count || 0) > 10
                ? ("accent" as any)
                : (customer.visits_count || 0) >= 2
                  ? "info"
                  : "outline") as any
            }
            className="text-[9px]"
          >
            {customer.visits_count || 0} زيارة
          </Badge>
          <Badge variant={getTierVariant(customer)} className="text-[9px]">
            {getTierLabel(customer)}
          </Badge>
        </div>
      </div>

      <div className="h-px bg-border/40 my-2" />

      {/* Info */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-muted flex items-center gap-1.5">
            <Phone size={12} className="text-muted/50" /> التواصل
          </span>
          <span className="font-black text-main" dir="ltr">
            {customer.phone || "---"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-muted flex items-center gap-1.5">
            <CreditCard size={12} className="text-emerald-500" /> الإنفاق
          </span>
          <span className="font-black text-emerald-600">
            {formatCurrency(customer.lifetime_spend || 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-muted flex items-center gap-1.5">
            <Star size={12} className="text-amber-500" /> النقاط
          </span>
          <span className="font-black text-amber-600">
            {Number(customer.loyalty_points || 0).toFixed(0)} نقطة
          </span>
        </div>
      </div>

      <div className="h-px bg-border/40 my-1" />

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="secondary"
          className="flex-1 h-9 rounded-xl text-[10px] font-black"
          onClick={(e) => {
            e.stopPropagation();
            onDetails(customer);
          }}
        >
          <History className="ml-1.5 h-3.5 w-3.5" /> السجل
        </Button>
        <Button
          variant="ghost"
          className="h-9 w-9 rounded-xl text-primary hover:bg-primary/10"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(customer);
          }}
          aria-label="تعديل العميل"
        >
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          className="h-9 w-9 rounded-xl text-rose-600 hover:bg-rose-50"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(customer);
          }}
          aria-label="حذف العميل"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
