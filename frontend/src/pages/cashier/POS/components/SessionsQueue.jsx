import React from "react";
import { usePOS } from "../POSContext";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { 
  Clock, 
  User, 
  ShoppingBag, 
  ChevronLeft,
  RefreshCw,
  Zap
} from "lucide-react";
import { formatCurrency, cn } from "../../../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";

const SessionsQueue = () => {
  const { 
    readyAppointments, 
    readyAppointmentsLoading, 
    fetchReadyAppointments,
    setActiveAppointmentId,
    setIsReviewing,
    setCart,
    setSelectedCustomerId,
    setSelectedBarberId,
    setCompletedCustomerName,
    activeAppointmentId,
    barbers
  } = usePOS();

  const handleLoadAppointment = (appointment) => {
    const appointmentId = appointment.appointment_id || appointment.appointmentId || appointment.id;
    const appointmentBarberId = appointment.employee_id || appointment.employeeId || appointment.barber_id || appointment.barberId || "";
    
    // Auto-select the barber in the global dropdown as well
    if (appointmentBarberId) {
      setSelectedBarberId(String(appointmentBarberId));
    }
    
    const barber = barbers.find(b => String(b.id) === String(appointmentBarberId));

    const newCart = (appointment.services || []).map((svc) => {
      const serviceId = svc.service_id || svc.serviceId || svc.id;
      return {
        id: serviceId,
        serviceId,
        service_id: serviceId,
        uid: `appointment-${appointmentId}-service-${serviceId}-${Math.random()}`,
        name: svc.service_name || svc.serviceName || svc.name || "خدمة",
        price: Number(svc.price ?? svc.unit_price ?? svc.unitPrice ?? 0),
        type: "service",
        barberId: appointmentBarberId ? Number(appointmentBarberId) : (selectedBarberId ? Number(selectedBarberId) : null),
        barberName: barber?.display_name || barber?.displayName || barber?.full_name || barber?.fullName || "الخبير",
        };
        });

    setCart(newCart);
    setActiveAppointmentId(appointmentId);
    // Auto-fill completed customer name for success screen
    setCompletedCustomerName(appointment.customer_name || "عميل");
    setIsReviewing(true);
    toast.success("تم تحميل بيانات الجلسة للمراجعة");
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Clock className="text-primary" size={22} />
          الجلسات الجاهزة للدفع
          <Badge variant="primary" className="rounded-full h-6 min-w-6 flex items-center justify-center">
            {readyAppointments.length}
          </Badge>
        </h2>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={fetchReadyAppointments}
          disabled={readyAppointmentsLoading}
          className="h-9 w-9 p-0 rounded-xl"
        >
          <RefreshCw size={18} className={readyAppointmentsLoading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="flex-1 space-y-4">
        <AnimatePresence mode="popLayout">
          {readyAppointments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 text-center opacity-60"
            >
              <div className="h-20 w-20 rounded-3xl bg-soft flex items-center justify-center mb-4">
                <ShoppingBag size={40} className="text-muted" />
              </div>
              <h3 className="text-lg font-black text-muted">لا توجد جلسات حالياً</h3>
              <p className="text-xs font-bold text-muted mt-1">ستظهر الجلسات هنا فور انتهائها</p>
            </motion.div>
          ) : (
            readyAppointments.map((appt, index) => (
              <motion.div
                key={appt.appointment_id || appt.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className={cn(
                    "p-6 group cursor-pointer transition-all duration-300 border-2 rounded-[2rem] relative overflow-hidden",
                    activeAppointmentId === (appt.appointment_id || appt.id) 
                      ? "border-primary bg-primary/5 shadow-xl shadow-primary/10" 
                      : "border-slate-100 dark:border-white/5 bg-white dark:bg-white/5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5"
                  )}
                  onClick={() => handleLoadAppointment(appt)}
                >
                  {/* Active Indicator */}
                  {activeAppointmentId === (appt.appointment_id || appt.id) && (
                    <div className="absolute top-0 right-0 w-2 h-full bg-primary" />
                  )}

                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <User size={24} />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-main leading-tight">
                            {appt.customer_name || "عميل مجهول"}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] font-black h-4 px-1.5 border-slate-200 dark:border-white/10 opacity-70 uppercase tracking-tighter">
                              #{appt.appointment_id || appt.id}
                            </Badge>
                            <span className="text-[10px] font-bold text-muted bg-soft px-2 py-0.5 rounded-lg">
                              {appt.appointment_time || "--:--"}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-muted">
                        <div className="flex items-center gap-1.5">
                          <Zap size={14} className="text-primary" />
                          <span className="text-xs font-black text-main/80">
                            {appt.employee_name || appt.barber_name || "بدون خبير"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left flex flex-col items-end gap-2">
                      <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl">
                        <p className="text-xl font-black tabular-nums tracking-tighter">
                          {formatCurrency(appt.total_amount || 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-primary text-[11px] font-black opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        تحصيل ومعالجة <ChevronLeft size={14} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-5 flex flex-wrap gap-2 relative z-10">
                    {(appt.services || []).map((svc, sIdx) => (
                      <span 
                        key={sIdx}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 text-[10px] font-black text-muted border border-slate-100 dark:border-white/10 group-hover:border-primary/20 transition-colors"
                      >
                        {svc.service_name || svc.name}
                      </span>
                    ))}
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SessionsQueue;
