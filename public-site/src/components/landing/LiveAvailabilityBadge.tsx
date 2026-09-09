import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Users, Clock3, Sparkles } from "lucide-react";
import { useRealtimeBooking } from "../../hooks/useRealtimeBooking";

/**
 * LiveAvailabilityBadge — Real-time indicator of "people booking now".
 * - Shows: "3 people booking right now" with live count
 * - Animated pulse on updates
 * - Fades out after 10s of no activity
 */
export interface RecentBookingEvent {
  ts?: number;
  customerName?: string;
  serviceName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface LiveAvailabilityBadgeProps {
  salonSlug?: string;
  className?: string;
}

export default function LiveAvailabilityBadge({ salonSlug, className = "" }: LiveAvailabilityBadgeProps) {
  const [viewers, setViewers] = useState(0);
  const [recentBookings, setRecentBookings] = useState<RecentBookingEvent[]>([]);
  const [pulse, setPulse] = useState(false);

  const { status, lastEvent } = useRealtimeBooking({
    salonSlug,
    onEvent: (event) => {
      if (event.type === "booking.created" || event.type === "booking.confirmed") {
        const data = (event.data ?? {}) as RecentBookingEvent;
        setRecentBookings((prev) => [
          { ...data, ts: Date.now() },
          ...prev.slice(0, 4),
        ]);
        setViewers((v) => v + 1);
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
      }
    },
  });

  // Simulated viewer count for demo (replace with real data)
  useEffect(() => {
    if (!salonSlug) return;
    const base = Math.floor(Math.random() * 5) + 2; // 2-6
    setViewers(base);
    const interval = setInterval(() => {
      setViewers((v) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(0, Math.min(12, v + delta));
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [salonSlug]);

  // Auto-remove old recent bookings
  useEffect(() => {
    if (recentBookings.length === 0) return;
    const timer = setTimeout(() => {
      setRecentBookings((prev) => prev.filter((b) => Date.now() - (b.ts ?? 0) < 30000));
    }, 5000);
    return () => clearTimeout(timer);
  }, [recentBookings]);

  if (viewers === 0 && recentBookings.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`inline-flex flex-col gap-2 ${className}`}
      >
        {/* Live activity badge */}
        <motion.div
          animate={pulse ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <Activity size={12} className="text-emerald-500" />
          <span className="text-xs font-black text-emerald-500 uppercase tracking-wider">
            Live • {viewers} {viewers === 1 ? "شخص" : "أشخاص"} يحجزون الآن
          </span>
        </motion.div>

        {/* Recent booking notifications */}
        <AnimatePresence>
          {recentBookings.slice(0, 1).map((booking) => (
            <motion.div
              key={booking.ts}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 backdrop-blur-md"
            >
              <Sparkles size={12} className="text-[#D4AF37]" />
              <span className="text-xs font-bold text-[#D4AF37]">
                للتو: {booking.customerName || "عميل"} حجز {booking.serviceName || "موعد"}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Connection status (debug) */}
        {import.meta.env.DEV && (
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            [{status}]
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
