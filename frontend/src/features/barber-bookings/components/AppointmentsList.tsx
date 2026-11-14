import { Calendar, Clock, Scissors, CheckCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { motion, AnimatePresence } from "framer-motion";
import {
  cn,
  formatCurrency,
} from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";
import { AppointmentStatusActions } from "@/components/shared/AppointmentStatusActions";
import type {
  BarberAppointment,
  StatusVariant,
} from "@/features/barber-bookings/hooks/useBarberBookings";
import { useAppLocale } from "@/hooks/useAppLocale";

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
  const { locale } = useAppLocale();

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
      <EmptyState variant="section" icon={Calendar} title="لا توجد مواعيد" message="لا توجد مواعيد مطابقة للفلاتر المحددة" />
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(groupedByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayApps]) => (
          <div key={date} className="space-y-2">
            <p className="text-xs font-black text-muted px-1">
              {new Date(date).toLocaleDateString(locale, {
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
                              {formatCurrency(String(apt.total_amount))}
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
                      <AppointmentStatusActions
                        status={apt.status}
                        onChange={(next) => handleStatusChange(apt.id, next)}
                      />
                    </div>
                  </div>
                  {apt.notes && (
                    <p className="mt-2 text-[10px] font-bold text-muted me-13">
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
