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
  WalletCards,
  BadgeCheck,
  MapPin,
  Phone,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
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
  black: {
    primary: "#38BDF8", // Cyan Neon
    secondary: "#8B5CF6", // Purple Neon Glow
    accent: "#1E293B", // Rich Charcoal Slate
    bg: "#09090B", // Deeper Black for contrast
    card: "#18181B", // Soft Zinc
    dark: "#FFFFFF", // Contrast White
    text: "#F8FAFC", // Ice White
    muted: "#A1A1AA", // Zinc Gray
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

export default function PublicBooking({ embedded = false }) {
  const navigate = useNavigate();
  const { publicSlug } = useParams();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalog, setCatalog] = useState({
    services: [],
    categories: [],
    barbers: [],
    business: {},
  });

  const settings = catalog.business;
  const theme = THEMES[settings?.landing_theme_id] || THEMES[settings?.landingThemeId] || THEMES.black;

  const [bookingData, setBookingData] = useState({
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
  const [availableSlots, setAvailableSlots] = useState([]);
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
      catalog.services.find((service) => service.id === selected.service_id),
    )
    .filter(Boolean);
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
    catalog.barbers.find((barber) => barber.id === bookingData.barber_id)
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
      setAvailableSlots(res?.data?.available_slots || res?.available_slots || []);
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
      await api.post("/public/booking", bookingData);
      setDirection(1);
      setStep(5);
      toast.success("تم تسجيل حجزك بنجاح");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "فشل تسجيل الحجز");
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
          <div className="mb-8">
            <div className="public-glass-card flex flex-col gap-6 rounded-[2.5rem] p-6 md:p-8 border" style={{ borderColor: `${theme.primary}15` }}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <button
                    type="button"
                    onClick={() => navigate(homePath)}
                    className="public-control inline-flex h-12 w-12 items-center justify-center rounded-full border text-main transition hover:scale-105 active:scale-95"
                    style={{ borderColor: `${theme.primary}20`, color: theme.dark }}
                    aria-label="العودة إلى الصفحة الرئيسية"
                  >
                    <ArrowRight size={18} />
                  </button>
 
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-zinc-950 text-amber-300 shadow-xl border border-white/5">
                      {logoImage ? (
                        <img
                          src={logoImage}
                          alt={salonName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Scissors size={22} style={{ color: theme.primary }} />
                      )}
                    </div>
                    <div className="min-w-0">
                       <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: theme.primary }}>
                        منصة الحجز السريع
                      </p>
                      <p className="truncate text-xl font-black" style={{ color: theme.dark }}>
                        {salonName}
                      </p>
                    </div>
                  </div>
                </div>
 
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" size="md" className="bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 backdrop-blur-md font-bold px-3 py-1">
                    <CalendarDays size={14} className="ml-1" style={{ color: theme.primary }} />
                    مسار مخصص وآمن
                  </Badge>
                  <Badge variant="outline" size="md" className="bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 backdrop-blur-md font-bold px-3 py-1">
                    <Sparkles size={14} className="ml-1" style={{ color: theme.primary }} />
                    تجربة ملكية متكاملة
                  </Badge>
                </div>
              </div>
 
              <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] pt-4 border-t" style={{ borderColor: `${theme.primary}10` }}>
                <div className="rounded-[2rem] border p-8 backdrop-blur-md flex flex-col justify-between" style={{ backgroundColor: `${theme.primary}03`, borderColor: `${theme.primary}15` }}>
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: theme.primary }}>
                      لماذا الصفحة المنفصلة؟
                    </p>
                    <h2 className="text-2xl font-black leading-snug" style={{ color: theme.dark }}>
                      شاشة مستقلة خالية من المشتتات لضمان حجز سريع وسلس
                    </h2>
                    <p className="text-sm font-bold leading-relaxed opacity-75" style={{ color: theme.text }}>
                      نقدّم لك تجربة حجز خالية تماماً من المشتتات البصرية، حيث تركّز الشاشة فقط على اختيار خدماتك المفضّلة، خبيرك الحرفي، وتأكيد موعدك بدقة بالغة.
                    </p>
                  </div>
 
                  <div className="mt-8 flex flex-wrap gap-3 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(homePath)}
                      className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/5 hover:bg-white/10"
                    >
                      العودة للواجهة
                    </Button>
                    <span className="text-xs font-black opacity-55" style={{ color: theme.text }}>
                      رابط الحجز نشط وآمن للتحويل
                    </span>
                  </div>
                </div>
 
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <QuickInfo icon={MapPin} label="العنوان" value={addressValue} theme={theme} />
                  <QuickInfo
                    icon={Phone}
                    label="الهاتف"
                    value={phoneValue || "أضف رقم الهاتف من إعدادات المحل"}
                    dir={phoneValue ? "ltr" : "rtl"}
                    theme={theme}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className={`space-y-6 ${embedded ? "mb-8" : "mb-12"}`}>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-zinc-950 text-amber-400 shadow-2xl border border-white/10 ring-8 ring-slate-100 dark:ring-zinc-900/50">
              <Scissors size={32} style={{ color: theme.primary }} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: theme.primary }}>حجز أونلاين ذكي وآمن</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl" style={{ color: theme.dark }}>
              احجز موعدك مع {salonName}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm font-bold leading-relaxed opacity-70" style={{ color: theme.text }}>
              خطوات بسيطة ومرئية تفصلك عن حجز جلستك الفاخرة القادمة. اختر ما يناسبك ودع الباقي لخبرائنا.
            </p>
          </div>
 
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoTile
              icon={BadgeCheck}
              title="الخدمات المختارة"
              value={`${selectedServices.length}`}
              hint="يمكنك اختيار أكثر من خدمة"
            />
            <InfoTile
              icon={User}
              title="الخبير الحالي"
              value={selectedBarber}
              hint="يمكنك تغييره في الخطوة التالية"
            />
            <InfoTile
              icon={Timer}
              title="المدة التقريبية"
              value={selectedDuration ? `${selectedDuration} دقيقة` : "--"}
              hint="تتغير حسب الخدمات المختارة"
            />
            <InfoTile
              icon={WalletCards}
              title="الإجمالي التقديري"
              value={`${bookingTotal} ${catalog.business.currency || "ج.م"}`}
              hint="السعر النهائي يتأكد بعد تثبيت الطلب"
            />
          </div>
        </div>
 
        <div className="mb-10 rounded-[2.5rem] border p-6 md:p-8 public-glass-card" style={{ borderColor: `${theme.primary}15` }}>
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: theme.primary }}>
                الخطوة الحالية
              </p>
              <h3 className="mt-1.5 text-2xl font-black" style={{ color: theme.dark }}>
                {currentStepMeta.label}
              </h3>
              <p className="mt-1 text-xs font-bold opacity-60" style={{ color: theme.text }}>
                {currentStepMeta.hint}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-2.5 text-sm font-black" style={{ borderColor: `${theme.primary}30`, backgroundColor: `${theme.primary}10`, color: theme.primary }}>
              {Math.min(step, 4)} / 4
            </div>
          </div>
 
          <div className="relative mb-8 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <motion.div
              className="h-full rounded-full relative"
              style={{ backgroundColor: theme.primary, boxShadow: `0 0 12px 2px ${theme.primary}50` }}
              initial={{ width: "25%" }}
              animate={{ width: `${(Math.min(step, 4) / 4) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </motion.div>
          </div>
 
          <div className="grid gap-4 sm:grid-cols-4">
            {BOOKING_STEPS.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 transition-all duration-300 ${
                  step >= item.id
                    ? "shadow-md"
                    : "opacity-65"
                }`}
                style={{
                  backgroundColor: step >= item.id ? `${theme.primary}08` : theme.card,
                  borderColor: step >= item.id ? theme.primary : `${theme.primary}15`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black shadow-sm"
                    style={{
                      backgroundColor: step >= item.id ? theme.primary : `${theme.primary}15`,
                      color: step >= item.id ? theme.dark : theme.dark,
                    }}
                  >
                    {step > item.id ? <CheckCircle2 size={14} /> : item.id}
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider" style={{ color: theme.dark }}>
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
                  <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className={`px-5 py-2.5 rounded-full text-xs font-black border transition-all ${
                        selectedCategory === "all"
                          ? "bg-accent border-accent text-white shadow-soft shadow-accent/20"
                          : "bg-white border-border text-muted hover:border-accent/40"
                      }`}
                    >
                      الكل
                    </button>
                    {catalog.categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-5 py-2.5 rounded-full text-xs font-black border transition-all ${
                          selectedCategory === cat.id
                            ? "bg-accent border-accent text-white shadow-soft shadow-accent/20"
                            : "bg-white border-border text-muted hover:border-accent/40"
                        }`}
                      >
                        {cat.name_ar}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {catalog.categories
                      .filter((cat) => selectedCategory === "all" || selectedCategory === cat.id)
                      .map((cat) => (
                        <div key={cat.id} className="space-y-4">
                          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-accent">
                            <Zap size={14} /> {cat.name_ar}
                          </h3>
                          <div className="space-y-3">
                            {catalog.services
                              .filter((service) => service.category_id === cat.id)
                              .map((service) => (
                                <motion.button
                                  key={service.id}
                                  type="button"
                                  onClick={() => toggleService(service.id)}
                                  whileHover={{ scale: 1.015, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.04)" }}
                                  whileTap={{ scale: 0.985 }}
                                  className="flex w-full items-center justify-between rounded-2xl border p-4 text-right transition-all"
                                  style={{
                                    borderColor: bookingData.services.find(s => s.service_id === service.id) ? theme.primary : `${theme.primary}20`,
                                    backgroundColor: bookingData.services.find(s => s.service_id === service.id) ? `${theme.primary}10` : theme.card,
                                    boxShadow: bookingData.services.find(s => s.service_id === service.id) ? `0 0 20px -5px ${theme.primary}40` : 'none',
                                  }}
                                >
                                  <div className="flex items-center gap-4">
                                    <motion.div
                                      animate={{
                                        scale: bookingData.services.find(s => s.service_id === service.id) ? [1, 1.18, 1] : 1,
                                      }}
                                      transition={{ type: "spring", stiffness: 350, damping: 14 }}
                                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                        bookingData.services.find(
                                          (selected) =>
                                            selected.service_id === service.id,
                                        )
                                          ? "bg-accent text-white"
                                          : "bg-soft text-muted"
                                      }`}
                                    >
                                      <Scissors size={20} />
                                    </motion.div>
                                    <div>
                                      <p className="text-sm font-black text-main">
                                        {service.name}
                                      </p>
                                      <p className="text-[10px] font-bold text-muted">
                                        {service.duration_minutes} دقيقة
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-sm font-black text-accent">
                                    {service.price}{" "}
                                    {catalog.business.currency || "ج.م"}
                                  </div>
                                </motion.button>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-14 gap-2 rounded-xl px-12 text-xs font-black uppercase tracking-widest"
                    >
                      المتابعة لاختيار الحلاق <ChevronLeft size={16} />
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
                      whileHover={{ scale: 1.025 }}
                      whileTap={{ scale: 0.975 }}
                      className={`relative overflow-hidden group space-y-4 rounded-[2rem] border p-6 text-center transition-all duration-300 ${
                        bookingData.barber_id === null
                          ? "border-accent bg-accent-soft shadow-lg shadow-accent/15 scale-[1.02]"
                          : "border-border bg-card hover:border-accent/40"
                      }`}
                    >
                      <div
                        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border transition-all duration-300 ${
                          bookingData.barber_id === null
                            ? "bg-accent border-accent text-white"
                            : "bg-soft border-border text-muted group-hover:bg-accent-soft group-hover:text-accent group-hover:border-accent/30"
                        }`}
                      >
                        <User size={36} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-main">
                          أي حلاق متاح
                        </p>
                        <p className="text-[10px] font-bold text-muted">
                          الأسرع دائماً
                        </p>
                      </div>
                    </motion.button>

                    {catalog.barbers.map((barber) => (
                      <motion.button
                        key={barber.id}
                        type="button"
                        onClick={() =>
                          setBookingData({
                            ...bookingData,
                            barber_id: barber.id,
                          })
                        }
                        whileHover={{ scale: 1.025 }}
                        whileTap={{ scale: 0.975 }}
                        className={`relative overflow-hidden group space-y-4 rounded-[2rem] border p-6 text-center transition-all duration-300 ${
                          bookingData.barber_id === barber.id
                            ? "border-accent bg-accent-soft shadow-lg shadow-accent/15 scale-[1.02]"
                            : "border-border bg-card hover:border-accent/40"
                        }`}
                      >
                        <div
                          className={`mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border transition-all duration-300 ${
                            bookingData.barber_id === barber.id
                              ? "border-accent bg-accent"
                              : "border-border bg-soft group-hover:border-accent/40"
                          }`}
                        >
                          {barber.profile_image_url ? (
                            <img
                              src={resolveAssetUrl(barber.profile_image_url)}
                              alt={barber.display_name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted group-hover:text-accent">
                              <User size={36} />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-main group-hover:text-accent transition-colors">
                            {barber.display_name}
                          </p>
                          {barber.job_title && (
                            <p className="text-[10px] font-bold text-accent">
                              {barber.job_title}
                            </p>
                          )}
                          {barber.bio_ar && (
                            <p className="text-[10px] font-medium text-muted line-clamp-1 mt-1">
                              {barber.bio_ar}
                            </p>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-14 rounded-xl px-8 text-xs font-black uppercase"
                    >
                      رجوع
                    </Button>
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-14 gap-2 rounded-xl px-12 text-xs font-black uppercase tracking-widest"
                    >
                      اختيار الموعد <ChevronLeft size={16} />
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
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                        اختر التاريخ
                      </h3>
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                        value={bookingData.appointment_date || ""}
                        onChange={handleDateChange}
                        className="h-14 w-full rounded-xl border border-border bg-card px-6 text-sm font-black text-main outline-none focus:border-accent"
                      />
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4 border border-amber-200/50">
                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 leading-relaxed">
                          ملاحظة: نحن نلتزم بموعدك بدقة، ولكن قد يتغير الخبير المنفذ للخدمة عند الوصول لضمان أفضل جودة وأسرع خدمة لك.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                        المواعيد المتاحة
                      </h3>
                      {slotsLoading ? (
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          {[1, 2, 3, 4, 5, 6].map((item) => (
                            <div
                              key={item}
                              className="h-12 animate-pulse rounded-lg bg-soft"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {!bookingData.appointment_date ? (
                            <p className="py-8 text-center text-xs font-bold text-muted">
                              يرجى اختيار التاريخ أولاً
                            </p>
                          ) : availableSlots.length === 0 ? (
                            <p className="py-8 text-center text-xs font-bold text-danger">
                              عذراً، لا توجد مواعيد متاحة في هذا اليوم
                            </p>
                          ) : (
                            <div className="space-y-6">
                              {morningSlots.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-xs font-black text-muted flex items-center gap-1.5">
                                    🌅 صباحاً
                                  </h4>
                                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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
                                        className={`h-12 rounded-xl border text-xs font-black transition-all ${
                                          bookingData.appointment_time === slot
                                            ? "border-accent bg-accent text-white shadow-soft shadow-accent/20"
                                            : "border-border bg-card hover:border-accent/40"
                                        }`}
                                      >
                                        {slot}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {afternoonSlots.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-xs font-black text-muted flex items-center gap-1.5">
                                    ☀️ ظهراً
                                  </h4>
                                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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
                                        className={`h-12 rounded-xl border text-xs font-black transition-all ${
                                          bookingData.appointment_time === slot
                                            ? "border-accent bg-accent text-white shadow-soft shadow-accent/20"
                                            : "border-border bg-card hover:border-accent/40"
                                        }`}
                                      >
                                        {slot}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {eveningSlots.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-xs font-black text-muted flex items-center gap-1.5">
                                    🌙 مساءً
                                  </h4>
                                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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
                                        className={`h-12 rounded-xl border text-xs font-black transition-all ${
                                          bookingData.appointment_time === slot
                                            ? "border-accent bg-accent text-white shadow-soft shadow-accent/20"
                                            : "border-border bg-card hover:border-accent/40"
                                        }`}
                                      >
                                        {slot}
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
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-14 rounded-xl px-8 text-xs font-black uppercase"
                    >
                      رجوع
                    </Button>
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-14 gap-2 rounded-xl px-12 text-xs font-black uppercase tracking-widest"
                    >
                      تأكيد البيانات <ChevronLeft size={16} />
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
                  <Card className="space-y-8 border-border bg-card p-8 shadow-soft">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                      <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                          بياناتك الشخصية
                        </h3>
                        <div className="space-y-4">
                          <Input
                            placeholder="الاسم الأول"
                            value={bookingData.first_name || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                first_name: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl border-border bg-soft font-bold"
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
                            className="h-12 rounded-xl border-border bg-soft font-bold"
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
                            className="h-12 rounded-xl border-border bg-soft text-left font-bold"
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
                            className="h-12 rounded-xl border-border bg-soft text-left font-bold"
                            dir="ltr"
                          />
                          <textarea
                            placeholder="ملاحظات إضافية للحجز (اختياري)"
                            value={bookingData.notes || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                notes: e.target.value,
                              })
                            }
                            className="min-h-[110px] w-full rounded-xl border border-border bg-soft p-4 text-sm font-bold outline-none transition focus:border-accent"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 rounded-3xl border border-border bg-soft/50 p-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                          ملخص الحجز
                        </h3>
                        <div className="space-y-3">
                          <SummaryRow
                            label="الخدمات"
                            value={`${bookingData.services.length} خدمات مختارة`}
                          />
                          <SummaryRow
                            label="التاريخ"
                            value={bookingData.appointment_date}
                          />
                          <SummaryRow
                            label="الوقت"
                            value={bookingData.appointment_time}
                          />
                          <SummaryRow label="الحلاق" value={selectedBarber} />
                          <div className="flex items-center justify-between border-t border-border pt-3">
                            <span className="text-[10px] font-black uppercase text-muted">
                              الإجمالي التقديري
                            </span>
                            <span className="text-xl font-black text-main">
                              {bookingTotal} {catalog.business.currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-14 rounded-xl px-8 text-xs font-black uppercase"
                    >
                      رجوع
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || loading}
                      className="h-14 rounded-xl px-16 text-xs font-black uppercase tracking-widest shadow-accent"
                    >
                      {submitting ? "جاري الحجز..." : "تأكيد الحجز النهائي"}
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 5 ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative space-y-8 py-12 text-center overflow-hidden"
                >
                  {/* Luxury Confetti Spray */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
                    {confettiArray.map((p) => (
                      <motion.div
                        key={p.id}
                        className="absolute rounded-sm z-50"
                        style={{
                          width: p.size,
                          height: p.size,
                          backgroundColor: p.color,
                        }}
                        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                        animate={{
                          x: p.x,
                          y: p.y + 450,
                          rotate: p.rotation + 360,
                          opacity: 0
                        }}
                        transition={{
                          duration: 2.2,
                          ease: "easeOut",
                          delay: p.delay
                        }}
                      />
                    ))}
                  </div>

                  <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-md">
                    <svg className="w-16 h-16" viewBox="0 0 52 52">
                      <motion.circle
                        cx="26"
                        cy="26"
                        r="25"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                      <motion.path
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        d="M14.1 27.2l7.1 7.2 16.7-16.8"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
                      />
                    </svg>
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black text-main">
                      تم استلام حجزك بنجاح!
                    </h2>
                    <p className="mx-auto max-w-md font-bold text-muted">
                      شكراً لاختيارك {catalog.business.salon_name}. ستصلك رسالة
                      تأكيد على واتساب قريباً.
                    </p>
                  </div>
                  <Card className="mx-auto max-w-xs space-y-4 border-2 border-dashed p-6">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted">الموعد:</span>
                      <span>{bookingData.appointment_date}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted">الساعة:</span>
                      <span>{bookingData.appointment_time}</span>
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
                    variant="outline"
                    className="h-14 rounded-xl px-12 text-xs font-black uppercase"
                  >
                    العودة للرئيسية
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {step < 5 ? (
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <Card className="rounded-[2rem] border-border bg-card p-6 shadow-soft">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                  ملخص حي
                </p>
                <h3 className="mt-2 text-xl font-black text-main">
                  تفاصيل الحجز الحالي
                </h3>

                <div className="mt-5 space-y-4">
                  <SummaryRow
                    label="عدد الخدمات"
                    value={`${selectedServices.length}`}
                  />
                  <SummaryRow label="الحلاق" value={selectedBarber} />
                  <SummaryRow
                    label="التاريخ"
                    value={bookingData.appointment_date || "لم يُحدد بعد"}
                  />
                  <SummaryRow
                    label="الوقت"
                    value={bookingData.appointment_time || "لم يُحدد بعد"}
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-accent/15 bg-accent/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                    الخدمات المختارة
                  </p>
                  <div className="mt-3 space-y-2">
                    {selectedServices.length ? (
                      selectedServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm font-bold"
                        >
                          <span className="truncate text-main">
                            {service.name}
                          </span>
                          <span className="text-accent">
                            {service.price} {catalog.business.currency || "ج.م"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm font-bold text-muted">
                        لم يتم اختيار خدمات بعد
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">
                    الإجمالي
                  </span>
                  <span className="text-2xl font-black text-main">
                    {bookingTotal} {catalog.business.currency || "ج.م"}
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
    <div className="group rounded-[1.75rem] border border-[#2a1f18]/10 bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">
            {title}
          </p>
          <h3 className="mt-3 line-clamp-2 text-lg font-black text-main">{value}</h3>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-white">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-muted">{hint}</p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm font-bold">
      <span className="text-muted">{label}</span>
      <span className="text-right text-main">{value}</span>
    </div>
  );
}

function QuickInfo({ icon: Icon, label, value, dir = "rtl", theme }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: theme.primary }}>
            {label}
          </p>
          <p className="mt-2 break-words text-sm font-black" style={{ color: theme.dark }} dir={dir}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
