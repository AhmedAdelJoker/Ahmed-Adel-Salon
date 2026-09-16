import { Button } from "@/components/ui/button";
import { User, CheckCircle, Pause, Play, MessageSquare, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

interface TimerCardAppointment {
  customer_name: string;
  service_name: string;
  customer_phone?: string | null;
  total_amount?: number | null;
  notes?: string | null;
}

interface TimerCardProps {
  elapsedTime: number;
  timerRunning: boolean;
  formatTime: (seconds: number) => string;
  formatCurrency: (value: unknown) => string;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onComplete: () => void;
  appointment: TimerCardAppointment;
}

export const TimerCard = ({
  elapsedTime,
  timerRunning,
  formatTime,
  formatCurrency,
  onStartTimer,
  onPauseTimer,
  onComplete,
  appointment,
}: TimerCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 md:p-8 shadow-xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
      <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Timer Display */}
        <div className="text-center md:text-left flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            مدة الخدمة
          </p>
          <div className="font-mono text-5xl md:text-7xl font-black text-white tabular-nums tracking-tighter">
            {formatTime(elapsedTime)}
          </div>
          <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
            {!timerRunning && elapsedTime === 0 ? (
              <Button
                size="lg"
                className="h-14 w-14 rounded-full bg-success text-white shadow-lg"
                onClick={onStartTimer}
              >
                <Play size={24} />
              </Button>
            ) : timerRunning ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 w-14 rounded-full border-warning text-warning"
                  onClick={onPauseTimer}
                >
                  <Pause size={24} />
                </Button>
                <Button
                  size="lg"
                  className="h-14 w-14 rounded-full bg-success text-white shadow-lg"
                  onClick={onComplete}
                >
                  <CheckCircle size={24} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="h-14 w-14 rounded-full bg-primary text-white shadow-lg"
                  onClick={onStartTimer}
                >
                  <Play size={24} />
                </Button>
                <Button
                  size="lg"
                  className="h-14 w-14 rounded-full bg-success text-white shadow-lg"
                  onClick={onComplete}
                >
                  <CheckCircle size={24} />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Client Info */}
        <div className="md:w-80 flex-shrink-0">
          <div className="bg-white/5 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center">
                <User size={24} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-white truncate">
                  {appointment.customer_name}
                </p>
                <p className="text-xs text-slate-400">
                  {appointment.service_name}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <MessageSquare size={14} />{" "}
                {appointment.customer_phone || "---"}
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <DollarSign size={14} />{" "}
                {appointment.total_amount
                  ? formatCurrency(appointment.total_amount)
                  : "---"}
              </div>
              {appointment.notes && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">
                    ملاحظات العميل
                  </p>
                  <p className="text-white text-sm">{appointment.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
