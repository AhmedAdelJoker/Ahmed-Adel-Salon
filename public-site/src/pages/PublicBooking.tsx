import { useEffect, useState, useMemo } from "react";
import {
  ArrowRight,
  CalendarDays,
  Scissors,
  CheckCircle2,
  User,
  ChevronLeft,
  Sparkles,
  Zap,
  Timer,
  Clock3,
  WalletCards,
  BadgeCheck,
  MapPin,
  Phone,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { formatCurrency, formatTime12h, getApiErrorMessage } from "../lib/utils";
import api from "../services/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  buildPublicSalonPath,
  buildPublicBookingPath,
  resolvePublicSlug,
} from "../lib/publicSite";

const BOOKING_STEPS = [
  { id: 1, label: "الخدمات", hint: "اختر ما يناسبك من القائمة" },
  { id: 2, label: "الحلاق", hint: "حدد المختص أو اتركه متاحًا" },
  { id: 3, label: "الموعد", hint: "اختر اليوم والوقت المناسبين" },
  { id: 4, label: "البيانات", hint: "أكد معلوماتك قبل الإرسال" },
];

const STATIC_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
  : "http://localhost:8000";

const THEMES = {
  midnight: {
    primary: "#D4AF37", // Champagne Gold
    secondary: "#B08D26", // Deep Gold
    accent: "#F8FAFC", // Ice White
    bg: "#09090B", // Midnight Black
    card: "#17171A", // Dark Zinc
    dark: "#FFFFFF", // Contrast White
    text: "#F8FAFC", // Ice White
    muted: "#94A3B8", // Slate Gray
  },
  gold: {
    primary: "#D4AF37", // True Royal Gold
    secondary: "#A67C00", // Warm Bronze
    accent: "#FDFBF7", // Crisp Ivory
    bg: "#FAFAF7", // Cleaner Cream background
    card: "#FFFFFF", // Pure White
    dark: "#110E0A", // Very dark brown/black
    text: "#241E15", // Deep Charcoal Brown
    muted: "#8C7A61", // Rich Taupe
  },
  silver: {
    primary: "#E2E8F0", // Ice Silver Glow
    secondary: "#94A3B8", // Slate Blue
    accent: "#F8FAFC", // Crisp Snow
    bg: "#F1F5F9", // Cool Gray background
    card: "#FFFFFF", // Pure White
    dark: "#0F172A", // Midnight Slate
    text: "#1E293B", // Slate Charcoal
    muted: "#64748B", // Slate Gray
  },
};

const slideVariants = {
  enter: (dir) => ({
    x: dir > 0 ? 50 : -50,
    opacity: 0,
    filter: "blur(10px)"
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 100, damping: 20 }
  },
  exit: (dir) => ({
    x: dir > 0 ? -50 : 50,
    opacity: 0,
    filter: "blur(10px)",
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
  })
};

export interface CatalogService {
  id?: string | number;
  service_id?: string | number;
  name?: string;
  name_ar?: string;
  price?: number | string;
  duration_minutes?: number | string;
  duration?: number | string;
  category_id?: string | number;
  description?: string;
  description_ar?: string;
  [key: string]: unknown;
}

export interface CatalogBarber {
  id?: string | number;
  display_name?: string;
  profile_image_url?: string;
  job_title?: string;
  [key: string]: unknown;
}

export interface CatalogBusiness {
  salon_name?: string;
  salonName?: string;
  shop_phone?: string;
  shopPhone?: string;
  address?: string;
  logo_url?: string;
  logoUrl?: string;
  currency?: string;
  landing_theme_id?: string;
  landingThemeId?: string;
  [key: string]: unknown;
}

export interface BookingServiceItem {
  service_id: string | number;
  quantity: number;
}

export interface BookingFormData {
  services: BookingServiceItem[];
  barber_id: string | number | null;
  appointment_date: string;
  appointment_time: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  notes: string;
}

