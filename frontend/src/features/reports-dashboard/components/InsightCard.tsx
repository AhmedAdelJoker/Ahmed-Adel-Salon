import { ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

export type InsightIconColor = "primary" | "success" | "warning" | "danger" | "info";

export interface InsightCardProps {
  icon: LucideIcon;
  iconColor: InsightIconColor;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export function InsightCard({ icon: Icon, iconColor, title, description, actionLabel, onAction }: InsightCardProps) {
  const colorMap: Record<InsightIconColor, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-emerald-600 bg-emerald-500/10",
    warning: "text-amber-600 bg-amber-500/10",
    danger: "text-rose-600 bg-rose-500/10",
    info: "text-blue-600 bg-blue-500/10",
  };
  return (
    <div className="p-4 rounded-2xl bg-soft/50 border border-border/40 space-y-3">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", colorMap[iconColor] || colorMap.primary)}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-black text-main leading-tight">{title}</h5>
          <p className="text-xs font-bold text-muted leading-relaxed mt-0.5 line-clamp-2">{description}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
        onClick={onAction}
      >
        {actionLabel} <ArrowRight size={12} className="ml-1" />
      </Button>
    </div>
  );
}
