import { Calendar, Clock, Scissors, CheckCircle } from "lucide-react";
import { PremiumCard } from "@/components/shared/PremiumUI";
import type { BarberAppointment } from "@/features/barber-bookings/hooks/useBarberBookings";

interface QuickStatsProps {
  appointments: BarberAppointment[];
}

export const QuickStats = ({ appointments }: QuickStatsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <PremiumCard className="p-3" delay={0}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Calendar size={14} />
          </div>
          <div>
            <p className="text-[8px] font-bold uppercase text-muted">الكلي</p>
            <p className="text-lg font-black text-main">{appointments.length}</p>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="p-3" delay={0.1}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
            <Clock size={14} />
          </div>
          <div>
            <p className="text-[8px] font-bold uppercase text-muted">قيد الانتظار</p>
            <p className="text-lg font-black text-main">
              {appointments.filter((a) => a.status === "waiting").length}
            </p>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="p-3" delay={0.2}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-info/10 text-info flex items-center justify-center">
            <Scissors size={14} />
          </div>
          <div>
            <p className="text-[8px] font-bold uppercase text-muted">قيد الخدمة</p>
            <p className="text-lg font-black text-main">
              {appointments.filter((a) => a.status === "in-service").length}
            </p>
          </div>
        </div>
      </PremiumCard>
      <PremiumCard className="p-3" delay={0.3}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
            <CheckCircle size={14} />
          </div>
          <div>
            <p className="text-[8px] font-bold uppercase text-muted">مكتمل</p>
            <p className="text-lg font-black text-main">
              {
                appointments.filter(
                  (a) =>
                    a.status === "completed" || a.status === "ready_for_payment",
                ).length
              }
            </p>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
};