export default function PublicBooking({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { publicSlug } = useParams();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalog, setCatalog] = useState<{
    services: CatalogService[];
    categories: { id?: string | number; [key: string]: unknown }[];
    barbers: CatalogBarber[];
    business: CatalogBusiness;
  }>({
    services: [],
    categories: [],
    barbers: [],
    business: {},
  });

  const settings = catalog.business;
  const theme = THEMES[settings?.landing_theme_id ?? ""] || THEMES[settings?.landingThemeId ?? ""] || THEMES.midnight;

  const [bookingData, setBookingData] = useState<BookingFormData>({
    services: [],
    barber_id: null,
    appointment_date: "",
    appointment_time: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const confettiArray = useMemo(() => {
    return Array.from({ length: 45 }).map((_, idx) => ({
      id: idx,
      x: Math.random() * 500 - 250,
      y: Math.random() * -350 - 150,
      rotation: Math.random() * 360,
      color: ["#B0762D", "#C5A880", "#10B981", "#D4AF37", "#17110E"][idx % 5],
      size: Math.random() * 10 + 6,
      delay: Math.random() * 0.3
    }));
  }, [step]);

  const selectedServices = bookingData.services
    .map((selected) =>
      (catalog?.services || []).find((service) => service.id === selected.service_id),
    )
    .filter((s): s is CatalogService => Boolean(s));
  const bookingTotal = selectedServices.reduce(
    (sum, service) => sum + Number(service?.price || 0),
    0,
  );
  const selectedDuration = selectedServices.reduce(
    (sum, service) => sum + Number(service?.duration_minutes || service?.duration || 0),
    0,
  );
  const progressPercentage = step >= 5 ? 100 : Math.max(25, (Math.min(step, 4) / 4) * 100);
  const selectedBarber =
    (catalog?.barbers || []).find((barber) => barber.id === bookingData.barber_id)
      ?.display_name || "أي حلاق متاح";

  const morningSlots = availableSlots.filter((s) => {
    const h = parseInt(s.split(":")[0], 10);
    return h < 12;
  });
  const afternoonSlots = availableSlots.filter((s) => {
    const h = parseInt(s.split(":")[0], 10);
    return h >= 12 && h < 17;
  });
  const eveningSlots = availableSlots.filter((s) => {
    const h = parseInt(s.split(":")[0], 10);
    return h >= 17;
  });
  const currentStepMeta =
    BOOKING_STEPS.find((item) => item.id === Math.min(step, 4)) ||
    BOOKING_STEPS[0];
  const business = catalog?.business || {};
  const salonName = business.salon_name || business.salonName || "Barber Luxe";
  const homePath = publicSlug ? buildPublicSalonPath(business) : "/";
  const bookingPath = publicSlug ? buildPublicBookingPath(business) : "/book";
  const phoneValue = business.shop_phone || business.shopPhone || "";
  const addressValue = business.address || "يرجى إضافة عنوان المحل من الإعدادات";
  const resolveAssetUrl = (value) => {
    if (!value) return null;
    return String(value).startsWith("http") ? value : `${STATIC_URL}${value}`;
  };
  const logoImage = resolveAssetUrl(business.logo_url || business.logoUrl);

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    const business = catalog?.business || {};
    if (!publicSlug || !Object.keys(business).length) return;
    const expectedSlug = resolvePublicSlug(business);
    if (publicSlug !== expectedSlug) {
      navigate(buildPublicBookingPath(business), { replace: true });
    }
  }, [catalog, navigate, publicSlug]);

  async function fetchCatalog() {
    try {
      setLoading(true);
      const res = await api.get("/public/booking-catalog");
      setCatalog(res?.data || {});
    } catch (_error) {
      toast.error("فشل تحميل البيانات، يرجى المحاولة لاحقاً");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlots(date) {
    if (!date) return;
    try {
      setSlotsLoading(true);
      const serviceIds = bookingData.services.map((service) => service.service_id);
      const res = await api.get("/public/time-slots", {
        params: {
          booking_date: date,
          barber_id: bookingData.barber_id,
          service_ids: serviceIds,
        },
      });
      setAvailableSlots(
        res?.data?.available_slots ||
          (res as { available_slots?: unknown })?.available_slots ||
          [],
      );
    } catch (_error) {
      toast.error("فشل جلب الأوقات المتاحة");
    } finally {
      setSlotsLoading(false);
    }
  }

  function toggleService(serviceId) {
    setBookingData((prev) => {
      const exists = prev.services.find(
        (service) => service.service_id === serviceId,
      );
      if (exists) {
        return {
          ...prev,
          services: prev.services.filter(
            (service) => service.service_id !== serviceId,
          ),
        };
      }
      return {
        ...prev,
        services: [...prev.services, { service_id: serviceId, quantity: 1 }],
      };
    });
  }

  function handleDateChange(event) {
    const date = event.target.value;
    setBookingData((prev) => ({
      ...prev,
      appointment_date: date,
      appointment_time: "",
    }));
    fetchSlots(date);
  }

  function nextStep() {
    if (step === 1 && bookingData.services.length === 0) {
      toast.error("يرجى اختيار خدمة واحدة على الأقل");
      return;
    }
    if (step === 3 && (!bookingData.appointment_date || !bookingData.appointment_time)) {
      toast.error("يرجى اختيار التاريخ والوقت");
      return;
    }
    setDirection(1);
    setStep((current) => current + 1);
  }

  function prevStep() {
    setDirection(-1);
    setStep((current) => current - 1);
  }

  async function handleSubmit() {
    if (!bookingData.first_name || !bookingData.phone) {
      toast.error("يرجى إدخال الاسم الأول ورقم الهاتف");
      return;
    }

    try {
      setSubmitting(true);
      
      const submissionData = {
        ...bookingData,
        salon_slug: publicSlug,
        email: bookingData.email?.trim() === "" ? null : bookingData.email
      };

      await api.post("/public/booking", submissionData);
      setDirection(1);
      setStep(5);
      toast.success("تم تسجيل حجزك بنجاح");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "فشل تسجيل الحجز"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen relative flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: theme.bg }}
      >
        <div className="relative flex flex-col items-center gap-6">
           <div className="h-20 w-20 rounded-[2rem] flex items-center justify-center shadow-2xl animate-bounce" style={{ backgroundColor: theme.dark, color: theme.primary }}>
              <Scissors size={40} />
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse" style={{ color: theme.primary }}>Refining Booking Canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${embedded ? "rounded-[3rem] border p-5 shadow-soft backdrop-blur-xl sm:p-10" : "min-h-screen px-4 py-20 sm:px-10"} relative overflow-hidden transition-colors duration-700`}
      style={{ backgroundColor: theme.bg, color: theme.text, borderColor: `${theme.primary}15` }}
      dir="rtl"
    >
      {/* Luxury Animated Ambient Background Blobs - Optimized */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <motion.div
          animate={{
            x: [0, 60, -30, 0],
            y: [0, -80, 50, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{
            duration: 35,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 left-1/4 w-[450px] h-[450px] rounded-full blur-[120px] opacity-[0.08] will-change-transform"
          style={{ backgroundColor: theme.primary, transform: "translateZ(0)" }}
        />
        <motion.div
          animate={{
            x: [0, -80, 40, 0],
            y: [0, 70, -60, 0],
            scale: [1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: 42,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-1/4 right-1/4 w-[550px] h-[550px] rounded-full blur-[140px] opacity-[0.06] will-change-transform"
          style={{ backgroundColor: theme.secondary, transform: "translateZ(0)" }}
        />
      </div>

      <div className="mx-auto max-w-6xl relative z-10">
        {!embedded ? (
          <div className="mb-12">
            <div className="public-glass-card flex flex-col gap-8 rounded-[3.5rem] p-8 md:p-12 border shadow-[0_40px_100px_rgba(0,0,0,0.5)]" style={{ borderColor: "rgba(212,175,55,0.15)", backgroundColor: "rgba(23,23,26,0.8)" }}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-6">
                  <button
                    type="button"
                    onClick={() => navigate(homePath)}
                    className="group inline-flex h-14 w-14 items-center justify-center rounded-full border transition-all hover:scale-110 active:scale-95 bg-white/5 border-white/10"
                    style={{ color: "#D4AF37" }}
                    aria-label="العودة إلى الصفحة الرئيسية"
                  >
                    <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
                  </button>
 
                  <div className="flex min-w-0 items-center gap-5">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.25rem] bg-[#09090B] text-[#D4AF37] shadow-2xl border border-white/10">
                      {logoImage ? (
                        <img
                          src={logoImage}
                          alt={salonName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Scissors size={28} />
                      )}
                    </div>
                    <div className="min-w-0">
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#D4AF37] opacity-80">
                        الواجهة الملكية للحجز
                      </p>
                      <p className="truncate text-2xl font-black text-white">
                        {salonName}
                      </p>
                    </div>
                  </div>
                </div>
 
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="bg-white/5 text-slate-300 border-white/10 backdrop-blur-xl font-black px-4 py-1.5 rounded-xl uppercase tracking-widest text-[10px]">
                    <CalendarDays size={14} className="ml-2 text-[#D4AF37]" />
                    SECURE BOOKING
                  </Badge>
                  <Badge variant="outline" className="bg-white/5 text-slate-300 border-white/10 backdrop-blur-xl font-black px-4 py-1.5 rounded-xl uppercase tracking-widest text-[10px]">
                    <Sparkles size={14} className="ml-2 text-[#D4AF37]" />
                    ROYAL EXPERIENCE
                  </Badge>
                </div>
              </div>
 
              <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] pt-8 border-t border-white/5">
                <div className="rounded-[2.5rem] border p-10 backdrop-blur-xl flex flex-col justify-between" style={{ backgroundColor: "rgba(212,175,55,0.03)", borderColor: "rgba(212,175,55,0.1)" }}>
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#D4AF37]">
                      تنويه ملكي
                    </p>
                    <h2 className="text-3xl font-black text-white leading-snug">
                      تجربة حجز مستقلة، سريعة، وبأعلى معايير الخصوصية.
                    </h2>
                    <p className="text-base font-bold text-slate-400 leading-relaxed max-w-2xl">
                      نحن نوفر لك بيئة حجز هادئة تركز على تفاصيلك الشخصية، لضمان حصولك على الخدمة التي تليق بمكانتك في الموعد الذي تفضله.
                    </p>
                  </div>
 
                  <div className="mt-10 flex flex-wrap gap-4 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(homePath)}
                      className="rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black px-8 py-4"
                    >
                      العودة للواجهة
                    </Button>
                    <div className="h-1 w-1 rounded-full bg-[#D4AF37]" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      ENCRYPTED & PROTECTED CONNECTION
                    </span>
                  </div>
                </div>
 
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <QuickInfo icon={MapPin} label="الموقع الملكي" value={addressValue} theme={theme} />
                  <QuickInfo
                    icon={Phone}
                    label="رقم الهاتف"
                    value={phoneValue || "أضف رقم الهاتف من إعدادات المحل"}
                    dir={phoneValue ? "ltr" : "rtl"}
                    theme={theme}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className={`space-y-10 ${embedded ? "mb-10" : "mb-16"}`}>
          <div className="mx-auto max-w-4xl text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-[2rem] bg-[#09090B] text-[#D4AF37] shadow-[0_20px_50px_rgba(212,175,55,0.2)] border border-[#D4AF37]/20"
            >
              <Scissors size={36} />
            </motion.div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-[#D4AF37] opacity-80">خطوات الحجز الملكي</p>
            <h1 className="mt-4 text-4xl font-black tracking-tighter sm:text-7xl text-white">
              احجز موعدك الآن
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg font-bold text-slate-400 leading-relaxed">
              اتبع الخطوات الموضحة أدناه لتأكيد حجزك في ثوانٍ معدودة. كل تفصيلة هنا صُممت لراحتك.
            </p>
          </div>
 
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <InfoTile
              icon={BadgeCheck}
              title="الخدمات"
              value={`${selectedServices.length}`}
              hint="يمكنك اختيار باقة خدمات متكاملة"
            />
            <InfoTile
              icon={User}
              title="الخبير"
              value={selectedBarber}
              hint="نخبة الحلاقين في خدمتك"
            />
            <InfoTile
              icon={Timer}
              title="الوقت المقدر"
              value={selectedDuration ? `${selectedDuration} دقيقة` : "--"}
              hint="مدة الجلسة التقريبية"
            />
            <InfoTile
              icon={WalletCards}
              title="الإجمالي"
              value={`${bookingTotal} ${catalog.business.currency || "ج.م"}`}
              hint="الدفع داخل الصالون"
            />
          </div>
        </div>
 
        <div className="mb-12 rounded-[3.5rem] border p-8 md:p-12 public-glass-card shadow-[0_30px_80px_rgba(0,0,0,0.3)]" style={{ borderColor: "rgba(212,175,55,0.15)", backgroundColor: "rgba(23,23,26,0.7)" }}>
          <div className="mb-10 flex items-end justify-between gap-6 border-b border-white/5 pb-8">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#D4AF37]">
                الخطوة الحالية
              </p>
              <h3 className="text-3xl font-black text-white">
                {currentStepMeta.label}
              </h3>
              <p className="text-sm font-bold text-slate-500">
                {currentStepMeta.hint}
              </p>
            </div>
            <div className="rounded-2xl border px-6 py-3 text-lg font-black bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]">
              {Math.min(step, 4)} / 4
            </div>
          </div>
 
          <div className="relative mb-12 h-3 w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full relative"
              style={{ backgroundColor: "#D4AF37", boxShadow: "0 0 20px rgba(212,175,55,0.4)" }}
              initial={{ width: "25%" }}
              animate={{ width: `${(Math.min(step, 4) / 4) * 100}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </motion.div>
          </div>
 
          <div className="grid gap-5 sm:grid-cols-4">
            {BOOKING_STEPS.map((item) => (
              <div
                key={item.id}
                className={`rounded-[1.75rem] border p-6 transition-all duration-500 ${
                  step >= item.id
                    ? "shadow-2xl translate-y-[-4px]"
                    : "opacity-40"
                }`}
                style={{
                  backgroundColor: step >= item.id ? "rgba(212, 175, 55, 0.08)" : "transparent",
                  borderColor: step >= item.id ? "#D4AF37" : "rgba(255,255,255,0.1)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-[1rem] text-sm font-black shadow-2xl transition-all duration-500"
                    style={{
                      backgroundColor: step >= item.id ? "#D4AF37" : "rgba(255,255,255,0.1)",
                      color: step >= item.id ? "#09090B" : "#F8FAFC",
                    }}
                  >
                    {step > item.id ? <CheckCircle2 size={18} /> : item.id}
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest text-white">
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 ? (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-8"
                >
                  <div className="flex flex-wrap gap-3 pb-2 overflow-x-auto scrollbar-hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className={`px-6 py-3 rounded-2xl text-xs font-black border transition-all duration-300 ${
                        selectedCategory === "all"
                          ? "bg-[#D4AF37] border-[#D4AF37] text-[#09090B] shadow-xl"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-[#D4AF37]/50 hover:text-white"
                      }`}
                    >
                      الكل
                    </button>
                    {(catalog?.categories || []).map((cat) => (
                      <button
                        key={String(cat.id ?? "")}
                        type="button"
                        onClick={() => setSelectedCategory(String(cat.id ?? ""))}
                        className={`px-6 py-3 rounded-2xl text-xs font-black border transition-all duration-300 ${
                          selectedCategory === cat.id
                            ? "bg-[#D4AF37] border-[#D4AF37] text-[#09090B] shadow-xl"
                            : "bg-white/5 border-white/10 text-slate-400 hover:border-[#D4AF37]/50 hover:text-white"
                        }`}
                      >
                        {String(cat.name_ar ?? "")}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {(catalog?.categories || [])
                      .filter((cat) => selectedCategory === "all" || selectedCategory === cat.id)
                      .map((cat) => (
                        <div key={cat.id} className="space-y-5">
                          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#D4AF37] opacity-80">
                            <Zap size={14} /> {String(cat.name_ar ?? "")}
                          </h3>
                          <div className="space-y-4">
                            {(catalog?.services || [])
                              .filter((service) => service.category_id === cat.id)
                              .map((service) => (
                                <motion.button
                                  key={service.id}
                                  type="button"
                                  onClick={() => toggleService(service.id)}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="flex w-full items-center justify-between rounded-[2rem] border p-5 text-right transition-all duration-300 group"
                                  style={{
                                    borderColor: bookingData.services.find(s => s.service_id === service.id) ? "#D4AF37" : "rgba(255,255,255,0.08)",
                                    backgroundColor: bookingData.services.find(s => s.service_id === service.id) ? "rgba(212,175,55,0.08)" : "rgba(255,255,255,0.02)",
                                    boxShadow: bookingData.services.find(s => s.service_id === service.id) ? "0 10px 30px rgba(212,175,55,0.1)" : "none",
                                  }}
                                >
                                  <div className="flex items-center gap-5">
                                    <div
                                      className={`flex h-12 w-12 items-center justify-center rounded-[1rem] transition-all duration-300 ${
                                        bookingData.services.find(
                                          (selected) =>
                                            selected.service_id === service.id,
                                        )
                                          ? "bg-[#D4AF37] text-[#09090B]"
                                          : "bg-white/5 text-slate-500 group-hover:bg-white/10"
                                      }`}
                                    >
                                      <Scissors size={24} />
                                    </div>
                                    <div>
                                      <p className="text-base font-black text-white">
                                        {service.name}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                         <Clock3 size={10} className="text-slate-500" />
                                         <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                           {service.duration_minutes} MIN
                                         </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-lg font-black text-[#D4AF37]">
                                    {service.price}
                                    <span className="text-[10px] font-bold mr-1 opacity-60">
                                      {catalog.business.currency || "ج.م"}
                                    </span>
                                  </div>
                                </motion.button>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="flex justify-end pt-6">
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-16 gap-3 rounded-2xl px-12 text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-105 active:scale-95"
                      style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
                    >
                      المتابعة لاختيار الحلاق <ChevronLeft size={18} />
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-8"
                >
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                    <motion.button
                      type="button"
                      onClick={() =>
                        setBookingData({ ...bookingData, barber_id: null })
                      }
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`relative overflow-hidden group space-y-5 rounded-[3rem] border p-8 text-center transition-all duration-500 ${
                        bookingData.barber_id === null
                          ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-2xl"
                          : "border-white/5 bg-white/20 hover:border-white/20"
                      }`}
                    >
                      <div
                        className={`mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border transition-all duration-500 ${
                          bookingData.barber_id === null
                            ? "bg-[#D4AF37] border-[#D4AF37] text-[#09090B]"
                            : "bg-white/5 border-white/10 text-slate-500 group-hover:bg-[#D4AF37]/20 group-hover:text-[#D4AF37]"
                        }`}
                      >
                        <User size={44} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-black text-white">
                          أي حلاق متاح
                        </p>
                        <p className="text-[11px] font-black text-[#D4AF37] uppercase tracking-widest opacity-70">
                          THE FASTEST OPTION
                        </p>
                      </div>
                    </motion.button>

                    {(catalog?.barbers || []).map((barber) => (
                      <motion.button
                        key={barber.id}
                        type="button"
                        onClick={() =>
                          setBookingData({
                            ...bookingData,
                            barber_id: barber.id ?? null,
                          })
                        }
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className={`relative overflow-hidden group space-y-5 rounded-[3rem] border p-8 text-center transition-all duration-500 ${
                          bookingData.barber_id === barber.id
                            ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-2xl"
                            : "border-white/5 bg-white/20 hover:border-white/20"
                        }`}
                      >
                        <div
                          className={`mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2rem] border transition-all duration-500 ${
                            bookingData.barber_id === barber.id
                              ? "border-[#D4AF37]"
                              : "border-white/10"
                          }`}
                        >
                          {barber.profile_image_url ? (
                            <img
                              src={resolveAssetUrl(barber.profile_image_url)}
                              alt={barber.display_name}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-500 bg-white/5">
                              <User size={44} />
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-black text-white group-hover:text-[#D4AF37] transition-colors">
                            {barber.display_name}
                          </p>
                          {barber.job_title && (
                            <p className="text-[11px] font-black text-[#D4AF37] uppercase tracking-widest opacity-80">
                              {barber.job_title}
                            </p>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-16 rounded-[1.5rem] px-10 text-xs font-black uppercase tracking-widest border-white/10 text-white hover:bg-white/5"
                    >
                      رجوع
                    </Button>
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-16 gap-3 rounded-[1.5rem] px-12 text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all"
                      style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
                    >
                      اختيار الموعد <ChevronLeft size={18} />
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 gap-10 md:grid-cols-[350px_1fr]">
                    <div className="space-y-6">
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#D4AF37]">
                        اختر التاريخ الملكي
                      </h3>
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                        value={bookingData.appointment_date || ""}
                        onChange={handleDateChange}
                        className="h-20 w-full rounded-[2rem] border border-white/10 bg-white/5 px-8 text-lg font-black text-white outline-none focus:border-[#D4AF37] transition-all"
                        style={{ colorScheme: 'dark' }}
                      />
                      <div className="rounded-[2rem] bg-[#D4AF37]/5 p-6 border border-[#D4AF37]/20">
                        <div className="flex items-start gap-4">
                           <Sparkles size={20} className="text-[#D4AF37] shrink-0 mt-1" />
                           <p className="text-sm font-bold text-slate-400 leading-relaxed">
                            نحن نلتزم بموعدك بأعلى درجات الدقة. في حالات نادرة قد يتغير الحرفي المنفذ لضمان انسيابية تجربتك الفاخرة.
                           </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#D4AF37]">
                        المواعيد المتاحة (تايم سلاوتس)
                      </h3>
                      {slotsLoading ? (
                        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                            <div
                              key={item}
                              className="h-16 animate-pulse rounded-[1.25rem] bg-white/5"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {!bookingData.appointment_date ? (
                            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                              <p className="text-base font-black text-slate-500 uppercase tracking-widest">
                                يرجى اختيار التاريخ لتفعيل الأوقات
                              </p>
                            </div>
                          ) : availableSlots.length === 0 ? (
                            <div className="py-20 text-center border-2 border-dashed border-rose-500/20 rounded-[3rem] bg-rose-500/5">
                              <p className="text-base font-black text-rose-400">
                                عذراً، جميع المواعيد محجوزة في هذا اليوم
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-10">
                              {morningSlots.length > 0 && (
                                <div className="space-y-4">
                                  <h4 className="text-xs font-black text-slate-400 flex items-center gap-3 uppercase tracking-widest">
                                    <div className="h-[1px] w-8 bg-white/10" />
                                    🌅 Morning Slots
                                  </h4>
                                  <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                                    {morningSlots.map((slot) => (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() =>
                                          setBookingData({
                                            ...bookingData,
                                            appointment_time: slot,
                                          })
                                        }
                                        className={`h-16 rounded-[1.25rem] border text-sm font-black transition-all duration-300 ${
                                          bookingData.appointment_time === slot
                                            ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B] shadow-2xl"
                                            : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                                        }`}
                                      >
                                        {formatTime12h(slot)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {afternoonSlots.length > 0 && (
                                <div className="space-y-4">
                                  <h4 className="text-xs font-black text-slate-400 flex items-center gap-3 uppercase tracking-widest">
                                    <div className="h-[1px] w-8 bg-white/10" />
                                    ☀️ Afternoon Slots
                                  </h4>
                                  <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                                    {afternoonSlots.map((slot) => (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() =>
                                          setBookingData({
                                            ...bookingData,
                                            appointment_time: slot,
                                          })
                                        }
                                        className={`h-16 rounded-[1.25rem] border text-sm font-black transition-all duration-300 ${
                                          bookingData.appointment_time === slot
                                            ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B] shadow-2xl"
                                            : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                                        }`}
                                      >
                                        {formatTime12h(slot)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {eveningSlots.length > 0 && (
                                <div className="space-y-4">
                                  <h4 className="text-xs font-black text-slate-400 flex items-center gap-3 uppercase tracking-widest">
                                    <div className="h-[1px] w-8 bg-white/10" />
                                    🌙 Evening Slots
                                  </h4>
                                  <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                                    {eveningSlots.map((slot) => (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() =>
                                          setBookingData({
                                            ...bookingData,
                                            appointment_time: slot,
                                          })
                                        }
                                        className={`h-16 rounded-[1.25rem] border text-sm font-black transition-all duration-300 ${
                                          bookingData.appointment_time === slot
                                            ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B] shadow-2xl"
                                            : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                                        }`}
                                      >
                                        {formatTime12h(slot)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-16 rounded-[1.5rem] px-10 text-xs font-black uppercase tracking-widest border-white/10 text-white hover:bg-white/5"
                    >
                      رجوع
                    </Button>
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-16 gap-3 rounded-[1.5rem] px-12 text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all"
                      style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
                    >
                      تأكيد البيانات <ChevronLeft size={18} />
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 4 ? (
                <motion.div
                  key="step4"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-8"
                >
                  <Card className="space-y-10 border-white/5 bg-white/5 p-10 shadow-2xl rounded-[3rem] backdrop-blur-xl">
                    <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
                      <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#D4AF37]">
                          البيانات الشخصية
                        </h3>
                        <div className="space-y-5">
                          <Input
                            placeholder="الاسم الأول"
                            value={bookingData.first_name || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                first_name: e.target.value,
                              })
                            }
                            className="h-14 rounded-2xl border-white/10 bg-white/5 text-white font-bold px-6 focus:border-[#D4AF37]"
                          />
                          <Input
                            placeholder="اسم العائلة"
                            value={bookingData.last_name || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                last_name: e.target.value,
                              })
                            }
                            className="h-14 rounded-2xl border-white/10 bg-white/5 text-white font-bold px-6 focus:border-[#D4AF37]"
                          />
                          <Input
                            placeholder="رقم الهاتف"
                            value={bookingData.phone || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                phone: e.target.value,
                              })
                            }
                            className="h-14 rounded-2xl border-white/10 bg-white/5 text-white text-left font-black px-6 focus:border-[#D4AF37]"
                            dir="ltr"
                          />
                          <Input
                            placeholder="البريد الإلكتروني (اختياري)"
                            value={bookingData.email || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                email: e.target.value,
                              })
                            }
                            className="h-14 rounded-2xl border-white/10 bg-white/5 text-white text-left font-bold px-6 focus:border-[#D4AF37]"
                            dir="ltr"
                          />
                          <textarea
                            placeholder="هل لديك أي ملاحظات إضافية؟"
                            value={bookingData.notes || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                notes: e.target.value,
                              })
                            }
                            className="min-h-[140px] w-full rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm font-bold text-white outline-none transition-all focus:border-[#D4AF37]"
                          />
                        </div>
                      </div>

                      <div className="space-y-6 rounded-[2.5rem] border border-[#D4AF37]/10 bg-[#D4AF37]/5 p-8 flex flex-col justify-between">
                        <div className="space-y-6">
                           <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#D4AF37]">
                             الملخص النهائي
                           </h3>
                           <div className="space-y-5">
                             <SummaryRow
                               label="الخدمات المختارة"
                               value={`${bookingData.services.length} خدمات`}
                             />
                             <SummaryRow
                               label="تاريخ الموعد"
                               value={bookingData.appointment_date}
                             />
                             <SummaryRow
                               label="توقيت الحجز"
                               value={formatTime12h(bookingData.appointment_time)}
                             />
                             <SummaryRow label="الحرفي المختار" value={selectedBarber} />
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-between border-t border-[#D4AF37]/20 pt-6">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                            الإجمالي المستحق
                          </span>
                          <span className="text-4xl font-black text-white">
                            {bookingTotal} <span className="text-sm font-bold opacity-60 uppercase">{catalog.business.currency}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                  
                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-16 rounded-[1.5rem] px-10 text-xs font-black uppercase tracking-widest border-white/10 text-white hover:bg-white/5"
                    >
                      رجوع
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || loading}
                      className="h-16 rounded-[1.5rem] px-16 text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all"
                      style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
                    >
                      {submitting ? "جاري المعالجة..." : "تثبيت الموعد الملكي"}
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 5 ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative space-y-10 py-16 text-center overflow-hidden rounded-[4rem] border border-white/5 bg-white/5 backdrop-blur-xl"
                >
                  {/* Success Particles */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
                    {confettiArray.map((p) => (
                      <motion.div
                        key={p.id}
                        className="absolute rounded-full z-50"
                        style={{
                          width: p.size,
                          height: p.size,
                          backgroundColor: p.color,
                        }}
                        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                        animate={{
                          x: p.x,
                          y: p.y + 400,
                          rotate: p.rotation + 720,
                          opacity: 0
                        }}
                        transition={{
                          duration: 2.5,
                          ease: "easeOut",
                          delay: p.delay
                        }}
                      />
                    ))}
                  </div>

                  <div className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 shadow-[0_0_60px_rgba(212,175,55,0.2)]">
                    <CheckCircle2 size={64} strokeWidth={1.5} />
                  </div>
                  
                  <div className="space-y-4 px-10">
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
                      تم الحجز بنجاح!
                    </h2>
                    <p className="mx-auto max-w-lg text-lg font-bold text-slate-400 leading-relaxed">
                      شكراً لاختيارك <span className="text-white">{salonName}</span>. لقد تم تأكيد موعدك بنجاح، وستصلك رسالة تفصيلية قريباً.
                    </p>
                  </div>

                  <Card className="mx-auto max-w-sm space-y-6 border border-white/10 p-10 bg-white/5 rounded-[2.5rem]">
                    <div className="flex justify-between items-center text-sm font-black uppercase tracking-widest text-[#D4AF37]">
                      <span className="opacity-60">DATE</span>
                      <span className="text-white">{bookingData.appointment_date}</span>
                    </div>
                    <div className="h-[1px] w-full bg-white/5" />
                    <div className="flex justify-between items-center text-sm font-black uppercase tracking-widest text-[#D4AF37]">
                      <span className="opacity-60">TIME</span>
                      <span className="text-white">{formatTime12h(bookingData.appointment_time)}</span>
                    </div>
                  </Card>

                  <Button
                    disabled={loading}
                    onClick={() =>
                      navigate(
                        publicSlug
                          ? buildPublicSalonPath(catalog.business || {})
                          : "/",
                      )
                    }
                    className="h-16 rounded-2xl px-16 text-xs font-black uppercase tracking-[0.3em] shadow-2xl transition-all hover:scale-105"
                    style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
                  >
                    العودة للرئيسية
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {step < 5 ? (
            <aside className="lg:sticky lg:top-32 lg:self-start">
              <Card className="rounded-[3rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-6">
                   <div className="h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">
                     Live Summary
                   </p>
                </div>
                
                <h3 className="text-2xl font-black text-white tracking-tight">
                  تفاصيل الموعد
                </h3>

                <div className="mt-8 space-y-5">
                  <SummaryRow
                    label="عدد الخدمات"
                    value={`${selectedServices.length}`}
                  />
                  <SummaryRow label="الحرفي" value={selectedBarber} />
                  <SummaryRow
                    label="التاريخ"
                    value={bookingData.appointment_date || "--"}
                  />
                  <SummaryRow
                    label="الوقت"
                    value={bookingData.appointment_time ? formatTime12h(bookingData.appointment_time) : "--"}
                  />
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/5 bg-white/5 p-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#D4AF37] mb-4">
                    SELECTED SERVICES
                  </p>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto scrollbar-hidden">
                    {selectedServices.length ? (
                      selectedServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-xs font-bold"
                        >
                          <span className="truncate text-slate-300">
                            {service.name}
                          </span>
                          <span className="text-[#D4AF37]">
                            {service.price} {catalog.business.currency || "ج.م"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">
                        EMPTY CART
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-8">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                    TOTAL
                  </span>
                  <span className="text-4xl font-black text-white tracking-tighter">
                    {bookingTotal} <span className="text-xs font-bold opacity-40">{catalog.business.currency}</span>
                  </span>
                </div>
              </Card>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ title, value, hint, icon: Icon = Sparkles }) {
  return (
    <div className="group rounded-[2.5rem] border border-white/5 bg-white/5 p-6 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:bg-white/10 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-[#D4AF37] transition-colors">
            {title}
          </p>
          <h3 className="line-clamp-2 text-xl font-black text-white">{value}</h3>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-[#09090B] text-[#D4AF37] border border-white/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(212,175,55,0.2)]">
          <Icon size={24} />
        </div>
      </div>
      <p className="mt-5 text-[11px] font-bold leading-relaxed text-slate-500 border-t border-white/5 pt-4">
        {hint}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs font-black uppercase tracking-wide">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}

function QuickInfo({ icon: Icon, label, value, dir = "rtl", theme }) {
  return (
    <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl transition-all hover:bg-white/10">
      <div className="flex items-start gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[#09090B] border border-white/10" style={{ color: "#D4AF37" }}>
          <Icon size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#D4AF37]">
            {label}
          </p>
          <p className="mt-3 break-words text-sm font-black text-white" dir={dir}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

