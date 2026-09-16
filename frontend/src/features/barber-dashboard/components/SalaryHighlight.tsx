import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/shared/PremiumUI";

interface ProjectedSalaryMetrics {
  attendance_percent?: number | string | null;
  [key: string]: unknown;
}

interface ProjectedSalary {
  net_salary?: number | string | null;
  metrics?: ProjectedSalaryMetrics | null;
  [key: string]: unknown;
}

interface SalaryHighlightProps {
  projectedSalary: ProjectedSalary | null | undefined;
}

export const SalaryHighlight = ({ projectedSalary }: SalaryHighlightProps) => {
  if (!projectedSalary) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <PremiumCard className="p-6 bg-gradient-to-l from-slate-900 to-slate-800 border-none overflow-hidden relative">
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -ml-32 -mt-32" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
              <ShieldCheck size={28} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                الراتب المتوقع هذا الشهر
              </h3>
              <p className="text-xs font-bold text-slate-400">
                بناءً على انضباطك وعمولاتك
              </p>
            </div>
          </div>
          <div className="text-center md:text-left">
            <div className="text-4xl font-black text-white tabular-nums">
              {Number(projectedSalary.net_salary || 0).toLocaleString("ar-EG")}
              <span className="text-sm text-slate-400 mr-2">ج.م</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[9px] font-black text-emerald-400 border-emerald-500/30"
              >
                نسبة الحضور: {projectedSalary.metrics?.attendance_percent || 0}%
              </Badge>
            </div>
          </div>
        </div>
      </PremiumCard>
    </motion.div>
  );
};
