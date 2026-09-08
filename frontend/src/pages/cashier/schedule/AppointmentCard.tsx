import { memo } from "react";
import { motion } from "framer-motion";
import {
  Clock3,
  GripVertical,
  Globe,
  Home,
  Scissors,
  AlertTriangle,
} from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { cn, formatTime12h } from "@/lib/core/utils";
import { getStatusConfig, getAppointmentDuration } from "@/pages/cashier/schedule/scheduleUtils";
import { Badge } from "@/components/ui/badge";

function getServiceSummary(appointment) {
  if (Array.isArray(appointment.services) && appointment.services.length > 0) {
    const names = appointment.services
      .map((s) => s.service_name || s.name)
      .filter(Boolean);
    return (
      names.slice(0, 2).join("، ") +
      (names.length > 2 ? ` +${names.length - 2}` : "")
    );
  }
  return appointment.service_name || appointment.service || null;
}

const AppointmentCard = memo(function AppointmentCard({
  appointment,
  onOpenDetails,
  isDragging,
  style,
  className,
  compact,
  ultraCompact,
}: any) {
  const status = getStatusConfig(appointment.status);
  const isOnline = appointment.booking_source === "online";
  const duration = getAppointmentDuration(appointment);
  const serviceSummary = getServiceSummary(appointment);
  const hasConflict = appointment._conflict === true;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: dndDragging,
  } = useDraggable({
    id: String(appointment.id),
    data: {
      type: "appointment",
      appointment,
    },
  });

  const active = dndDragging || isDragging;

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: active ? 0.4 : 1,
        scale: active ? 0.96 : 1,
        zIndex: active ? 50 : undefined,
      }}
      style={
        transform
          ? {
              ...style,
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            }
          : style
      }
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={(e) => {
        e.stopPropagation();
        if (!active) onOpenDetails?.(appointment);
      }}
      role="button"
      tabIndex={0}
      aria-label={`موعد ${appointment.customer_name || "عميل"} الساعة ${formatTime12h(
        String(
          appointment.appointment_time || appointment.appointmentTime || "",
        ).slice(0, 5),
      )} - حالة ${status.label}`}
      aria-grabbed={active}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails?.(appointment);
        }
      }}
      className={cn(
        "absolute rounded-[1.5rem] flex flex-col overflow-hidden group/card select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-grab active:cursor-grabbing",
        ultraCompact ? "p-2.5" : compact ? "p-3" : "p-4",
        status.bg,
        "ring-1 ring-black/5 shadow-soft hover:shadow-premium",
        active && "opacity-40 blur-[1px]",
        hasConflict && "ring-2 ring-rose-400/60",
        className,
      )}
    >
      <div
        className={cn(
          "absolute top-0 left-0 rounded-br-[2rem] flex items-center justify-center transition-all duration-500 opacity-20 group-hover/card:opacity-100",
          ultraCompact ? "w-9 h-9" : "w-12 h-12",
          isOnline
            ? "bg-sky-500/10 text-sky-600"
            : "bg-amber-500/10 text-amber-600",
        )}
      >
        {isOnline ? <Globe size={16} /> : <Home size={16} />}
      </div>

      {hasConflict && (
        <div className="absolute top-0 right-0 w-7 h-7 rounded-bl-[1.5rem] bg-rose-500/15 text-rose-500 flex items-center justify-center">
          <AlertTriangle size={12} strokeWidth={3} />
        </div>
      )}

      <div className="relative z-10 flex items-center justify-between gap-2 min-w-0">
        <Badge
          className={cn(
            "font-black uppercase tracking-widest rounded-lg shadow-sm border-none shrink-0 min-w-0",
            ultraCompact ? "text-[8px] px-1.5 h-4" : "text-[9px] px-2.5 h-5",
            status.color,
            status.bg,
          )}
        >
          {status.label}
        </Badge>
        <div
          className={cn(
            "flex items-center gap-1.5 font-black text-main bg-card/80 backdrop-blur-md rounded-lg border border-border/40 tabular-nums shadow-sm shrink-0",
            ultraCompact
              ? "text-[9px] px-1.5 py-0.5"
              : "text-[10px] px-2.5 py-1",
          )}
        >
          <Clock3 size={11} className="text-accent shrink-0" />
          {formatTime12h(
            String(
              appointment.appointment_time || appointment.appointmentTime || "",
            ).slice(0, 5),
          )}
          {!ultraCompact && duration != null && (
            <span className="text-[8px] text-muted font-bold">
              ({duration}د)
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-1.5 min-w-0">
        <h4
          className={cn(
            "font-black text-main truncate group-hover/card:text-accent transition-colors",
            ultraCompact ? "text-xs" : "text-sm",
          )}
        >
          {appointment.customer_name || "عميل مجهول"}
        </h4>
      </div>

      {!compact && !ultraCompact && serviceSummary && (
        <div className="relative z-10 mt-1.5 flex items-center gap-1.5 text-[9px] font-bold text-muted bg-card/60 backdrop-blur-sm px-2 py-1 rounded-lg border border-border/40 truncate">
          <Scissors size={10} className="text-accent shrink-0" />
          <span className="truncate">{serviceSummary}</span>
        </div>
      )}

      {!ultraCompact && (
        <div className="relative z-10 mt-auto pt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden flex-1">
            <GripVertical size={12} className="text-muted/20 shrink-0" />
            <p className="text-[9px] font-black text-muted/60 truncate italic">
              {appointment.notes ||
                (compact ? "" : "اضغط للتفاصيل أو اسحب لنقل")}
            </p>
          </div>
          <div className="w-7 h-7 rounded-xl bg-card/80 flex items-center justify-center text-accent shadow-sm border border-border/40 group-hover/card:bg-accent group-hover/card:text-white transition-all duration-300 shrink-0">
            <GripVertical size={14} className="rotate-90" />
          </div>
        </div>
      )}
    </motion.div>
  );
});

export default AppointmentCard;
export { getServiceSummary };
