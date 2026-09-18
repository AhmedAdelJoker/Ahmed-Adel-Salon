import {
  ArrowUpRight,
  Calendar,
  Clock,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { ContentPanel } from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";

export interface QuickActionsProps {
  onNavigate: (to: string) => void;
}

export function QuickActions({ onNavigate }: QuickActionsProps) {
  const items = [
    { label: "الموظفين", icon: Users, to: "/owner/hr", bg: "bg-primary/10 text-primary border-primary/20" },
    { label: "الخدمات", icon: Scissors, to: "/owner/settings?tab=services", bg: "bg-info/10 text-info border-info/20" },
    { label: "التقارير", icon: TrendingUp, to: "/owner/reports", bg: "bg-warning/10 text-warning border-warning/20" },
    { label: "المخزن", icon: ShoppingBag, to: "/inventory", bg: "bg-success/10 text-success border-success/20" },
    { label: "المواعيد", icon: Calendar, to: "/bookings", bg: "bg-danger/10 text-danger border-danger/20" },
    { label: "الإعدادات", icon: Settings, to: "/owner/settings", bg: "bg-soft text-muted border-border" },
    { label: "الأمان", icon: ShieldCheck, to: "/owner/security-access", bg: "bg-primary/10 text-primary border-primary/20" },
    { label: "السجلات", icon: Clock, to: "/activity-logs", bg: "bg-info/10 text-info border-info/20" },
  ];
  return (
    <ContentPanel title={undefined} subtitle={undefined} actions={undefined} className={undefined}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
            <ArrowUpRight size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black tracking-tight text-main truncate">وصول سريع</h3>
            <p className="text-xs font-bold text-muted">اختصارات لأهم العمليات اليومية</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        {items.map((item, idx) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate(item.to)}
            className={cn(
              "group flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 transition-all duration-300",
              "hover:border-primary/20 hover:bg-primary/5 hover:shadow-lg hover:-translate-y-0.5",
              item.bg,
            )}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className={cn(
              "rounded-xl p-3 transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:rotate-3",
              item.bg.split(" ").slice(0,2).join(" "),
            )}>
              <item.icon size={22} strokeWidth={2} />
            </div>
            <span className="text-[10px] font-black tracking-wider text-muted group-hover:text-primary truncate">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </ContentPanel>
  );
}
