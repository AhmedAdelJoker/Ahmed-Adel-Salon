/** Fast-client walk-in dialog (moved from ReceptionBoard page, no logic changes). */
import {
  Check,
  CheckCircle2,
  Clock,
  Phone,
  RefreshCw,
  Scissors,
  Search,
  Star,
  User,
  UserPlus,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/core/utils";

export default function FastClientDialog({
  open,
  onOpenChange,
  fastClientData,
  setFastClientData,
  foundCustomer,
  isSearchingCustomer,
  activeCategory,
  setActiveCategory,
  categories,
  filteredServices,
  toggleService,
  totalPrice,
  totalDuration,
  barbers,
  onSubmit,
}: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[850px] p-0 border-none bg-card rounded-[2rem] shadow-premium overflow-hidden"
      >
        <DialogHeader className="p-6 sm:p-8 pb-5 bg-gradient-to-br from-accent to-accent-strong relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-full bg-white/10 blur-[80px] pointer-events-none" />
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-lg">
                <UserPlus size={24} />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  تسجيل عميل سريع
                </DialogTitle>
                <DialogDescription className="text-white/60 font-bold mt-0.5 text-xs">
                  إضافة عميل جديد أو حالي مباشرة إلى مسار العمليات
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="p-4 sm:p-8 space-y-6 bg-card relative flex-1 min-h-0 overflow-y-auto custom-scrollbar"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-10">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2 flex items-center gap-2">
                    <Phone size={12} className="text-accent" /> رقم الهاتف
                  </label>
                  <div className="relative group">
                    <Input
                      placeholder="01xxxxxxxxx"
                      value={fastClientData.phone ?? ""}
                      onChange={(e) =>
                        setFastClientData({
                          ...fastClientData,
                          phone: e.target.value,
                        })
                      }
                      className="h-11 bg-soft border-border focus:bg-white rounded-xl text-right pr-11 font-black transition-all"
                      required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted">
                      {isSearchingCustomer ? (
                        <RefreshCw
                          size={16}
                          className="animate-spin text-accent"
                        />
                      ) : (
                        <Search size={16} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2 flex items-center gap-2">
                    <User size={12} className="text-accent" /> اسم العميل
                  </label>
                  <Input
                    placeholder="الاسم الثلاثي"
                    value={fastClientData.firstName ?? ""}
                    onChange={(e) =>
                      setFastClientData({
                        ...fastClientData,
                        firstName: e.target.value,
                      })
                    }
                    className="h-11 bg-soft border-border focus:bg-white rounded-xl text-right font-black transition-all"
                    required
                  />
                </div>
              </div>

              {foundCustomer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <Star size={20} fill="currentColor" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-emerald-600">
                        عميل مميز (VIP)
                      </p>
                      <p className="text-[10px] font-bold text-emerald-500/60">
                        إجمالي {foundCustomer.visits_count} زيارة سابقة للمحل
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500 text-white font-black rounded-lg">
                    بيانات مؤرشفة
                  </Badge>
                </motion.div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2 flex items-center gap-2">
                    <Scissors size={12} className="text-accent" /> اختيار
                    الخدمات المطلوبة
                  </label>
                  <Badge
                    variant="outline"
                    className="border-accent/20 text-accent font-black px-3 py-1 rounded-xl"
                  >
                    {fastClientData.serviceIds.length} خدمات مختارة
                  </Badge>
                </div>

                <div className="chip-scroller pb-1">
                  {["الكل", ...categories.map((c) => c.name)].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 whitespace-nowrap",
                        activeCategory === cat
                          ? "bg-accent border-accent text-white shadow-lg shadow-accent/20"
                          : "bg-soft border-transparent text-muted hover:text-accent",
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredServices.map((srv) => {
                    const isSelected = fastClientData.serviceIds.includes(
                      srv.id,
                    );
                    return (
                       <div
                         key={srv.id}
                         role="button"
                         tabIndex={0}
                         onClick={() => toggleService(srv.id)}
                         onKeyDown={(event) => {
                           if (event.key === "Enter" || event.key === " ") {
                             event.preventDefault();
                             toggleService(srv.id);
                           }
                         }}
                         className={cn(

                          "p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 relative group overflow-hidden",
                          isSelected
                            ? "bg-accent/5 border-accent shadow-sm"
                            : "bg-soft border-transparent hover:border-border",
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="check"
                            className="absolute top-2 left-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-lg z-10"
                          >
                            <Check
                              size={12}
                              className="text-white"
                              strokeWidth={4}
                            />
                          </motion.div>
                        )}
                        <div className="space-y-1 relative z-10">
                          <p className="font-black text-[13px] text-main group-hover:text-accent transition-colors truncate">
                            {srv.name}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs font-black text-accent tabular-nums">
                              {formatCurrency(srv.price)}
                            </span>
                            <span className="text-[10px] font-bold text-muted flex items-center gap-1">
                              <Clock size={10} /> {srv.duration_minutes || 30}{" "}
                              د
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-soft border border-border/40 rounded-[2rem] p-6 space-y-5 relative overflow-hidden">
                <div className="space-y-5 relative z-10">
                  <h4 className="text-[11px] font-black text-accent uppercase tracking-widest flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />{" "}
                    ملخص العملية
                  </h4>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-muted">
                        إجمالي الخدمات:
                      </span>
                      <span className="text-sm font-black text-main">
                        {fastClientData.serviceIds.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-muted">
                        الوقت المقدر:
                      </span>
                      <span className="text-sm font-black text-main flex items-center gap-1.5">
                        {totalDuration}{" "}
                        <span className="text-[10px] text-muted font-bold">
                          دقيقة
                        </span>
                      </span>
                    </div>
                    <div className="pt-4 border-t border-border flex flex-col gap-2">
                      <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                        الإجمالي المستحق:
                      </span>
                      <motion.span
                        key={totalPrice}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-3xl font-black text-emerald-600 tabular-nums tracking-tighter"
                      >
                        {formatCurrency(totalPrice)}
                      </motion.span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 pt-5 border-t border-border relative z-10">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                      اختيار الخبير
                    </label>
                    <Select
                      value={fastClientData.employeeId}
                      onValueChange={(v) =>
                        setFastClientData({
                          ...fastClientData,
                          employeeId: v,
                        })
                      }
                    >
                      <SelectTrigger className="h-11 bg-white border-border rounded-xl font-bold text-xs">
                        <SelectValue placeholder="اختر خبير" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="font-bold">
                          توزيع تلقائي (الأول متاح)
                        </SelectItem>
                        {barbers.map((b) => (
                          <SelectItem
                            key={b.id}
                            value={String(b.id)}
                            className="font-bold"
                          >
                            {b.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                      ملاحظات الكاشير
                    </label>
                    <Input
                      placeholder="أي تفاصيل خاصة..."
                      value={fastClientData.notes ?? ""}
                      onChange={(e) =>
                        setFastClientData({
                          ...fastClientData,
                          notes: e.target.value,
                        })
                      }
                      className="h-11 bg-white border border-border focus:bg-white rounded-xl text-right text-xs font-bold transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={fastClientData.serviceIds.length === 0}
                className="w-full h-14 rounded-2xl bg-accent hover:bg-accent-strong text-white font-black text-base shadow-lg shadow-accent/20 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <CheckCircle2 size={20} />
                <span>حفظ وتأكيد تسجيل العميل</span>
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
