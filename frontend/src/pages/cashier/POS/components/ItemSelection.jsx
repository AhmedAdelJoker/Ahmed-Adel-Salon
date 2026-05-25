import React from "react";
import { usePOS } from "../POSContext";
import { Card } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Badge } from "../../../../components/ui/badge";
import { Search, Zap, Package, Gift, ShoppingBag, PlusCircle } from "lucide-react";
import { formatCurrency, cn } from "../../../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ItemSelection = () => {
  const { 
    categoryTabs, 
    activeCategory, 
    setActiveCategory, 
    itemSearchQuery, 
    setItemSearchQuery, 
    filteredItems, 
    addToCart 
  } = usePOS();

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Search & Tabs */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <Input 
            placeholder="بحث عن خدمة أو منتج..." 
            className="pr-10 h-12 rounded-2xl border-border focus:ring-primary/20"
            value={itemSearchQuery}
            onChange={(e) => setItemSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border-2 ${
                activeCategory === tab 
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                  : "bg-white dark:bg-white/5 text-muted border-transparent hover:border-primary/20"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
          <AnimatePresence mode="popLayout">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-soft rounded-full flex items-center justify-center mx-auto mb-4 opacity-40">
                  <ShoppingBag size={40} className="text-muted" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-muted">لا توجد نتائج مطابقة</p>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const type = activeCategory === "المنتجات" ? "product" : 
                             activeCategory === "العروض" ? "offer" : "service";
                const colorClass = activeCategory === "المنتجات" ? "amber" :
                                  activeCategory === "العروض" ? "rose" : "primary";
                
                return (
                  <motion.div
                    key={`${type}-${item.id || idx}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.02 }}
                  >
                    <Card 
                      className="p-4 h-full flex flex-col justify-between cursor-pointer hover:shadow-xl hover:border-primary/40 transition-all duration-300 border-2 border-transparent group bg-white dark:bg-white/5 rounded-[1.75rem] relative overflow-hidden"
                      onClick={() => addToCart(item, type)}
                    >
                      {/* Subtle hover background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-start">
                          <div className={cn(
                            "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3 shadow-sm",
                            activeCategory === "المنتجات" ? "bg-amber-100 text-amber-600 shadow-amber-200/50" :
                            activeCategory === "العروض" ? "bg-rose-100 text-rose-600 shadow-rose-200/50" :
                            "bg-primary/10 text-primary shadow-primary/20"
                          )}>
                            {activeCategory === "المنتجات" ? <Package size={20} /> :
                             activeCategory === "العروض" ? <Gift size={20} /> :
                             <Zap size={20} />}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="text-[9px] font-black h-4 px-1.5 border-slate-100 dark:border-white/10 opacity-70">
                              {activeCategory === "المنتجات" ? "منتج" : 
                               activeCategory === "العروض" ? "عرض" : "خدمة"}
                            </Badge>
                          </div>
                        </div>
                        <h4 className="text-[13px] font-black text-main leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
                          {item.name_ar || item.nameAr || item.name || item.display_name || item.displayName}
                        </h4>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between relative z-10">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-muted uppercase tracking-widest">السعر</span>
                          <span className="text-sm font-black text-primary tabular-nums">
                            {formatCurrency(item.price || item.sell_price || item.offer_price)}
                          </span>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-soft flex items-center justify-center text-muted group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/30 transition-all duration-300">
                          <PlusCircle size={20} />
                        </div>
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
