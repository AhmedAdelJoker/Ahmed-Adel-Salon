import React from "react";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import {
  Search,
  Zap,
  Package,
  Gift,
  ShoppingBag,
  PlusCircle,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/core/utils";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";

const ItemSelection = () => {
  const {
    categoryTabs,
    activeCategory,
    setActiveCategory,
    itemSearchQuery,
    setItemSearchQuery,
    filteredItems,
    addToCart,
  } = usePOS();

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Search & Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            size={16}
          />
          <Input
            placeholder="بحث عن خدمة أو منتج..."
            className="pr-9 h-10 rounded-xl border-border/50 focus:ring-primary/20 text-xs font-bold"
            value={itemSearchQuery}
            onChange={(e) => setItemSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar no-scrollbar">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`px-4 py-3 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border touch-target ${
                activeCategory === tab
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white dark:bg-white/5 text-muted border-border/50 hover:border-primary/20"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-2 p-0.5">
          <AnimatePresence mode="popLayout">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-12 text-center opacity-40">
                <ShoppingBag size={32} className="text-muted mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  لا توجد نتائج
                </p>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const type =
                  activeCategory === "المنتجات"
                    ? "product"
                    : activeCategory === "العروض"
                      ? "offer"
                      : "service";

                return (
                  <motion.div
                    key={`${type}-${item.id || idx}`}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="p-2.5 sm:p-3 h-full flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-300 border border-border/50 group bg-white dark:bg-white/5 backdrop-blur-md rounded-2xl relative overflow-hidden shadow-sm">
                      <div className="space-y-1.5 sm:space-y-2 relative z-10">
                        <div className="flex justify-between items-start">
                          <div
                            className={cn(
                              "h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105",
                              activeCategory === "المنتجات"
                                ? "bg-amber-500 text-white"
                                : activeCategory === "العروض"
                                  ? "bg-rose-500 text-white"
                                  : "bg-primary text-white",
                            )}
                          >
                            {activeCategory === "المنتجات" ? (
                              <Package size={14} className="sm:size-4" />
                            ) : activeCategory === "العروض" ? (
                              <Gift size={14} className="sm:size-4" />
                            ) : (
                              <Zap size={14} className="sm:size-4" />
                            )}
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-[6px] sm:text-[7px] font-black h-3 sm:h-3.5 px-1 bg-slate-100 dark:bg-white/10 text-slate-500 border-none uppercase"
                          >
                            {activeCategory === "المنتجات"
                              ? "منتج"
                              : activeCategory === "العروض"
                                ? "عرض"
                                : "خدمة"}
                          </Badge>
                        </div>
                        <h4 className="text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-white leading-tight line-clamp-2 min-h-[1.2rem] sm:min-h-[1.5rem] group-hover:text-primary transition-colors">
                          {item.name_ar ||
                            item.nameAr ||
                            item.name ||
                            item.display_name ||
                            item.displayName}
                        </h4>
                      </div>

                      <div className="mt-2 sm:mt-3 flex items-center justify-between relative z-10">
                        <span className="text-xs sm:text-sm font-black text-primary tabular-nums">
                          {formatCurrency(
                            item.price || item.sell_price || item.offer_price,
                          )}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item, type);
                          }}
                          className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 hover:bg-primary hover:text-white transition-all duration-300 border border-slate-100 dark:border-white/5 touch-target"
                          aria-label="أضف للسلة"
                        >
                          <PlusCircle size={16} className="sm:size-5" />
                        </button>
                      </div>
                    </Card>
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
