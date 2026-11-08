import React from "react";
import { useTranslation } from "react-i18next";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import {
  Gift,
  LayoutGrid,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/core/utils";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";
import { isProductOnlyOffer } from "@/features/pos/utils";
import type { POSRecord } from "@/features/pos/types";

const PRODUCT_TABS = [
  { id: "all", icon: LayoutGrid, labelKey: "products_sale.tab_all" },
  { id: "products", icon: Package, labelKey: "products_sale.tab_products" },
  { id: "offers", icon: Gift, labelKey: "products_sale.tab_offers" },
] as const;

/**
 * The catalogue column.
 *
 * Two catalogues, one grid:
 *   products  care products and product-only offers — the manual sale;
 *   session   the service catalogue for the loaded appointment.
 *
 * Each tile is a single real button, not a card with a nested "+" button. That
 * makes the whole tile keyboard- and touch-activatable, and removes the
 * focus/hover mismatch the old card had (the card highlighted, the inner
 * button was what actually worked).
 */
const ItemSelection = () => {
  const { t, i18n } = useTranslation("pos");
  const {
    saleMode,
    categoryTabs,
    activeCategory,
    setActiveCategory,
    itemSearchQuery,
    setItemSearchQuery,
    filteredItems,
    addToCart,
    products,
    productOffers,
  } = usePOS();

  const isProductsMode = saleMode === "products";
  const isArabic = String(i18n.language || "").startsWith("ar");

  const itemName = (item: POSRecord): string =>
    (isArabic
      ? item.name_ar || item.nameAr || item.name
      : item.name || item.name_ar || item.nameAr) ||
    item.display_name ||
    item.displayName ||
    t("logic.item_fallback");

  /** Which invoice line this tile becomes. Mixed "all" tabs need per-item type. */
  const itemTypeFor = (item: POSRecord): string => {
    if (isProductsMode) return item.isProductOffer ? "offer" : "product";
    if (activeCategory === "offers") return "offer";
    if (activeCategory === "products") return "product";
    return "service";
  };

  const modeLabel = isProductsMode
    ? t("catalog.mode_products")
    : saleMode === "session"
      ? t("catalog.mode_session")
      : t("catalog.mode_products");

  const productTabCounts: Record<string, number> = {
    all: products.length + productOffers.length,
    products: products.length,
    offers: productOffers.length,
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-black text-main">
            <LayoutGrid size={16} className="text-primary" aria-hidden="true" />
            {isProductsMode ? t("catalog.products_title") : t("catalog.title")}
          </h2>
          <p className="mt-0.5 text-[10px] font-bold leading-relaxed text-muted">
            {isProductsMode
              ? t("catalog.products_subtitle")
              : t("catalog.subtitle")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant="secondary" size="sm">
            {modeLabel}
          </Badge>
          <Badge variant="outline" size="sm" className="tabular-nums">
            {t("catalog.count", { count: filteredItems.length })}
          </Badge>
        </div>
      </div>

      {isProductsMode && (
        <div className="flex items-start gap-1.5 rounded-xl border border-info/20 bg-info/5 px-2.5 py-2">
          <Sparkles
            size={12}
            className="mt-0.5 shrink-0 text-info"
            aria-hidden="true"
          />
          <p className="text-[10px] font-bold leading-relaxed text-muted">
            {t("products_sale.no_barber_hint")}
          </p>
        </div>
      )}

      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          size={16}
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label={t("items.search_label")}
          placeholder={
            isProductsMode
              ? t("products_sale.search_ph")
              : t("items.search_ph")
          }
          className="h-10 rounded-xl border-border/60 ps-9 text-xs font-bold focus:ring-primary/20"
          value={itemSearchQuery}
          onChange={(event) => setItemSearchQuery(event.target.value)}
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {isProductsMode
          ? PRODUCT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={t(tab.labelKey)}
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-black transition-colors touch-target",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/60 bg-soft/40 text-muted hover:border-primary/30 hover:text-main",
                  )}
                >
                  <Icon size={11} aria-hidden="true" />
                  {t(tab.labelKey)}
                  <span
                    className={cn(
                      "min-w-4 rounded px-1 py-0.5 text-[9px] tabular-nums",
                      isActive
                        ? "bg-primary-foreground/15"
                        : "bg-card/80 text-muted",
                    )}
                  >
                    {productTabCounts[tab.id]}
                  </span>
                </button>
              );
            })
          : categoryTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={activeCategory === tab}
                aria-label={
                  tab === "all"
                    ? t("items.all")
                    : tab === "offers"
                      ? t("items.offers")
                      : tab === "products"
                        ? t("items.products")
                        : tab
                }
                onClick={() => setActiveCategory(tab)}
                className={cn(
                  "whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-black transition-colors touch-target",
                  activeCategory === tab
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-soft/40 text-muted hover:border-primary/30 hover:text-main",
                )}
              >
                {/* Tabs carry canonical ids ("all"/"offers"/"products" or a
                    category id); only the first three are UI vocabulary —
                    category names are business data and render as-is. */}
                {tab === "all"
                  ? t("items.all")
                  : tab === "offers"
                    ? t("items.offers")
                    : tab === "products"
                      ? t("items.products")
                      : tab}
              </button>
            ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2 no-scrollbar">
        <div className="grid grid-cols-2 gap-2 p-0.5 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence>
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-12 text-center opacity-50">
                <ShoppingBag
                  size={30}
                  className="mx-auto mb-2 text-muted"
                  aria-hidden="true"
                />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  {t("items.no_results")}
                </p>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const type = itemTypeFor(item);
                const isOffer = type === "offer";
                const isProductOffer = isOffer && isProductOnlyOffer(item);
                const isStocked = type === "product" || isProductOffer;
                const name = itemName(item);
                const stock = isProductOffer
                  ? Number(item.stock ?? 0)
                  : Number(item.quantity ?? item.stock ?? 0);
                const outOfStock = isStocked && stock <= 0;
                const Icon = type === "product" ? Package : isOffer ? Gift : Zap;
                const price = Number(
                  item.price ||
                    item.sell_price ||
                    item.sellPrice ||
                    item.offer_price ||
                    item.offerPrice ||
                    0,
                );
                const originalPrice = Number(
                  item.original_price ||
                    item.originalPrice ||
                    item.offer_price_original ||
                    0,
                );
                const savings = isOffer && originalPrice > price
                  ? originalPrice - price
                  : 0;
                const componentCount =
                  isProductOffer && Array.isArray(item.offer_products)
                    ? item.offer_products.length
                    : 0;

                return (
                  <motion.div
                    key={`${type}-${item.id || index}`}
                    // No `layout` prop: it makes framer-motion measure and
                    // animate the position of EVERY card on every render of
                    // the list, which is real work on a till that shows a
                    // hundred services. The grid never reorders.
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.16 }}
                  >
                    <button
                      type="button"
                      onClick={() => addToCart(item, type)}
                      disabled={outOfStock}
                      aria-label={t("items.add_named", { name })}
                      className={cn(
                        "group flex h-full min-h-[7.75rem] w-full flex-col justify-between rounded-xl border p-2.5 text-start transition-all touch-target",
                        outOfStock
                          ? "cursor-not-allowed border-border/40 bg-soft/30 opacity-60"
                          : isOffer
                            ? "border-info/25 bg-info/5 shadow-sm hover:-translate-y-0.5 hover:border-info/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/30"
                            : "border-border/60 bg-card shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      )}
                    >
                      <div className="w-full space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              type === "product"
                                ? "bg-warning/10 text-warning"
                                : isOffer
                                  ? "bg-info/10 text-info"
                                  : "bg-primary/10 text-primary",
                            )}
                          >
                            <Icon size={15} aria-hidden="true" />
                          </span>
                          {isStocked ? (
                            <Badge
                              variant={outOfStock ? "danger" : "success"}
                              size="sm"
                              className="tabular-nums"
                            >
                              {outOfStock
                                ? t("items.out_of_stock")
                                : t("items.stock_available", {
                                    count: Math.floor(stock),
                                  })}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" size="sm">
                              {isOffer ? t("items.offer") : t("items.service")}
                            </Badge>
                          )}
                        </div>

                        <h3 className="line-clamp-2 min-h-[2.1rem] text-xs font-black leading-snug text-main transition-colors group-hover:text-primary">
                          {name}
                        </h3>

                        {isProductOffer && (
                          <p className="text-[9px] font-bold leading-snug text-info">
                            {t("products_sale.product_offer")}
                            {componentCount > 0
                              ? ` • ${t("products_sale.includes_products", {
                                  count: componentCount,
                                })}`
                              : ""}
                          </p>
                        )}
                      </div>

                      <div className="mt-2 w-full space-y-0.5">
                        <div className="flex w-full items-center justify-between gap-1">
                          <span className="whitespace-nowrap text-[13px] font-black tabular-nums text-primary">
                            {formatCurrency(price)}
                          </span>
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                              outOfStock
                                ? "bg-soft text-muted"
                                : "bg-soft text-muted group-hover:bg-primary group-hover:text-primary-foreground",
                            )}
                            aria-hidden="true"
                          >
                            <Plus size={15} />
                          </span>
                        </div>
                        {savings > 0 && (
                          <p className="flex items-center gap-1.5 text-[9px] font-bold text-muted">
                            <span className="line-through tabular-nums">
                              {formatCurrency(originalPrice)}
                            </span>
                            <span className="font-black text-success">
                              {t("cart.offer_save", {
                                amount: formatCurrency(savings),
                              })}
                            </span>
                          </p>
                        )}
                      </div>
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ItemSelection;
