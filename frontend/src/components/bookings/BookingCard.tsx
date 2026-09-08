import {
  Clock,
  Edit3,
  Globe,
  Phone,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CalendarDays,
  Hash,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn, formatTime12h } from "@/lib/core/utils";
import {
  normalizeStatus,
  getStatusConfig,
  BOOKING_STATUS,
  isTerminal,
  calculateEndTime,
} from "@/lib/domain/bookings";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";

const TODAY = new Date().toISOString().slice(0, 10);

const getBookingCustomerName = (booking) =>
  booking?.customerName || booking?.customer_name || "عميل مجهول";

export default function BookingCard({
  booking,
  onEdit,
  onStatus,
  onActivate,
  loading,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}) {
  const config = getStatusConfig(booking.status);
  const status = normalizeStatus(booking.status);
  const isOnline = booking.booking_source === "online";
  const customerName = getBookingCustomerName(booking);

  const isToday = booking.appointment_date === TODAY;
  const now = new Date();
  const [h, m] = String(booking.appointment_time).split(":");
  const apptTime = new Date();
  apptTime.setHours(parseInt(h), parseInt(m), 0);

  const diffMinutes = (apptTime.getTime() - now.getTime()) / (1000 * 60);
  const isLate =
    isToday &&
    diffMinutes < 0 &&
    (status === BOOKING_STATUS.WAITING || status === BOOKING_STATUS.CONFIRMED);
  const isSoon =
    isToday &&
    diffMinutes > 0 &&
    diffMinutes <= 15 &&
    (status === BOOKING_STATUS.WAITING || status === BOOKING_STATUS.CONFIRMED);

  const duration = booking.total_estimated_duration_minutes || 30;
  const expectedEnd = formatTime12h(
    calculateEndTime(String(booking.appointment_time).slice(0, 5), duration),
  );

  const totalPrice = (booking.services || []).reduce(
    (sum, s) => sum + Number(s.price_snapshot || 0),
    0,
  );

  const ariaLabel = `حجز ${customerName} - ${config.label} - ${formatTime12h(String(booking.appointment_time).slice(0, 5))}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      role="article"
      aria-label={ariaLabel}
      className={cn(
        "group relative bg-card border border-border rounded-2xl transition-all duration-500 hover:shadow-premium hover:border-primary/20 overflow-hidden",
        isLate && "bg-rose-500/[0.02] border-rose-500/20",
        isSoon &&
          "bg-amber-500/[0.02] border-amber-500/20 shadow-[0_0_40px_rgba(245,158,11,0.05)]",
      )}
    >
      {/* Visual Decoration */}
      <div
        className={cn(
          "absolute top-0 right-0 w-32 h-32 blur-3xl opacity-[0.03] transition-all duration-700 group-hover:opacity-[0.08] -mr-16 -mt-16 rounded-full",
          isOnline ? "bg-sky-500" : "bg-primary",
        )}
      />

      {/* Status Ribbon */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 relative z-10">
        <div className="flex items-center gap-2">
          {isSelectionMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(booking.id);
              }}
              className={cn(
                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                isSelected
                  ? "bg-accent border-accent text-white"
                  : "border-border hover:border-accent",
              )}
              aria-label={
                isSelected
                  ? `إلغاء تحديد ${customerName}`
                  : `تحديد ${customerName}`
              }
              aria-pressed={isSelected}
            >
              {isSelected && <Check size={12} strokeWidth={3} />}
            </button>
          )}
          <Badge
            className={cn(
              "rounded-lg px-2.5 h-6 text-[10px] font-bold uppercase tracking-wide border-none",
              config.bg,
              config.color,
            )}
          >
            {config.label}
          </Badge>
          {isOnline && (
            <Badge
              variant="outline"
              className="text-[9px] font-black tracking-widest text-sky-600 bg-sky-50 border-sky-100 px-2 h-5"
            >
              ONLINE
            </Badge>
          )}
        </div>
        <span className="text-[10px] font-bold text-muted/60 flex items-center gap-1">
          <Hash size={10} />
          {booking.id}
        </span>
      </div>

      {/* Customer Section */}
      <div className="px-5 pb-3 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <EmployeeAvatar
              name={customerName}
              size="sm"
              className="h-10 w-10 rounded-xl border-2 border-white shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-main truncate leading-tight">
                  {customerName}
                </h4>
                {booking.customer?.cancellation_count >= 3 && (
                  <AlertTriangle
                    size={13}
                    className="text-amber-500 shrink-0"
                    aria-label="عميل غير ملتزم"
                  />
                )}
                {booking.visit_count > 10 && (
                  <Badge className="bg-amber-500 text-white text-[7px] font-black px-1.5 h-3.5 border-none animate-pulse">
                    VIP
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[11px] font-bold text-muted flex items-center gap-1"
                  dir="ltr"
                >
                  <Phone size={10} className="text-muted/40" />
                  {booking.customer_phone || "غير متوفر"}
                </span>
                {booking.customer_phone && (
                  <a
                    href={`https://wa.me/${String(booking.customer_phone).replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                    aria-label={`إرسال واتساب لـ ${customerName}`}
                  >
                    <Globe size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-border/50" />

      {/* Date & Time Section */}
      <div className="px-5 py-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarDays size={14} className="text-blue-500" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted uppercase tracking-wide">
                التاريخ
              </p>
              <p className="text-xs font-black text-main">
                {booking.appointment_date}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                isLate ? "bg-rose-50" : "bg-amber-50",
              )}
            >
              <Clock
                size={14}
                className={cn(isLate ? "text-rose-500" : "text-amber-500")}
              />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted uppercase tracking-wide">
                الوقت
              </p>
              <p
                className={cn(
                  "text-xs font-black tabular-nums",
                  isLate ? "text-rose-600" : "text-main",
                )}
              >
                {formatTime12h(String(booking.appointment_time).slice(0, 5))}
                <span className="text-muted mx-1">→</span>
                {expectedEnd}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-border/50" />

      {/* Services Section */}
      <div className="px-5 py-3 relative z-10">
        <p className="text-[9px] font-bold text-muted uppercase tracking-wide mb-2">
          الخدمات
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(booking.services || []).length > 0 ? (
            (booking.services || []).map((s, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="rounded-lg py-1 px-2.5 bg-soft border-none text-[10px] font-bold text-main flex items-center gap-1"
              >
                {s.service_name_snapshot || "خدمة"}
                {s.price_snapshot && (
                  <span className="text-muted/60">{s.price_snapshot}</span>
                )}
              </Badge>
            ))
          ) : (
            <span className="text-[10px] font-bold text-muted italic">
              لا توجد خدمات
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-border/50" />

      {/* Barber Section */}
      <div className="px-5 py-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <EmployeeAvatar
              name={booking.barber_name}
              size="xs"
              className="h-8 w-8 rounded-lg border-2 border-white shadow-sm"
            />
            <div>
              <p className="text-[9px] font-bold text-muted uppercase tracking-wide">
                الخبير المسؤول
              </p>
              <p className="text-xs font-bold text-main">
                {booking.barber_name || "غير محدد"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Price Section */}
      {totalPrice > 0 && (
        <>
          <div className="mx-5 h-px bg-border/50" />
          <div className="px-5 py-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-muted uppercase tracking-wide">
                السعر الإجمالي
              </span>
              <span className="text-sm font-black text-accent tabular-nums">
                {totalPrice}{" "}
                <span className="text-[10px] font-bold opacity-50">ج.م</span>
              </span>
            </div>
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="px-5 py-4 relative z-10 bg-soft/30 border-t border-border/30">
        {!isTerminal(status) ? (
          <div className="flex gap-2">
            {status === BOOKING_STATUS.WAITING ||
            status === BOOKING_STATUS.CONFIRMED ||
            status === BOOKING_STATUS.PENDING ? (
              <Button
                onClick={() => onActivate(booking)}
                loading={loading === `${booking.id}-activate`}
                className="flex-1 h-10 rounded-xl bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex gap-2"
              >
                تفعيل وإرسال للاستقبال <ArrowUpRight size={14} />
              </Button>
            ) : (
              <div className="flex-1 flex items-center justify-center h-10 rounded-xl bg-white border border-dashed border-border">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wide">
                  {status === BOOKING_STATUS.IN_PROGRESS
                    ? "الحجز نشط حالياً"
                    : "بانتظار الدفع"}
                </span>
              </div>
            )}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                onClick={onEdit}
                className="h-10 w-10 rounded-xl bg-white text-muted hover:bg-primary hover:text-white border border-border/60 transition-all"
                aria-label="تعديل الحجز"
              >
                <Edit3 size={16} />
              </Button>
              <Button
                variant="ghost"
                onClick={() => onStatus(booking, "CANCELLED")}
                className="h-10 w-10 rounded-xl bg-white text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/10 transition-all"
                aria-label="إلغاء الحجز"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-10 rounded-xl bg-white border border-dashed border-border">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wide">
              {status === BOOKING_STATUS.DONE ? "حجز مكتمل ومغلق" : "حجز ملغي"}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
