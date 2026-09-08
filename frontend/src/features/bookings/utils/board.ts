import { formatTime12h } from "@/lib/core/utils";
import { toast } from "react-hot-toast";

export const TODAY = new Date().toISOString().slice(0, 10);

export const normalizeStatus = (status) => {
  const value = String(status || "").toUpperCase();
  const map = {
    PENDING: "PENDING",
    SCHEDULED: "PENDING",
    WAITING: "ACTIVE_BOARD",
    CONFIRMED: "CONFIRMED",
    IN_PROGRESS: "ACTIVE_BOARD",
    COMPLETED: "ACTIVE_BOARD",
    READY_FOR_PAYMENT: "ACTIVE_BOARD",
    READY_FOR_POS: "ACTIVE_BOARD",
    DONE: "DONE",
    CANCELLED: "CANCELLED",
    AUTO_CANCELLED: "CANCELLED",
  };
  return map[value] || value;
};

export const rawStatus = (b) => String(b?.status || "").toLowerCase();

export const timeOnly = (t) => (t ? String(t).slice(0, 5) : "");

export const getExpectedEndTime = (startTime, durationMinutes) => {
  if (!startTime || !durationMinutes) return null;
  try {
    const [h, m] = startTime.split(":").map(Number);
    const end = new Date();
    end.setHours(h, m + durationMinutes);
    return end.toTimeString().slice(0, 5);
  } catch (err) {
    return startTime;
  }
};

export const statusConfig = (status) => {
  const normalized = normalizeStatus(status);
  return (
    {
      PENDING: {
        label: "قيد المراجعة",
        variant: "info",
        color: "text-sky-600 dark:text-sky-400",
        bg: "bg-sky-500/10 border-sky-500/20",
      },
      CONFIRMED: {
        label: "مؤكد ومجدول",
        variant: "warning",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
      },
      ACTIVE_BOARD: {
        label: "نشط بالاستقبال",
        variant: ("accent" as any),
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-500/10 border-indigo-500/20",
      },
      DONE: {
        label: "مكتمل ومغلق",
        variant: "success",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
      },
      CANCELLED: {
        label: "ملغي",
        variant: "danger",
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-500/10 border-rose-500/20",
      },
    }[normalized] || {
      label: normalized,
      variant: "outline",
      color: "text-slate-500",
      bg: "bg-slate-500/10 border-slate-500/20",
    }
  );
};

export const getBookingCustomerName = (booking) =>
  booking?.customerName || booking?.customer_name || "عميل مجهول";

export const DATE_FILTERS = [
  { id: "today", label: "اليوم" },
  { id: "tomorrow", label: "غداً" },
  { id: "after_tomorrow", label: "بعد غد" },
  { id: "this_week", label: "هذا الأسبوع" },
  { id: "all", label: "الكل" },
  { id: "custom", label: "تاريخ مخصص" },
];

// Unified tab categories — the single source of truth for the tab bar + stats
export const TAB_CATEGORIES = [
  { id: "الكل", label: "الكل" },
  { id: "بانتظار الخدمة", label: "بانتظار الخدمة" },
  { id: "عند الاستقبال", label: "عند الاستقبال" },
  { id: "أونلاين", label: "أونلاين" },
  { id: "الأرشيف", label: "الأرشيف" },
  { id: "الملغاة", label: "الملغاة" },
];

export const isOpenBooking = (b) => !["done", "cancelled"].includes(rawStatus(b));

export const matchesTab = (b, activeTab) => {
  const raw = rawStatus(b);
  switch (activeTab) {
    case "الكل":
      return isOpenBooking(b);
    case "بانتظار الخدمة":
      return ["pending", "confirmed", "waiting"].includes(raw);
    case "عند الاستقبال":
      return [
        "in_progress",
        "ready_for_payment",
        "ready_for_pos",
        "completed",
      ].includes(raw);
    case "أونلاين":
      return isOpenBooking(b) && b.booking_source === "online";
    case "الأرشيف":
      return raw === "done" || raw === "cancelled";
    case "الملغاة":
      return raw === "cancelled";
    default:
      return true;
  }
};

export const emptyForm = {
  customerId: "",
  customerName: "",
  customerPhone: "",
  employeeId: "",
  appointmentDate: TODAY,
  appointmentTime: "",
  notes: "",
  services: [],
  bookingSource: "shop",
};

// WhatsApp Message Automation Helper
export const sendWhatsAppMessage = (booking, type) => {
  const phone = String(booking.customer_phone || "").replace(/\D/g, "");
  if (!phone) return toast.error("رقم هاتف العميل غير متوفر");

  const name = getBookingCustomerName(booking);
  const time = formatTime12h(timeOnly(booking.appointment_time));
  const date = booking.appointment_date;
  const barber = booking.barber_name || "الخبير المختص";

  let message = "";
  if (type === "reminder") {
    message = `مرحباً ${name} 👋✨\nنود تذكيرك بموعدك اليوم ${date} في تمام الساعة ${time} مع الخبير (${barber}) في صالون Barber Luxe Pro.\nننتظر زيارتك بكل رحب وسرور! 💈✂️`;
  } else if (type === "confirm") {
    message = `أهلاً بك ${name} ✨\nتم تأكيد حجز موعدك بنجاح يوم ${date} الساعة ${time} مع الخبير (${barber}) في صالون Barber Luxe Pro.\nيسعدنا دائماً تقديم أرقى الخدمات لك! ✂️🌟`;
  } else if (type === "thank_you") {
    message = `عزيزنا ${name} 🌟\nسعدنا جداً بزيارتك اليوم في صالون Barber Luxe Pro!\nنأمل أن تكون التجربة والخدمة قد حازت على رضاك التام. نتطلع لرؤيتك مجدداً قريباً! ✨💈`;
  }

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
};
