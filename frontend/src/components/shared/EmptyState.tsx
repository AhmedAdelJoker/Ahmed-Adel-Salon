import { Inbox } from "lucide-react";
import { cn } from "@/lib/core/utils";

interface EmptyStateProps {
  title?: string;
  text?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: any;
  className?: string;
}

export default function EmptyState({
  title = "لا توجد بيانات",
  text = "لم نتمكن من العثور على أي سجلات في هذه الفئة حالياً.",
  description,
  action = null,
  icon: Icon = Inbox,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "empty-state flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-border/60 bg-soft/20 py-20 px-10 text-center transition-all hover:bg-soft/40",
        className,
      )}
      dir="rtl"
    >
      <div className="w-20 h-20 rounded-full bg-card border border-border/40 flex items-center justify-center text-muted shadow-sm mb-8 transition-transform hover:scale-105">
        <Icon size={40} strokeWidth={1} />
      </div>

      <div className="max-w-md space-y-3">
        <h3 className="text-2xl font-black text-main uppercase tracking-tight leading-none">
          {title}
        </h3>
        <p className="text-sm font-medium text-muted leading-relaxed uppercase tracking-widest">
          {text}
        </p>
      </div>

      {action ? (
        <div className="mt-10 animate-in fade-in zoom-in duration-500">
          {action}
        </div>
      ) : null}
    </div>
  );
}
