import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock3,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  ChevronRight,
} from "lucide-react";
import { useMemberAuth } from "../../context/MemberAuthContext";
import api from "../../services/api";

/**
 * MemberHistorySection — Shows member's booking history.
 * - Only visible when authenticated
 * - Fetches from /public/member/bookings
 * - Color-coded by status
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BookingRecord = Record<string, any>;

const STATUS_STYLES: Record<string, { label: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; color: string; bg: string }> = {
  confirmed: { label: "مؤكد", icon: CheckCircle2, color: "#10B981", bg: "rgba(16,185,129,0.1)" },
  pending: { label: "قيد المراجعة", icon: Loader2, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  cancelled: { label: "ملغي", icon: XCircle, color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  completed: { label: "مكتمل", icon: CheckCircle2, color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
};

export interface MemberHistorySectionProps {
  onLogin?: () => void;
}

export default function MemberHistorySection({ onLogin }: MemberHistorySectionProps) {
  const { isAuthenticated } = useMemberAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      setBookings([]);
      return;
    }
    setLoading(true);
    setError("");
    const token = localStorage.getItem("salon-member-token");
    api
      .get("/public/member/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setBookings(Array.isArray(res.data) ? res.data : res.data?.items || []);
      })
      .catch((err) => {
        setError(err.message || "فشل تحميل الحجوزات");
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  // Don't show if not logged in
  if (!isAuthenticated) {
    return (
      <section className="py-16 px-6" id="member-history">
        <div
          className="max-w-2xl mx-auto text-center p-10 rounded-3xl border border-dashed"
          style={{ borderColor: "rgba(212,175,55,0.3)" }}
        >
          <User size={32} className="text-[#D4AF37] mx-auto mb-4" />
          <h3 className="text-xl font-black text-white mb-2">سجل حجوزاتك</h3>
          <p className="text-sm font-bold text-slate-400 mb-5">
            سجّل دخول لرؤية جميع حجوزاتك السابقة والحالية
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="h-12 px-8 rounded-2xl font-black text-sm"
            style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
          >
            دخول / تسجيل
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-6" id="member-history">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#D4AF37] mb-1">
              My Bookings
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              سجل حجوزاتي
            </h2>
          </div>
          <span className="text-sm font-bold text-slate-500">
            {bookings.length} حجز
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm font-bold text-rose-500">
            {error}
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="text-center py-12 rounded-3xl border border-dashed border-white/10">
            <Calendar size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">لا توجد حجوزات بعد</p>
          </div>
        )}

        <div className="space-y-3">
          {bookings.map((booking, index) => {
            const status = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;
            const StatusIcon = status.icon;
            return (
              <motion.div
                key={booking.id || index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-[#17171A] hover:border-[#D4AF37]/30 transition-all cursor-pointer"
              >
                {/* Date badge */}
                <div className="shrink-0 h-14 w-14 rounded-2xl flex flex-col items-center justify-center border border-white/10"
                  style={{ backgroundColor: "rgba(212,175,55,0.1)" }}
                >
                  <span className="text-[10px] font-black uppercase text-[#D4AF37] tracking-wider">
                    {new Date(booking.scheduledAt || booking.date).toLocaleDateString("ar-EG", {
                      month: "short",
                    })}
                  </span>
                  <span className="text-xl font-black text-white leading-none">
                    {new Date(booking.scheduledAt || booking.date).getDate()}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-black text-white truncate">
                    {booking.serviceName || booking.service || "خدمة"}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock3 size={12} />
                      {new Date(booking.scheduledAt || booking.date).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {booking.barberName && (
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {booking.barberName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div
                  className="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border"
                  style={{
                    backgroundColor: status.bg,
                    color: status.color,
                    borderColor: `${status.color}40`,
                  }}
                >
                  <StatusIcon size={12} className={booking.status === "pending" ? "animate-spin" : ""} />
                  {status.label}
                </div>

                <ChevronRight size={16} className="text-slate-600 group-hover:text-[#D4AF37] transition-colors shrink-0" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
