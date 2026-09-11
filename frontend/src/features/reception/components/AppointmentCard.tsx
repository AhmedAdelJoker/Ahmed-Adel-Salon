/** Reception AppointmentCard (moved from ReceptionBoard page, no logic changes). */
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, ChevronLeft, Clock, Edit3, GripVertical, Phone, Play, RefreshCw, Timer, Trash2, UserCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { cn, formatTime12h } from "@/lib/core/utils";
import { formatWait, getWaitMinutes } from "@/features/reception/utils/wait";

export default function AppointmentCard({
  appt,
  col,
  now,
  dragging,
  onEdit,
  onCancel,
  onReassign,
  onUpdateStatus,
}: any) {
  const isOnline = appt.booking_source === "online";
  const status = String(appt.status || "").toLowerCase();
  const waitMins = getWaitMinutes(appt, now);
  const waitLabel = formatWait(waitMins);
  const timeLabel = appt.appointment_time
    ? formatTime12h(String(appt.appointment_time).slice(0, 5))
    : "—";

  return (
    <motion.div
      layout
      draggable
      onDragStart={(e) => {
        const dragEvent = e as unknown as React.DragEvent;
        dragEvent.dataTransfer.setData("text/plain", String(appt.id));
        dragEvent.dataTransfer.effectAllowed = "move";
      }}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        rotate: dragging ? 1.5 : 0,
      }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileHover={{ y: -3 }}
      className={cn(
        "p-3 sm:p-4 bg-card border border-border/60 rounded-xl sm:rounded-[1.5rem] flex flex-col gap-3 sm:gap-4 transition-all duration-300 relative overflow-hidden group shadow-soft hover:shadow-premium hover:border-accent/30 cursor-grab active:cursor-grabbing",
        dragging && "opacity-60 ring-2 ring-accent/30 shadow-2xl",
      )}
    >
      {/* Drag Handle */}
      <div className="absolute top-3 left-3 text-muted/30 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={16} />
      </div>

      {/* Top Row */}
      <div className="flex justify-between items-start gap-3 pt-1">
        <div className="min-w-0 space-y-2 flex-1">
          <h4 className="font-black text-base text-main truncate leading-tight group-hover:text-accent transition-colors">
            {appt.customer_name || "عميل مجهول"}
          </h4>
          <div className="flex items-center gap-2 text-[11px] font-bold text-muted min-w-0">
            <Phone size={12} className="text-muted/60 shrink-0" />
            <span className="truncate" dir="ltr">
              {appt.customer_phone || "غير متوفر"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(appt.services || []).slice(0, 1).map((s, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] font-black text-muted flex items-center gap-1.5 uppercase tracking-tighter bg-soft border-border/40 px-2 py-0.5 rounded-lg"
              >
                <Zap size={10} className="text-accent" />{" "}
                {s.service_name_snapshot || "خدمة عامة"}
              </Badge>
            ))}
            {appt.services?.length > 1 && (
              <Badge
                variant="outline"
                className="text-[9px] font-black text-accent bg-accent/5 border-accent/10 px-1.5 py-0.5 rounded-lg"
              >
                +{appt.services.length - 1} أخرى
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-main bg-soft px-3 py-1 rounded-xl border border-border/40 shadow-sm tabular-nums">
            <Clock size={12} className="text-accent" />
            {timeLabel}
          </div>
          {isOnline && (
            <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[9px] font-black h-5 px-2 rounded-lg border border-sky-500/20 uppercase tracking-widest">
              ONLINE
            </Badge>
          )}
          {waitLabel && (
            <Badge
              className={cn(
                "text-[9px] font-black h-5 px-2 rounded-lg border uppercase tracking-widest",
                (waitMins ?? 0) > 20
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  : (waitMins ?? 0) > 10
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
              )}
            >
              <Timer size={10} className="ml-1" />
              {waitLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* Barber Row */}
      <div className="flex items-center justify-between p-3 bg-soft/50 rounded-[1.25rem] border border-border/40 group-hover:bg-card group-hover:border-accent/10 transition-all duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <EmployeeAvatar
            name={appt.barber_name}
            size="sm"
            className="h-8 w-8 shrink-0"
           imageUrl={undefined} role={undefined} />
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted uppercase leading-none mb-1 tracking-widest">
              الخبير
            </p>
            <p
              className="text-xs font-black text-main truncate group-hover:text-accent transition-colors"
              title={appt.barber_name}
            >
              {appt.barber_name || "توزيع تلقائي"}
            </p>
          </div>
        </div>
        <ChevronLeft
          size={14}
          className="text-muted group-hover:text-accent transition-all group-hover:translate-x-[-2px] shrink-0"
        />
      </div>

      {/* Actions */}
      <div className="pt-1 space-y-2.5">
        {col.key === "waiting" &&
          status !== "done" &&
          status !== "cancelled" && (
            <>
              {status === "waiting" ? (
                <Button
                  onClick={() => onUpdateStatus(appt.id, "in_progress")}
                  className="w-full h-11 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-black text-xs hover:scale-[1.02] transition-all"
                >
                  <Play size={15} className="ml-2" fill="currentColor" /> توجيه
                  للخبير
                </Button>
              ) : (
                <Button
                  onClick={() => onUpdateStatus(appt.id, "waiting")}
                  className="w-full h-11 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 font-black text-xs hover:scale-[1.02] transition-all"
                >
                  <UserCheck size={15} className="ml-2" /> تأكيد الوصول
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={onEdit}
                  className="flex-1 h-10 rounded-xl bg-white dark:bg-white/5 text-muted hover:text-primary border border-border/40 transition-all flex items-center justify-center gap-2 text-[11px] font-black"
                >
                  <Edit3 size={13} className="text-primary" /> تعديل
                </Button>
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  className="flex-1 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/10 transition-all flex items-center justify-center gap-2 text-[11px] font-black"
                >
                  <Trash2 size={13} /> إلغاء
                </Button>
              </div>
            </>
          )}

        {col.key === "in_service" && (
          <Button
            onClick={() => onUpdateStatus(appt.id, "completed")}
            className="w-full h-11 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 font-black text-xs hover:scale-[1.02] transition-all"
          >
            <CheckCircle2 size={15} className="ml-2" /> إنهاء وإرسال للاستقبال
          </Button>
        )}

        {col.key === "review" && (
          <Button
            onClick={() => onUpdateStatus(appt.id, "ready_for_payment")}
            className="w-full h-11 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 font-black text-xs hover:scale-[1.02] transition-all"
          >
            تأكيد جاهزية الدفع <ArrowUpRight size={15} className="mr-2" />
          </Button>
        )}

        {col.key === "cashier" && (
          <div className="w-full h-11 rounded-xl bg-sky-500/5 border border-sky-500/20 flex items-center justify-center gap-3">
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">
              قيد التحصيل الآن
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={onReassign}
          className="w-full h-10 text-[11px] font-black text-muted hover:text-accent hover:bg-white/5 rounded-xl border border-dashed border-border/40 hover:border-accent/40 transition-all"
        >
          <RefreshCw size={13} className="ml-2" /> تغيير خبير الخدمة
        </Button>
      </div>
    </motion.div>
  );
}
