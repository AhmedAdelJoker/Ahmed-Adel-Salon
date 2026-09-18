import type { CartItem } from "@/features/pos/types";
import { formatCurrency } from "@/lib/core/utils";

export interface ReceiptPreviewProps {
  cart: CartItem[];
}

export const ReceiptPreview = ({ cart }: ReceiptPreviewProps) => {
  if (cart.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-border/30 bg-indigo-50/30 dark:bg-indigo-900/10">
      <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1">
        <div className="w-1 h-1 rounded-full bg-indigo-500" /> معاينة
        الفاتورة
      </p>
      <div className="space-y-0.5 max-h-16 overflow-y-auto no-scrollbar">
        {cart.map((item, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center text-[9px] font-bold text-slate-500"
          >
            <span className="truncate">
              #{idx + 1} {item.name}
            </span>
            <span className="tabular-nums">{formatCurrency(item.price)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReceiptPreview;
