import { Calendar, Clock, Scissors, CheckCircle, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  BarberAppointment,
  StatusVariant,
} from "@/features/barber-bookings/hooks/useBarberBookings";

interface AppointmentsListProps {
  loading: boolean;
  filteredAppointments: BarberAppointment[];
  groupedByDate: Record<string, BarberAppointment[]>;
  handleStatusChange: (id: string | number, newStatus: string) => void;
  statusLabels: Record<string, string>;
  statusColors: Record<string, StatusVariant>;
}

export const AppointmentsList = ({
  loading,
  filteredAppointments,
  groupedByDate,
  handleStatusChange,
  statusLabels,
  statusColors,
}: AppointmentsListProps) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-card border border-border animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (filteredAppointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
        <Calendar size={40} className="mb-3 text-muted" />
        <p className="text-base font-black text-main">لا توجد مواعيد</p>
        <p className="mt-1 text-xs font-bold text-muted">
          لا توجد مواعيد مطابقة للفلاتر المحددة
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(groupedByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayApps]) => (
          <div key={date} className="space-y-2">
            <p className="text-xs font-black text-muted px-1">
              {new Date(date).toLocaleDateString("ar-EG", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <AnimatePresence>
              {dayApps.map((apt, i) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-xl border border-border bg-card p-4 shadow-soft hover:shadow-premium transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center",
                          apt.status === "waiting"
                            ? "bg-warning/10 text-warning"
                            : apt.status === "in-service"
                              ? "bg-info/10 text-info"
                              : apt.status === "completed" ||
                                  apt.status === "ready_for_payment"
                                ? "bg-success/10 text-success"
                                : "bg-soft text-muted",
                        )}
                      >
                        {apt.status === "waiting" ? (
                          <Clock size={18} />
                        ) : apt.status === "in-service" ? (
                          <Scissors size={18} />
                        ) : (
                          <CheckCircle size={18} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-main">
                          {apt.customer_name || "عميل"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="outline"
                            className="h-5 px-2 text-[8px] font-black"
                          >
                            {apt.service_name || "خدمة"}
                          </Badge>
                          <span className="text-[10px] font-bold text-muted">
                            {apt.start_time || "--:--"}
                          </span>
                          {(typeof apt.total_amount === "number"
                            ? apt.total_amount
                            : Number(apt.total_amount || 0)) > 0 && (
                            <span className="text-[10px] font-bold text-primary">
                              {String(apt.total_amount)} ج.م
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={statusColors[apt.status] || "secondary"}
                        className="h-6 px-3 text-[9px] font-black"
                      >
                        {statusLabels[apt.status] || apt.status}
                      </Badge>
                      {apt.status === "waiting" && (
                        <Button
                          size="sm"
                          className="h-8 rounded-lg px-3 text-[10px] font-black"
                          onClick={() => handleStatusChange(apt.id, "in-service")}
                        >
                          <Play size={10} className="ml-1" /> بدء
                        </Button>
                      )}
                      {apt.status === "in-service" && (
                        <Button
                          size="sm"
                          variant="success"
                          className="h-8 rounded-lg px-3 text-[10px] font-black"
                          onClick={() => handleStatusChange(apt.id, "completed")}
                        >
                          <CheckCircle size={10} className="ml-1" /> إنهاء
                        </Button>
                      )}
                    </div>
                  </div>
                  {apt.notes && (
                    <p className="mt-2 text-[10px] font-bold text-muted mr-13">
                      📝 {String(apt.notes)}
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ))}
    </div>
  );
};
