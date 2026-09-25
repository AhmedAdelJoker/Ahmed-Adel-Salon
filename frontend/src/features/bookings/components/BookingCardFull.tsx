import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Edit3,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { cn, formatTime12h } from "@/lib/core/utils";
import {
  TODAY,
  normalizeStatus,
  timeOnly,
  getExpectedEndTime,
  statusConfig,
  getBookingCustomerName,
  sendWhatsAppMessage,
} from "@/features/bookings";

/* ── REDESIGNED BOOKING CARD WITH EXPANDABLE SERVICES & ZERO DATA LOSS ── */
export default function BookingCardFull({
  booking,
  onEdit,
  onStatus,
  onActivate,
  onTransferToPOS,
  onOpenCustomer,
  onReschedule,
  canEdit,
  loading,
}: any) {
  const [showAllServices, setShowAllServices] = useState(false);
  const config = statusConfig(booking.status);
  const status = normalizeStatus(booking.status);
  const isOnline = booking.booking_source === "online";
  const isWalkIn = booking.booking_source === "walkin";

  const isToday = booking.appointment_date === TODAY;
  const now = new Date();
  const [h, m] = String(booking.appointment_time || "").split(":");
  const apptTime = new Date();
  apptTime.setHours(parseInt(h || "0"), parseInt(m || "0"), 0);

  const diffMinutes = Math.round((apptTime.getTime() - now.getTime()) / (1000 * 60));
  const isLate =
    isToday &&
    diffMinutes < 0 &&
    (status === "WAITING" || status === "CONFIRMED");
  const isLateHour = isLate && Math.abs(diffMinutes) > 60; // More than 1 hour late
  const isSoon =
    isToday &&
    diffMinutes > 0 &&
    diffMinutes <= 15 &&
    (status === "WAITING" || status === "CONFIRMED");

  const duration = booking.total_estimated_duration_minutes || 30;
  const expectedEnd = formatTime12h(
    getExpectedEndTime(timeOnly(booking.appointment_time), duration),
  );
  const servicesList = booking.services || [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative bg-card border border-border rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:shadow-premium hover:border-primary/30 flex flex-col justify-between gap-3.5 overflow-x-hidden overflow-y-visible min-w-0",
        isLateHour &&
          "bg-rose-500/[0.05] border-rose-500/40 ring-2 ring-rose-500/30",
        isLate &&
          !isLateHour &&
          "bg-rose-500/[0.03] border-rose-500/30 ring-1 ring-rose-500/20",
        isSoon &&
          "bg-amber-500/[0.03] border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.08)]",
      )}
    >
      {/* Late Warning Banner */}
      {isLateHour && (
        <div className="absolute top-0 left-0 right-0 bg-rose-600 text-white text-[10px] font-black text-center py-1 rounded-t-3xl">
          ⚠ متأخر أكثر من ساعة - يحتاج تفعيل أو إعادة جدولة
        </div>
      )}
      {/* Background Glow */}
      <div
        className={cn(
          "absolute top-0 right-0 w-28 h-28 blur-2xl opacity-10 transition-all duration-500 group-hover:opacity-25 -mr-10 -mt-10 rounded-full pointer-events-none",
          isOnline ? "bg-sky-500" : "bg-primary",
        )}
      />

      {/* Row 1: Customer Header & Direct Links */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
             <h4
               role="button"
               tabIndex={0}
               onClick={() => onOpenCustomer(booking.customer_id)}
               onKeyDown={(event) => {
                 if (event.key === "Enter" || event.key === " ") {
                   event.preventDefault();
                   onOpenCustomer(booking.customer_id);
                 }
               }}
               className="text-sm sm:text-base font-black text-main group-hover:text-primary transition-colors cursor-pointer flex items-center gap-1"

              title="عرض سجل العميل الكامل"
            >
              <span className="break-words leading-snug">
                {getBookingCustomerName(booking)}
              </span>
              <ExternalLink
                size={12}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0"
              />
            </h4>
            {booking.customer?.cancellation_count >= 3 && (
              <AlertTriangle
                size={14}
                className="text-amber-500 shrink-0"
                {...({ title: "عميل غير ملتزم" } as any)}
              />
            )}
            {booking.visit_count > 10 && (
              <Badge className="bg-amber-500 text-white text-[10px] font-black px-1.5 h-4 border-none shrink-0">
                VIP
              </Badge>
            )}
          </div>

          {/* Phone & WhatsApp Quick Menu */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted dir-ltr text-right">
              {booking.customer_phone || "غير متوفر"}
            </span>

            {booking.customer_phone && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-6 px-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1 text-[11px] font-black shadow-sm"
                    title="خيارات الرسائل الفورية عبر واتساب"
                  >
                    <MessageCircle size={12} />
                    <span>واتساب</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="rounded-2xl p-1.5 shadow-premium border-border"
                >
                  <DropdownMenuItem
                    onClick={() => sendWhatsAppMessage(booking, "reminder")}
                    className="text-xs font-bold cursor-pointer py-2 flex items-center gap-2"
                  >
                    <Clock size={14} className="text-amber-500" />
                    <span>إرسال تذكير بالموعد</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => sendWhatsAppMessage(booking, "confirm")}
                    className="text-xs font-bold cursor-pointer py-2 flex items-center gap-2"
                  >
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span>إرسال تأكيد الحجز</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => sendWhatsAppMessage(booking, "thank_you")}
                    className="text-xs font-bold cursor-pointer py-2 flex items-center gap-2"
                  >
                    <Sparkles size={14} className="text-primary" />
                    <span>إرسال رسالة شكر بعد الزيارة</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Source Badge & Late Alert Badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isOnline && (
            <Badge
              variant="outline"
              className="text-[10px] font-black text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 px-2 h-5"
            >
              ONLINE
            </Badge>
          )}
          {isWalkIn && (
            <Badge
              variant="outline"
              className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 px-2 h-5"
            >
              مشاة
            </Badge>
          )}
          {isLate && (
            <Badge className="text-[10px] font-black bg-rose-600 text-white border-none px-1.5 h-4 animate-pulse">
              متأخر {Math.abs(diffMinutes)} دقيقة
            </Badge>
          )}
        </div>
      </div>

      {/* Row 2: Structured Timing Pill & Date */}
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black border transition-all dir-ltr gap-2",
            isLate
              ? "bg-rose-600 text-white border-rose-600 shadow-md"
              : "bg-soft/70 border-border/60 text-main",
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock
              size={13}
              className={isLate ? "text-white" : "text-primary"}
            />
            <span className="whitespace-nowrap">
              {formatTime12h(timeOnly(booking.appointment_time))}
            </span>
            <span className="opacity-50 shrink-0">→</span>
            <span className="whitespace-nowrap">{expectedEnd}</span>
          </div>
          <span className="text-[11px] opacity-70 dir-rtl shrink-0">
            ({duration} د)
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px] font-bold text-muted px-1 gap-2">
          <span className="flex items-center gap-1 min-w-0 truncate">
            <Calendar size={11} /> {booking.appointment_date}
          </span>
          {booking.total_estimated_price > 0 && (
            <span className="text-primary font-black tabular-nums shrink-0">
              {booking.total_estimated_price} ج.م
            </span>
          )}
        </div>
      </div>

      {/* Row 3: ALL Services List (Scrollable / Expandable - NO Hidden Services!) */}
      <div className="space-y-1 relative z-10 min-w-0">
        <div
          className={cn(
            "flex flex-wrap gap-1.5 transition-all",
            !showAllServices && servicesList.length > 3
              ? "max-h-24 overflow-y-auto custom-scrollbar p-0.5"
              : "max-h-none",
          )}
        >
          {servicesList.map((s: any, i: number) => (
            <Badge
              key={i}
              variant="secondary"
              className="rounded-lg py-0.5 px-2 bg-soft border border-border/40 text-[11px] font-bold text-muted h-6 flex items-center"
            >
              {s.service_name_snapshot || "خدمة"}
            </Badge>
          ))}
        </div>

        {servicesList.length > 3 && (
          <button
            onClick={() => setShowAllServices(!showAllServices)}
            className="text-[11px] font-black text-primary hover:underline flex items-center gap-0.5 pt-0.5"
          >
            {showAllServices ? (
              <>
                <span>عرض أقل</span> <ChevronUp size={10} />
              </>
            ) : (
              <>
                <span>عرض كافة الخدمات ({servicesList.length})</span>{" "}
                <ChevronDown size={10} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Row 4: Barber Info & Status */}
      <div className="p-2.5 rounded-xl bg-soft/40 border border-border/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <EmployeeAvatar
            name={booking.barber_name}
            size="xs"
            className="h-7 w-7 rounded-lg border border-white shadow-sm shrink-0"
            imageUrl={undefined}
            role={undefined}
          />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted leading-none mb-0.5">
              الخبير المسؤول
            </p>
            <p className="text-xs font-black text-main break-words leading-tight">
              {booking.barber_name || "غير محدد"}
            </p>
          </div>
        </div>

        <Badge
          className={cn(
            "rounded-lg px-2 py-0.5 text-[10px] font-black border shrink-0",
            config.bg,
            config.color,
          )}
        >
          {config.label}
        </Badge>
      </div>

      {/* Row 5: Dynamic Integrated Actions (POS / Activation / Edit) */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
        <div className="flex items-center gap-2">
          {status !== "DONE" && status !== "CANCELLED" ? (
            <>
              {status === "WAITING" || status === "CONFIRMED" ? (
                <Button
                  onClick={() => onActivate(booking)}
                  loading={loading === `${booking.id}-activate`}
                  className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 min-w-0"
                >
                  <span className="whitespace-nowrap">
                    تفعيل ونقل للاستقبال
                  </span>
                  <ArrowUpRight size={14} className="shrink-0" />
                </Button>
              ) : (
                <Button
                  onClick={() => onTransferToPOS(booking)}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 min-w-0"
                >
                  <CreditCard size={14} className="shrink-0" />
                  <span className="whitespace-nowrap">تحويل لـ POS والدفع</span>
                </Button>
              )}

              <div className="flex gap-1 shrink-0">
                {canEdit && (
                  <Button
                    variant="ghost"
                    onClick={onEdit}
                    className="h-10 w-10 p-0 rounded-xl bg-soft text-muted hover:bg-card hover:text-primary border border-border/50"
                    title="تعديل الحجز"
                  >
                    <Edit3 size={15} />
                  </Button>
                )}
                {isLateHour && onReschedule && (
                  <Button
                    variant="ghost"
                    onClick={() => onReschedule(booking)}
                    className="h-10 w-10 p-0 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-600 hover:text-white border border-amber-500/20"
                    title="إعادة جدولة"
                  >
                    <Calendar size={15} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => onStatus(booking, "CANCELLED")}
                  className="h-10 w-10 p-0 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20"
                  title="إلغاء الحجز"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center h-10 rounded-xl bg-soft/40 border border-dashed border-border text-xs font-black text-muted">
              {status === "DONE" ? "حجز مكتمل ومغلق" : "حجز ملغي"}
            </div>
          )}
        </div>
        {!canEdit && status !== "DONE" && status !== "CANCELLED" && (
          <p className="text-[9px] font-bold text-rose-500 text-center">
            لا يمكن تعديل حجز يوم سابق - أنشئ حجز جديد
          </p>
        )}
      </div>
    </motion.div>
  );
}
