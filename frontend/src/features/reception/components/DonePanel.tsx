/** Reception done-today panel (moved from ReceptionBoard page, no logic changes). */
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/core/utils";
import DoneCard from "@/features/reception/components/DoneCard";
import ReceptionEmptyState from "@/features/reception/components/ReceptionEmptyState";

export default function DonePanel({
  show,
  list,
  revenue,
}: {
  show: boolean;
  list: any[];
  revenue: number | string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="rounded-[2rem] border border-border/60 bg-card/60 backdrop-blur-xl p-5 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-main">مكتمل اليوم</h3>
                <p className="text-[10px] font-bold text-muted">
                  {list.length} عميل تم إنجاز خدمته
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-black rounded-lg px-3 py-1">
              {formatCurrency(revenue)}
            </Badge>
          </div>
          {list.length === 0 ? (
            <ReceptionEmptyState
              icon={CheckCheck}
              title="لا مكتملة اليوم"
              desc="لم يتم إنهاء أي خدمة حتى الآن."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {list.map((a) => (
                <DoneCard key={a.id} appt={a} />
              ))}
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
