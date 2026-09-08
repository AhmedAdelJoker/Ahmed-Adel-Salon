import React, { useRef, useCallback } from "react";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Clock,
  User,
  ShoppingBag,
  ChevronLeft,
  RefreshCw,
  Zap,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/core/utils";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence } from "framer-motion";

const ITEM_HEIGHT = 180; // Approximate height of each session card

const SessionsQueue = () => {
  const {
    readyAppointments,
    readyAppointmentsLoading,
    fetchReadyAppointments,
    setActiveAppointmentId,
    setIsReviewing,
    setCart,
    setSelectedCustomerId,
    selectedBarberId,
    setSelectedBarberId,
    setCompletedCustomerName,
    activeAppointmentId,
    barbers,
  } = usePOS();

   
  const parentRef = useRef<any>(null);

  const handleLoadAppointment = useCallback(
    (appointment) => {
      const appointmentId =
        appointment.appointment_id ||
        appointment.appointmentId ||
        appointment.id;
      const appointmentBarberId =
        appointment.employee_id ||
        appointment.employeeId ||
        appointment.barber_id ||
        appointment.barberId ||
        "";

      // Auto-select the barber in the global dropdown as well
      if (appointmentBarberId) {
        setSelectedBarberId(String(appointmentBarberId));
      }

      const barber = barbers.find(
        (b) => String(b.id) === String(appointmentBarberId),
      );

      const newCart = (appointment.services || []).map((svc) => {
        const serviceId = svc.service_id || svc.serviceId || svc.id;
        return {
          id: serviceId,
          serviceId,
          service_id: serviceId,
          uid: `appointment-${appointmentId}-service-${serviceId}-${Math.random()}`,
          name:
            svc.service_name_snapshot ||
            svc.service_name ||
            svc.serviceName ||
            svc.name ||
            "خدمة",
          price: Number(
            svc.price_snapshot ??
              svc.price ??
              svc.unit_price ??
              svc.unitPrice ??
              0,
          ),
          type: "service",
          barberId: appointmentBarberId
            ? Number(appointmentBarberId)
            : selectedBarberId
              ? Number(selectedBarberId)
              : null,
          barberName:
            barber?.display_name ||
            barber?.displayName ||
            barber?.full_name ||
            barber?.fullName ||
            "الخبير",
        };
      });

      setCart(newCart);
      setActiveAppointmentId(appointmentId);
      setSelectedCustomerId(String(appointment.customer_id || "walk_in"));
      // Auto-fill completed customer name for success screen
      setCompletedCustomerName(appointment.customer_name || "عميل");
      setIsReviewing(true);
      toast.success("تم تحميل بيانات الجلسة للمراجعة");
    },
    [
      barbers,
      selectedBarberId,
      setSelectedBarberId,
      setCart,
      setActiveAppointmentId,
      setSelectedCustomerId,
      setCompletedCustomerName,
      setIsReviewing,
    ],
  );

  // Virtualizer for large lists
  const virtualizer = useVirtualizer({
    count: readyAppointments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-black flex items-center gap-2">
          <Clock className="text-primary" size={20} />
          الجلسات الجاهزة
          <Badge
            variant="primary"
            className="rounded-full h-5 min-w-5 flex items-center justify-center text-[10px]"
          >
            {readyAppointments.length}
          </Badge>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchReadyAppointments}
          disabled={readyAppointmentsLoading}
          className="h-10 w-10 p-0 rounded-xl touch-target"
          aria-label="تحديث قائمة الجلسات"
        >
          <RefreshCw
            size={16}
            className={readyAppointmentsLoading ? "animate-spin" : ""}
          />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {readyAppointments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center h-full text-center opacity-40"
            >
              <div className="h-16 w-16 rounded-2xl bg-soft flex items-center justify-center mb-3">
                <ShoppingBag size={32} className="text-muted" />
              </div>
              <h3 className="text-base font-black text-muted">لا توجد جلسات</h3>
            </motion.div>
          ) : (
            <div
              ref={parentRef}
              className="h-full overflow-y-auto no-scrollbar touch-action-pan-y"
              style={{
                contain: "layout paint",
                willChange: "transform",
              }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => (
                  <motion.div
                    key={
                      readyAppointments[virtualRow.index]?.appointment_id ||
                      readyAppointments[virtualRow.index]?.id
                    }
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: virtualRow.index * 0.02 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      willChange: "transform",
                    }}
                  >
                    <SessionCard
                      appt={readyAppointments[virtualRow.index]}
                      index={virtualRow.index}
                      activeAppointmentId={activeAppointmentId}
                      handleLoadAppointment={handleLoadAppointment}
                      barbers={barbers}
                      formatCurrency={formatCurrency}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Separate SessionCard component for better memoization
const SessionCard = React.memo(
  ({
    appt,
    index: _index,
    activeAppointmentId,
    handleLoadAppointment,
    barbers: _barbers,
    formatCurrency,
  }: any) => {
    const appointmentId = appt.appointment_id || appt.id;
    const isActive = activeAppointmentId === appointmentId;

    return (
      <Card
        className={cn(
          "p-3 sm:p-4 group cursor-pointer transition-all duration-300 border border-border/50 rounded-2xl relative overflow-hidden bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
          isActive
            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
            : "hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
        )}
        onClick={() => handleLoadAppointment(appt)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleLoadAppointment(appt);
          }
        }}
        tabIndex={0}
        role="button"
        aria-pressed={isActive}
        aria-label={`جلسة ${appt.customer_name || "عميل مجهول"}، ${appt.appointment_time || "وقت غير محدد"}، ${formatCurrency(appt.total_estimated_price ?? appt.total_amount ?? 0)}`}
      >
        {/* Active Indicator */}
        {isActive && (
          <div className="absolute top-0 right-0 w-1 h-full bg-primary" />
        )}

        <div className="flex items-start justify-between relative z-10 gap-2">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                <User size={16} className="sm:size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                  {appt.customer_name || "عميل مجهول"}
                </h4>
                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                  <Badge
                    variant="secondary"
                    className="text-[7px] sm:text-[8px] font-black h-3.5 sm:h-4 px-1 bg-slate-100 dark:bg-white/10 text-slate-500 border-none"
                  >
                    #{appointmentId}
                  </Badge>
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-white/5 px-1 sm:px-1.5 py-0.5 rounded-md border border-slate-100 dark:border-white/5">
                    <Clock size={8} />
                    {(() => {
                      const timeStr = appt.appointment_time;
                      if (!timeStr) return "--:--";
                      const [h, m] = timeStr.split(":");
                      const d = new Date();
                      d.setHours(parseInt(h), parseInt(m), 0);
                      return d.toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      });
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-1.5 py-0.5 sm:py-1 rounded-lg bg-primary/5 border border-primary/10 max-w-full">
                <Zap size={10} className="text-primary shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-black text-primary truncate">
                  {appt.employee_name || appt.barber_name || "بدون خبير"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-left flex flex-col items-end gap-1.5 shrink-0">
            <div className="bg-white dark:bg-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl shadow-sm border border-slate-100 dark:border-white/5 group-hover:border-primary/20 transition-all">
              <p className="text-xs sm:text-base font-black text-primary tabular-nums">
                {formatCurrency(
                  appt.total_estimated_price ?? appt.total_amount ?? 0,
                )}
              </p>
            </div>
            <div className="flex items-center gap-1 text-primary text-[8px] sm:text-[9px] font-black opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 duration-300 uppercase">
              مراجعة <ChevronLeft size={10} strokeWidth={3} />
            </div>
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 flex flex-wrap gap-1 relative z-10">
          {(appt.services || []).map((svc, sIdx) => (
            <span
              key={sIdx}
              className="px-1.5 py-0.5 rounded-md sm:rounded-lg bg-white/50 dark:bg-white/5 text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-white/10 group-hover:border-primary/20 transition-all truncate max-w-[120px]"
            >
              {svc.service_name_snapshot || svc.service_name || svc.name}
            </span>
          ))}
        </div>
      </Card>
    );
  },
);

SessionCard.displayName = "SessionCard";

export default SessionsQueue;
