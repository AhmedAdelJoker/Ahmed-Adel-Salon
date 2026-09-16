import { useState, useEffect, useCallback } from "react";
import { barberService } from "@/services/barberService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Calendar, Clock, Clock3, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface ScheduleWorkingHours {
  open_time?: string | null;
  close_time?: string | null;
  is_open?: boolean;
  [key: string]: unknown;
}

interface ScheduleAppointment {
  id: string | number;
  customer_name: string;
  start_time: string;
  service_name: string;
  status: string;
  notes?: string | null;
  [key: string]: unknown;
}

interface ScheduleData {
  working_hours?: ScheduleWorkingHours | null;
  appointments?: ScheduleAppointment[];
  [key: string]: unknown;
}

export const BarberSchedule = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);

      const dateParam = selectedDate;
      const res = await (barberService.getSchedule as unknown as (date: string) => Promise<ScheduleData>)(dateParam);
      setSchedule(res);
    } catch (err) {
      console.error("Schedule fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    waiting: "في الانتظار",
    "in-service": "قيد الخدمة",
    completed: "مكتمل",
    ready_for_payment: "جاهز للدفع",
    cancelled: "ملغي",
  };

  const statusColors: Record<string, "warning" | "info" | "success" | "danger" | "secondary"> = {
    pending: "warning",
    waiting: "warning",
    "in-service": "info",
    completed: "success",
    ready_for_payment: "success",
    cancelled: "danger",
  };

  return (
    <div className="space-y-4">
      {/* Date Selector */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <CalendarDays size={18} className="text-primary" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 rounded-xl border border-border bg-soft px-3 text-sm font-bold"
          />
          <Button
            variant="outline"
            className="h-10 rounded-xl text-xs"
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
          >
            اليوم
          </Button>
        </div>
      </div>

      {/* Working Hours */}
      {schedule?.working_hours && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
          <Clock3 size={16} className="text-primary" />
          <span className="text-xs font-bold text-main">
            ساعات العمل: {schedule.working_hours.open_time || "--:--"} - {schedule.working_hours.close_time || "--:--"}
          </span>
          {schedule.working_hours.is_open === false && (
            <Badge variant="danger" className="h-5 text-[8px] font-black">
              عطلة
            </Badge>
          )}
        </div>
      )}

      {/* Appointments */}
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-black text-main flex items-center gap-2">
            <Calendar size={16} className="text-primary" /> مواعيد يوم{" "}
            {new Date(selectedDate).toLocaleDateString("ar-EG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw size={24} className="mx-auto mb-3 text-muted animate-spin" />
              <p className="text-xs font-bold text-muted">جاري التحميل...</p>
            </div>
          ) : schedule?.appointments && schedule.appointments.length > 0 ? (
            schedule.appointments.map((apt, i) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 hover:bg-soft/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-soft flex items-center justify-center">
                      <Clock size={16} className="text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-main">{apt.customer_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-muted">{apt.start_time}</span>
                        <Badge variant="outline" className="h-5 px-2 text-[8px] font-black">
                          {apt.service_name}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Badge variant={statusColors[apt.status] || "secondary"} className="h-6 px-3 text-[9px] font-black">
                    {statusLabels[apt.status] || apt.status}
                  </Badge>
                </div>
                {apt.notes && <p className="mt-2 text-[10px] font-bold text-muted mr-13">{apt.notes}</p>}
              </motion.div>
            ))
          ) : (
            <div className="p-8 text-center">
              <Calendar size={40} className="mx-auto mb-3 text-muted" />
              <p className="text-sm font-black text-main">لا توجد مواعيد</p>
              <p className="text-xs font-bold text-muted">لا توجد مواعيد في هذا اليوم</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
