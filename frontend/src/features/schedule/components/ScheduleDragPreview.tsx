import { CornerDownLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime12h } from "@/lib/core/utils";

export interface ScheduleDragPreviewProps {
  appointment: any;
}

export function ScheduleDragPreview({
  appointment,
}: ScheduleDragPreviewProps) {
  if (!appointment) return null;
  return (
    <div className="w-[260px] rounded-2xl p-4 shadow-2xl rotate-2 bg-white/95 dark:bg-[#171717]/95 opacity-95 backdrop-blur-sm ring-1 ring-accent/30">
      <div className="flex items-center justify-between gap-2">
        <Badge className="text-[9px] px-2.5 h-5 font-black uppercase tracking-widest rounded-lg shadow-sm border-none text-indigo-500 bg-indigo-500/10">
          جاري النقل...
        </Badge>
        <div className="flex items-center gap-1.5 text-[10px] font-black text-main bg-card/80 px-2.5 py-1 rounded-lg border border-border/40 tabular-nums shadow-sm">
          <CornerDownLeft size={11} className="text-accent" />
          {formatTime12h(
            String(
              appointment.appointment_time ||
                appointment.appointmentTime ||
                "",
            ).slice(0, 5),
          )}
        </div>
      </div>
      <h4 className="text-sm font-black text-main truncate mt-2">
        {appointment.customer_name || "عميل مجهول"}
      </h4>
      <p className="text-[9px] font-black text-muted mt-1">
        {appointment.barber_name ||
          appointment.employee_name ||
          "بدون موظف"}
      </p>
      <p className="text-[8px] font-bold text-accent mt-1.5">
        أفلت فوق موظف أو خانة لنقل الموعد، أو فوق يوم في التقويم الجانبي
      </p>
    </div>
  );
}
