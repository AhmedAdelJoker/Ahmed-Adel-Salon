import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CartItem, POSRecord } from "@/features/pos/types";
import type { ID } from "@/types/common";
import { formatCurrency } from "@/lib/core/utils";
import { ShoppingBag, ShoppingCart, Trash2, User } from "lucide-react";

export interface CartItemsListProps {
  cart: CartItem[];
  barbers: POSRecord[];
  removeFromCart: (uid: string) => void;
  updateCartItemBarber: (uid: string, newBarberId: ID) => void;
}

export const CartItemsList = ({
  cart,
  barbers,
  removeFromCart,
  updateCartItemBarber,
}: CartItemsListProps) => {
  return (
    <>
      <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between bg-soft/30">
        <h3 className="text-xs font-black flex items-center gap-2">
          <ShoppingCart size={14} className="text-primary" />
          السلة
        </h3>
        <Badge variant="outline" className="h-5 px-1.5 font-black text-[10px]">
          {cart.length}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-50/30 dark:bg-black/5">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-40 py-6 text-center">
            <ShoppingBag size={32} className="text-primary mb-2 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-widest text-main">
              السلة فارغة
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.uid}
              className="flex flex-col gap-1.5 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-white/5 border border-border/50 group transition-all hover:border-primary/30 hover:shadow-sm relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-0.5 h-full bg-primary/10 group-hover:bg-primary transition-colors" />

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-[12px] font-black text-main leading-tight truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                    <span className="text-[9px] sm:text-[10px] font-black text-primary px-1 sm:px-1.5 py-0.5 bg-primary/10 rounded-lg whitespace-nowrap">
                      {formatCurrency(item.price)}
                    </span>
                    {item.type === "product" && (
                      <Badge
                        variant="outline"
                        className="text-[7px] sm:text-[8px] font-bold h-3 sm:h-3.5 px-1 border-slate-200"
                      >
                        منتج
                      </Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeFromCart(item.uid)}
                  className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all shrink-0 touch-target"
                >
                  <Trash2 size={16} className="sm:size-5" />
                </button>
              </div>

              {item.type !== "product" && (
                <div className="flex items-center gap-1.5 mt-0.5 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <User size={10} className="text-primary shrink-0" />
                  <Select
                    value={(item.barberId as unknown as string) || ""}
                    onValueChange={(v) => updateCartItemBarber(item.uid, v)}
                  >
                    <SelectTrigger className="h-10 flex-1 bg-transparent border-none font-black text-[9px] sm:text-[10px] text-main">
                      <SelectValue placeholder="تحديد الخبير" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>
                        تحديد الخبير
                      </SelectItem>
                      {barbers.map((b) => (
                        <SelectItem key={b.id as string} value={String(b.id)}>
                          {b.display_name ||
                            b.displayName ||
                            b.full_name ||
                            b.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default CartItemsList;
