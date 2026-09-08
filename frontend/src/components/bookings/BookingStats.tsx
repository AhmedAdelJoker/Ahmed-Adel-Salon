import { motion } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { Calendar, Clock, Globe, Sparkles, XCircle } from "lucide-react";

const cards = [
  {
    key: "total",
    label: "إجمالي المواعيد",
    icon: Calendar,
    gradient: "from-blue-500 to-blue-600",
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-100",
  },
  {
    key: "online",
    label: "حجوزات أونلاين",
    icon: Globe,
    gradient: "from-sky-500 to-sky-600",
    bg: "bg-sky-50",
    text: "text-sky-600",
    border: "border-sky-100",
  },
  {
    key: "waiting",
    label: "بانتظار الخدمة",
    icon: Clock,
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-100",
  },
  {
    key: "reception",
    label: "عند الاستقبال",
    icon: Sparkles,
    gradient: "from-emerald-500 to-emerald-600",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-100",
  },
  {
    key: "cancelled",
    label: "حجوزات ملغاة",
    icon: XCircle,
    gradient: "from-rose-500 to-rose-600",
    bg: "bg-rose-50",
    text: "text-rose-500",
    border: "border-rose-100",
  },
];

export default function BookingStats({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const value = stats[card.key] || 0;

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-4 transition-all duration-200",
              "hover:shadow-lg hover:-translate-y-0.5",
              card.bg,
              card.border,
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className={cn("text-xs font-bold", card.text)}>
                  {card.label}
                </p>
                <p className="text-3xl font-black text-main tabular-nums">
                  {value}
                </p>
              </div>
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm",
                  card.gradient,
                )}
              >
                <Icon size={18} className="text-white" />
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/30 blur-2xl" />
          </motion.div>
        );
      })}
    </div>
  );
}
