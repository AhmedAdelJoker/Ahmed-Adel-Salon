import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
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
import { cartLineNeedsExpert } from "@/features/pos/utils";
import {
  Clock,
  Gift,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  User,
  Zap,
} from "lucide-react";

export interface CartItemsListProps {
  cart: CartItem[];
  barbers: POSRecord[];
  removeFromCart: (uid: string) => void;
  updateCartItemBarber: (uid: string, newBarberId: ID) => void;
  updateCartItemQuantity: (uid: string, delta: number) => void;
}

const typeMeta: Record<string, { icon: typeof Zap; tone: string }> = {
  service: { icon: Zap, tone: "bg-primary/10 text-primary" },
  product: { icon: Package, tone: "bg-warning/10 text-warning" },
  offer: { icon: Gift, tone: "bg-info/10 text-info" },
};

/**
 * Compact cart rows.
 *
 * The old rows spent a full card per line with three stacked bands, so four
 * items filled the whole column and the cashier had to scroll a live sale.
 * Here a line is two thin rows: identity + money, then the controls that are
 * actually used (quantity for retail stock, barber for services and
 * service offers).
 */
export const CartItemsList = ({
  cart,
  barbers,
  removeFromCart,
  updateCartItemBarber,
  updateCartItemQuantity,
}: CartItemsListProps) => {
  const { t } = useTranslation("pos");
  const totalPieces = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border/50 bg-soft/25 px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-xs font-black text-main">
          <ShoppingCart size={14} className="text-primary" />
          {t("cart.title")}
        </h2>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-black">
          {t("cart.header", { items: cart.length, pieces: totalPieces })}
        </Badge>
      </div>

      <div className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto bg-soft/20 p-2">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center opacity-50">
            <ShoppingBag size={30} className="mb-2 text-primary opacity-30" />
            <p className="text-[10px] font-black uppercase tracking-widest text-main">
              {t("cart.empty")}
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const meta = typeMeta[item.type] || typeMeta.service;
            const Icon = meta.icon;
            const typeLabel = item.isProductOffer
              ? t("cart.type_product_offer")
              : item.type === "product"
                ? t("cart.type_product")
                : item.type === "offer"
                  ? t("cart.type_offer")
                  : t("cart.type_service");
            const qty = Number(item.quantity || 1);
            const stock = Number(item.stock ?? 0);
            const lineTotal = Number(item.price || 0) * qty;
            // Products and product-only offers are stock lines: both get a
            // quantity stepper and a shelf limit, and neither gets an expert.
            const isStocked = item.type === "product" || item.isProductOffer;
            const needsExpert = cartLineNeedsExpert(item);
            const isService = item.type === "service";
            const missingBarber = needsExpert && !item.barberId;

            return (
              <div
                key={item.uid}
                className={`rounded-xl border bg-card transition-colors ${
                  missingBarber
                    ? "border-danger/40"
                    : "border-border/50 hover:border-primary/30"
                }`}
              >
                <div className="flex items-start gap-2 p-2">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}
                  >
                    <Icon size={14} aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black leading-tight text-main">
                      {item.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] font-bold text-muted">
                      <span>{typeLabel}</span>
                      {isService && item.durationMinutes ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Clock size={8} aria-hidden="true" />
                          {t("cart.duration_min", { n: item.durationMinutes })}
                        </span>
                      ) : null}
                      {isStocked ? (
                        <span className={stock > 0 && stock <= 5 ? "text-danger" : ""}>
                          {t("cart.stock_left", { n: Math.floor(stock) })}
                        </span>
                      ) : null}
                      {item.type === "offer" && item.originalPrice ? (
                        <span className="text-success">
                          {t("cart.offer_save", {
                            amount: formatCurrency(
                              Number(item.originalPrice) - Number(item.price),
                            ),
                          })}
                        </span>
                      ) : null}
                      {item.isProductOffer ? (
                        <span className="rounded bg-info/10 px-1 py-0.5 font-black text-info">
                          {t("cart.no_expert")}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-xs font-black tabular-nums text-primary">
                      {formatCurrency(lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.uid)}
                      aria-label={t("cart.remove", { name: item.name })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger touch-target"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isStocked ? (
                  <div className="flex items-center justify-between gap-2 border-t border-border/30 px-2 py-1.5">
                    <div className="flex items-center gap-1 rounded-lg bg-soft p-0.5">
                      <button
                        type="button"
                        onClick={() => updateCartItemQuantity(item.uid, -1)}
                        disabled={qty <= 1}
                        aria-label={t("cart.decrease_qty")}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-main transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 touch-target"
                      >
                        <Minus size={12} aria-hidden="true" />
                      </button>
                      <span className="min-w-7 text-center text-xs font-black tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartItemQuantity(item.uid, 1)}
                        disabled={stock > 0 && qty >= stock}
                        aria-label={t("cart.increase_qty")}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-main transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 touch-target"
                      >
                        <Plus size={12} aria-hidden="true" />
                      </button>
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted">
                      {t("cart.per_unit", { price: formatCurrency(item.price) })}
                    </span>
                  </div>
                ) : needsExpert ? (
                  <div
                    className={`flex items-center gap-1.5 border-t px-2 py-1.5 ${
                      missingBarber
                        ? "border-danger/20 bg-danger/5"
                        : "border-border/30 bg-soft/20"
                    }`}
                  >
                    <User
                      size={10}
                      className={missingBarber ? "text-danger" : "text-primary"}
                      aria-hidden="true"
                    />
                    <Select
                      value={(item.barberId as unknown as string) || ""}
                      onValueChange={(value) =>
                        updateCartItemBarber(item.uid, value)
                      }
                    >
                      <SelectTrigger
                        aria-label={t("cart.pick_expert_for", { name: item.name })}
                        className="h-8 flex-1 border-none bg-transparent px-1 text-[10px] font-black text-main"
                      >
                        <SelectValue
                          placeholder={
                            missingBarber
                              ? t("cart.pick_expert_warn")
                              : t("cart.pick_expert")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {barbers.map((barber) => (
                          <SelectItem
                            key={barber.id as string}
                            value={String(barber.id)}
                          >
                            {barber.display_name ||
                              barber.displayName ||
                              barber.full_name ||
                              barber.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export default CartItemsList;
