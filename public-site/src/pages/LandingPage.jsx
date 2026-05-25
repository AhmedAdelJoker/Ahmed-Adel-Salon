import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Award,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Facebook,
  Instagram,
  MapPin,
  Music2,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wifi,
  Youtube,
  ChevronDown,
  Brain,
  Zap,
  Target,
  Menu,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { adaptObject } from "../services/apiAdapter";
import {
  buildPublicBookingPath,
  buildPublicSalonPath,
  resolvePublicSlug,
} from "../lib/publicSite";
import { buildLandingSiteContent } from "../lib/publicSiteContent";
import { readPublicSitePreviewDraft } from "../lib/publicSitePreview";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

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

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20,
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const hoverCard = {
  rest: { y: 0, scale: 1, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)" },
  hover: {
    y: -8,
    scale: 1.02,
    boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.15)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
};

const cardMotion = {
  initial: { opacity: 0, y: 40 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20,
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  hover: {
    y: -8,
    scale: 1.02,
    boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.15)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
};

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { publicSlug } = useParams();

  const [storedSettings, setStoredSettings] = useState(null);
  const [services, setServices] = useState([]);
  const [offers, setOffers] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Custom interactive states for redesign
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activePage, setActivePage] = useState("home");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "") || "home";
      const validPages = [
        "home",
        "services",
        "team",
        "offers",
        "testimonials",
        "contact",
      ];
      if (validPages.includes(hash)) {
        setActivePage(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateToPage = (pageName) => {
    window.location.hash = pageName;
    setActivePage(pageName);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const livePreviewEnabled = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("livePreview") === "1";
  }, [location.search]);

  const previewDraft = useMemo(() => {
    if (!livePreviewEnabled) return null;
    return readPublicSitePreviewDraft();
  }, [livePreviewEnabled]);

  const settings = previewDraft
    ? { ...(storedSettings || {}), ...previewDraft }
    : storedSettings;

  const displayCategories = useMemo(() => {
    if (categories.length > 0) return categories;
    const uniqueCatIds = [
      ...new Set(services.map((s) => s.category_id).filter(Boolean)),
    ];
    return uniqueCatIds.map((id) => {
      const relatedSvc = services.find((s) => s.category_id === id);
      return {
        id,
        name: relatedSvc?.category_name || `Category ${id}`,
        name_ar: relatedSvc?.category_name_ar || `تصنيف ${id}`,
      };
    });
  }, [categories, services]);

  const filteredServices = useMemo(() => {
    if (selectedCategory === "all") return services;
    return services.filter(
      (svc) => svc.category_id === Number(selectedCategory),
    );
  }, [services, selectedCategory]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const catalogRes = await api.get("/public/booking-catalog");
        const catalogData = adaptObject(catalogRes, {});
        setStoredSettings(catalogData?.business || {});
        setServices(
          Array.isArray(catalogData?.services) ? catalogData.services : [],
        );
        setOffers(Array.isArray(catalogData?.offers) ? catalogData.offers : []);
        setBarbers(
          Array.isArray(catalogData?.barbers) ? catalogData.barbers : [],
        );
        setCategories(
          Array.isArray(catalogData?.categories) ? catalogData.categories : [],
        );
      } catch (error) {
        console.error("Failed to fetch landing data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const resolveAssetUrl = (value) => {
    if (!value) return null;
    return String(value).startsWith("http") ? value : `${STATIC_URL}${value}`;
  };

  const isOpenNow = () => {
    if (!settings?.workingHours && !settings?.working_hours) return false;
    const workingHours = settings?.workingHours || settings?.working_hours;
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const egyptTime = new Date(utc + 3600000 * 3); // UTC+3 for Egypt
    const dayName = days[egyptTime.getDay()];
    const config = workingHours?.[dayName];

    if (!config?.is_open || !config?.open_time || !config?.close_time) {
      return false;
    }

    const currentMinutes = egyptTime.getHours() * 60 + egyptTime.getMinutes();
    const [openH, openM] = config.open_time.split(":");
    const [closeH, closeM] = config.close_time.split(":");
    const openTotal = parseInt(openH, 10) * 60 + parseInt(openM, 10);
    const closeTotal = parseInt(closeH, 10) * 60 + parseInt(closeM, 10);

    return currentMinutes >= openTotal && currentMinutes <= closeTotal;
  };

  const dayNamesAr = {
    sunday: "الأحد",
    monday: "الإثنين",
    tuesday: "الثلاثاء",
    wednesday: "الأربعاء",
    thursday: "الخميس",
    friday: "الجمعة",
    saturday: "السبت",
  };

  const defaultWorkingHours = {
    sunday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    monday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    tuesday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    wednesday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    thursday: { is_open: true, open_time: "10:00", close_time: "23:00" },
    friday: { is_open: true, open_time: "13:00", close_time: "23:00" },
    saturday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  };

  const activeHours =
    settings?.workingHours || settings?.working_hours || defaultWorkingHours;

  const testimonials =
    Array.isArray(settings?.landingTestimonials) &&
    settings.landingTestimonials.length > 0
      ? settings.landingTestimonials
      : [
          {
            name: "أحمد كمال",
            role: "رائد أعمال",
            quote:
              "أفضل تجربة صالون في القاهرة بلا منازع. الاهتمام بالتفاصيل مذهل ومستوى النظافة والاحترافية لا يعلى عليه.",
          },
          {
            name: "محمد السيد",
            role: "مهندس برمجيات",
            quote:
              "المكان أنيق جداً والخدمة سريعة وممتازة. الحجز الإلكتروني يسهل كل شيء دون أي وقت انتظار.",
          },
          {
            name: "عمر الفاروق",
            role: "مدير تسويق",
            quote:
              "طاقم العمل محترف للغاية ويقدمون نصائح رائعة للعناية بالبشرة والشعر. أنصح به بشدة.",
          },
        ];

  const defaultBarbers = [
    {
      id: "fallback-1",
      display_name: "كريم مصطفى",
      job_title: "كبير الحلاقين (Senior Barber)",
      profile_image_url:
        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=800",
      bio_ar:
        "متخصص في القصات الكلاسيكية وتصفيف اللحية وتصميم المظهر العصري بأدق التفاصيل.",
    },
    {
      id: "fallback-2",
      display_name: "يوسف أحمد",
      job_title: "أخصائي العناية بالبشرة واللحية",
      profile_image_url:
        "https://images.unsplash.com/photo-1618077360395-f3068be8e001?q=80&w=800",
      bio_ar:
        "خبير في تنظيف البشرة الكوري وتحديد اللحى بالشفرة التقليدية الساخنة.",
    },
    {
      id: "fallback-3",
      display_name: "سليم خالد",
      job_title: "حلاق ومصفف شعر رئيسي",
      profile_image_url:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800",
      bio_ar:
        "أكثر من 8 سنوات من الخبرة في قصات الشعر الحديثة والـ Fade بأشكالها المختلفة.",
    },
  ];

  const activeBarbers = barbers.length > 0 ? barbers : defaultBarbers;

  const theme =
    THEMES[settings?.landingThemeId] ||
    THEMES[settings?.landing_theme_id] ||
    THEMES.black;
  const landingContent = buildLandingSiteContent(settings || {});
  const salonName =
    settings?.salonName || settings?.salon_name || "Barber Luxe";
  const logoImage = resolveAssetUrl(settings?.logoUrl || settings?.logo_url);
  const coverImage = resolveAssetUrl(
    settings?.landingCoverImageUrl || settings?.landing_cover_image_url,
  );

  const galleryImages = Array.isArray(settings?.landingPortfolio)
    ? settings.landingPortfolio.filter(Boolean)
    : [];
  const resolvedGallery = (
    galleryImages.length
      ? galleryImages
      : [
          "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=1600&auto=format&fit=crop",
        ]
  ).map((img) => resolveAssetUrl(img) || img);

  const heroImage = coverImage || resolvedGallery[0];
  const bookingPath = settings ? buildPublicBookingPath(settings) : "/book";

  const whatsappUrl = settings?.shopWhatsApp
    ? `https://wa.me/2${settings.shopWhatsApp.replace(/\D/g, "")}`
    : null;
  const mapsUrl =
    settings?.googleMapsUrl ||
    (settings?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
      : null);

  const locationDescription =
    settings?.landingLocationDescription ||
    settings?.address ||
    landingContent.copy.landingLocationDescription;

  if (loading)
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: theme.bg }}
      >
        <div className="flex flex-col items-center gap-6">
          <div
            className="h-20 w-20 rounded-3xl flex items-center justify-center shadow-2xl animate-bounce"
            style={{ backgroundColor: theme.dark, color: theme.primary }}
          >
            <Scissors size={40} />
          </div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse"
            style={{ color: theme.secondary }}
          >
            Establishing Cinematic Connection...
          </p>
        </div>
      </div>
    );

  return (
    <div
      className="relative overflow-x-hidden pb-28 pt-[80px] transition-colors duration-700 sm:pb-32 md:pt-0"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 public-grid-pattern opacity-10" />

      {/* Luxury Animated Ambient Background Blobs - Optimized for Performance */}
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
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.08] will-change-transform"
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
          className="absolute top-2/3 right-1/4 w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.06] will-change-transform"
          style={{
            backgroundColor: theme.secondary,
            transform: "translateZ(0)",
          }}
        />
        <motion.div
          animate={{
            x: [0, 50, -60, 0],
            y: [0, -40, 70, 0],
          }}
          transition={{
            duration: 38,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-1/4 left-1/3 w-[450px] h-[450px] rounded-full blur-[120px] opacity-[0.05] will-change-transform"
          style={{ backgroundColor: theme.primary, transform: "translateZ(0)" }}
        />
      </div>

      {/* 0. Floating Glassmorphic Pill Header */}
      <header
        className={`fixed left-4 right-4 z-50 mx-auto max-w-7xl transition-all duration-500 rounded-[2rem] ${
          isScrolled
            ? "top-3 py-2.5 max-w-6xl shadow-2xl border"
            : "top-5 py-4 bg-transparent border-transparent"
        }`}
        style={{
          backgroundColor: isScrolled ? `${theme.card}cc` : "transparent",
          borderColor: isScrolled ? `${theme.primary}20` : "transparent",
          backdropFilter: isScrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: isScrolled
            ? "blur(20px) saturate(180%)"
            : "none",
        }}
        dir="rtl"
      >
        <div className="px-6 md:px-8 flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigateToPage("home")}
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden border border-white/10 transition-transform duration-300 group-hover:scale-105"
              style={{ backgroundColor: theme.dark, color: theme.primary }}
            >
              {logoImage ? (
                <img
                  src={logoImage}
                  className="h-full w-full object-cover"
                  alt="Logo"
                />
              ) : (
                <Scissors size={18} />
              )}
            </div>
            <span
              className="text-lg font-black tracking-tight transition-colors duration-300 group-hover:text-amber-500"
              style={{ color: theme.dark }}
            >
              {salonName}
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: "الرئيسية", page: "home" },
              offers.length > 0
                ? { label: "العروض الملكية", page: "offers" }
                : null,
              { label: "خدماتنا", page: "services" },
              { label: "فريق العمل", page: "team" },
              { label: "آراء العملاء", page: "testimonials" },
              { label: "تواصل ومواعيد", page: "contact" },
            ]
              .filter(Boolean)
              .map((link) => (
                <a
                  key={link.page}
                  href={`#${link.page}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage(link.page);
                  }}
                  className={`text-sm font-black transition-all duration-300 relative py-2 ${
                    activePage === link.page
                      ? "opacity-100 scale-105"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{ color: theme.dark }}
                >
                  {link.label}
                  {activePage === link.page && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ backgroundColor: theme.primary }}
                    />
                  )}
                </a>
              ))}
          </nav>

          {/* Booking Button & Mobile Toggle */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate(bookingPath)}
              className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 hover:scale-[1.03] active:scale-[0.98] transition-all font-black text-sm px-6 py-2 shadow-lg hover:shadow-xl"
              style={{ backgroundColor: theme.dark, color: theme.primary }}
            >
              احجز الآن
            </Button>

            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl md:hidden border transition-all"
              style={{ borderColor: `${theme.primary}20`, color: theme.dark }}
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden border-t mt-3 rounded-[1.5rem]"
              style={{
                backgroundColor: theme.card,
                borderColor: `${theme.primary}10`,
              }}
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                {[
                  { label: "الرئيسية", page: "home" },
                  offers.length > 0
                    ? { label: "العروض الملكية", page: "offers" }
                    : null,
                  { label: "خدماتنا", page: "services" },
                  { label: "فريق العمل", page: "team" },
                  { label: "آراء العملاء", page: "testimonials" },
                  { label: "تواصل ومواعيد", page: "contact" },
                ]
                  .filter(Boolean)
                  .map((link) => (
                    <a
                      key={link.page}
                      href={`#${link.page}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToPage(link.page);
                      }}
                      className={`text-base font-black py-2 border-b border-dashed ${
                        activePage === link.page ? "opacity-100" : "opacity-60"
                      }`}
                      style={{
                        borderColor: `${theme.primary}10`,
                        color: theme.dark,
                      }}
                    >
                      {link.label}
                    </a>
                  ))}
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate(bookingPath);
                  }}
                  className="w-full mt-2 py-3 rounded-xl font-black border-none"
                  style={{ backgroundColor: theme.dark, color: theme.primary }}
                >
                  احجز الآن
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow pt-[80px] md:pt-[100px] pb-10">
        <AnimatePresence mode="wait">
          {/* 1. home tab page */}
          {activePage === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="space-y-16"
            >
              {/* Cinematic Executive Hero */}
              <section className="relative min-h-[90vh] flex items-center justify-center px-6 overflow-hidden rounded-[3rem] mx-4 my-3 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.5)] border border-white/5">
                <motion.div
                  initial={{ scale: 1.08, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 z-0"
                >
                  <img
                    src={heroImage}
                    className="h-full w-full object-cover transform"
                    alt="Hero"
                    fetchpriority="high"
                  />
                  <div className="absolute inset-0 bg-black/65" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/90" />
                  {/* Dynamic Mesh Overlays */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(138,90,37,0.15),transparent_45%)]" />
                </motion.div>

                <div className="relative z-10 max-w-5xl mx-auto w-full text-center space-y-8 py-16">
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.8 }}
                    className="flex flex-col items-center gap-6"
                  >
                    <Badge
                      className="border-none px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl relative overflow-hidden animate-pulse"
                      style={{
                        backgroundColor: theme.primary,
                        color: theme.dark,
                        boxShadow: `0 0 20px ${theme.primary}50`,
                      }}
                    >
                      {landingContent.copy.landingHeroBadge ||
                        `${salonName} Signature`}
                    </Badge>
                    <h1 className="text-4xl md:text-8xl font-black text-white tracking-tight leading-[1.1] max-w-4xl mx-auto text-balance">
                      {settings?.landingHeroTitle ||
                        "The Pinnacle of Modern Grooming."}
                    </h1>
                    <p className="text-base md:text-xl text-white/75 font-medium max-w-2xl mx-auto leading-relaxed text-pretty">
                      {settings?.landingHeroSubtitle ||
                        "Where traditional artistry meets contemporary precision."}
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.45, duration: 0.8 }}
                    className="flex flex-wrap justify-center gap-5 pt-4"
                  >
                    <Button
                      onClick={() => navigate(bookingPath)}
                      size="lg"
                      className="h-16 px-10 rounded-2xl font-black text-lg hover:scale-[1.04] active:scale-[0.98] transition-all border-none relative overflow-hidden group shadow-2xl shadow-black/30"
                      style={{
                        backgroundColor: theme.primary,
                        color: theme.dark,
                        boxShadow: `0 10px 40px -10px ${theme.primary}60`,
                      }}
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        احجز موعدك الملكي <ArrowLeft size={20} />
                      </span>
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </Button>
                    <Button
                      onClick={() => navigateToPage("services")}
                      variant="outline"
                      size="lg"
                      className="h-16 px-10 rounded-2xl border-white/20 text-white font-black text-lg hover:bg-white/10 hover:border-white/40 transition-all backdrop-blur-md"
                    >
                      استكشف الخدمات
                    </Button>
                  </motion.div>
                </div>

                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut",
                  }}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40"
                >
                  <ChevronDown size={28} className="animate-pulse" />
                </motion.div>
              </section>

              {/* Trust Stats Ribbon */}
              <section className="max-w-6xl mx-auto px-6 -mt-20 relative z-20">
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true, amount: 0.15 }}
                  className="public-glass-card grid grid-cols-1 md:grid-cols-3 gap-6 rounded-[2.5rem] p-8 md:p-12 border shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
                  style={{
                    borderColor: `${theme.primary}15`,
                  }}
                >
                  {landingContent.stats.map((stat, index) => (
                    <motion.div
                      key={index}
                      variants={fadeInUp}
                      className="flex flex-col items-center text-center space-y-3 p-4 md:border-l last:border-l-0"
                      style={{ borderColor: `${theme.primary}15` }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-4xl md:text-5xl font-black tracking-tight"
                          style={{ color: theme.primary }}
                        >
                          {stat.value}
                        </span>
                        <span
                          className="h-2 w-2 rounded-full animate-ping"
                          style={{ backgroundColor: theme.primary }}
                        />
                      </div>
                      <h3
                        className="text-lg font-black tracking-wide"
                        style={{ color: theme.dark }}
                      >
                        {stat.label}
                      </h3>
                      <p
                        className="text-xs font-bold opacity-60 max-w-xs leading-relaxed"
                        style={{ color: theme.text }}
                      >
                        {stat.description}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>
              </section>

              {/* Luxury Features Section */}
              <section className="py-20 px-6 relative overflow-hidden">
                <div
                  className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full blur-[120px] -ml-64 -translate-y-1/2 opacity-20"
                  style={{ backgroundColor: `${theme.primary}10` }}
                />
                <div className="max-w-7xl mx-auto space-y-16 relative z-10">
                  <div className="text-center space-y-4">
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.4em] mb-1"
                      style={{ color: theme.primary }}
                    >
                      Why Pro Salon
                    </p>
                    <h2
                      className="text-4xl md:text-5xl font-black tracking-tight"
                      style={{ color: theme.dark }}
                    >
                      لماذا يختارنا صفوة الرجال؟
                    </h2>
                    <div
                      className="h-1.5 w-16 mx-auto rounded-full mt-4"
                      style={{ backgroundColor: theme.primary }}
                    />
                  </div>

                  <motion.div
                    variants={staggerContainer}
                    initial="initial"
                    whileInView="animate"
                    viewport={{ once: true, amount: 0.15 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-8"
                  >
                    {landingContent.features.map((feature, index) => {
                      const icons = [Award, Sparkles, Clock3];
                      const IconComponent = icons[index % icons.length];
                      return (
                        <motion.div
                          key={index}
                          variants={cardMotion}
                          whileHover="hover"
                          className="glow-border-hover p-8 rounded-[2.5rem] border flex flex-col items-center text-center space-y-5 group transition-all duration-500 shadow-lg hover:shadow-2xl"
                          style={{
                            backgroundColor: theme.card,
                            borderColor: `${theme.primary}10`,
                          }}
                        >
                          <div
                            className="h-16 w-16 rounded-[1.3rem] flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-110"
                            style={{
                              backgroundColor: theme.dark,
                              color: theme.primary,
                            }}
                          >
                            <IconComponent size={26} />
                          </div>
                          <h3
                            className="text-xl font-black transition-colors"
                            style={{ color: theme.dark }}
                          >
                            {feature.title}
                          </h3>
                          <p
                            className="text-sm font-bold leading-relaxed opacity-75"
                            style={{ color: theme.muted }}
                          >
                            {feature.description}
                          </p>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
              </section>
            </motion.div>
          )}

          {/* 2. offers tab page */}
          {activePage === "offers" && offers.length > 0 && (
            <motion.div
              key="offers"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="py-16 px-6 min-h-[70vh] flex items-center"
            >
              <div className="max-w-7xl mx-auto space-y-12 w-full">
                <div className="text-center space-y-4">
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.4em]"
                    style={{ color: theme.primary }}
                  >
                    Exclusive Opportunities
                  </p>
                  <h2
                    className="text-4xl md:text-5xl font-black tracking-tight"
                    style={{ color: theme.dark }}
                  >
                    العروض الملكية الحالية
                  </h2>
                  <div
                    className="h-1.5 w-16 mx-auto rounded-full mt-4"
                    style={{ backgroundColor: theme.primary }}
                  />
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true, amount: 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4"
                >
                  {offers.map((offer) => (
                    <motion.div
                      key={offer.id}
                      variants={cardMotion}
                      whileHover="hover"
                      className="group relative h-[480px] rounded-[2.5rem] overflow-hidden shadow-2xl border transition-all duration-500 hover:-translate-y-2"
                      style={{
                        backgroundColor: theme.card,
                        borderColor: `${theme.primary}15`,
                        boxShadow: `0 20px 40px -15px ${theme.primary}15`,
                      }}
                    >
                      <img
                        src={
                          resolveAssetUrl(offer.image_url) ||
                          "https://images.unsplash.com/photo-1593702295094-172c69a15444?q=80&w=800"
                        }
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        alt={offer.name}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />
                      <div className="absolute top-6 right-6 z-10">
                        <Badge className="bg-rose-600 text-white font-black border-none px-4 py-1.5 rounded-xl shadow-lg">
                          عرض محدود
                        </Badge>
                      </div>
                      <div className="absolute bottom-8 inset-x-6 space-y-4">
                        <h3 className="text-2xl font-black text-white leading-snug">
                          {offer.name_ar || offer.name}
                        </h3>
                        <p className="text-xs font-bold text-white/75 line-clamp-2 leading-relaxed">
                          {offer.description_ar || offer.description}
                        </p>
                        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-white/50 uppercase tracking-wider">
                              سعر العرض
                            </span>
                            <span
                              className="text-2xl font-black"
                              style={{ color: theme.primary }}
                            >
                              {offer.offer_price} ج.م
                            </span>
                          </div>
                          <Button
                            onClick={() => navigate(bookingPath)}
                            className="rounded-xl font-black px-6 py-2.5 hover:scale-105 active:scale-95 transition-transform border-none"
                            style={{
                              backgroundColor: theme.primary,
                              color: theme.dark,
                            }}
                          >
                            حجز العرض الآن
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* 3. services tab page */}
          {activePage === "services" && (
            <motion.div
              key="services"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="py-16 px-6 min-h-[80vh]"
            >
              <div className="max-w-7xl mx-auto space-y-12">
                <div
                  className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-8"
                  style={{ borderColor: `${theme.primary}10` }}
                >
                  <div className="space-y-4">
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.4em]"
                      style={{ color: theme.primary }}
                    >
                      Master Crafted Services
                    </p>
                    <h2
                      className="text-4xl md:text-5xl font-black tracking-tight"
                      style={{ color: theme.dark }}
                    >
                      {landingContent.copy.landingServicesTitle}
                    </h2>
                    <p
                      className="text-lg font-bold opacity-60 max-w-xl"
                      style={{ color: theme.text }}
                    >
                      {landingContent.copy.landingServicesSubtitle}
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate(bookingPath)}
                    className="h-14 px-8 rounded-2xl font-black border-none relative overflow-hidden group hover:scale-[1.03] transition-all shadow-lg"
                    style={{
                      backgroundColor: theme.dark,
                      color: theme.primary,
                      boxShadow: `0 10px 30px -5px ${theme.primary}40`,
                    }}
                  >
                    <span className="relative z-10">حجز موعد الآن</span>
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: `radial-gradient(circle at center, ${theme.primary}30 0%, transparent 70%)`,
                      }}
                    />
                  </Button>
                </div>

                {/* Category Switcher Tabs */}
                {displayCategories.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-3 overflow-x-auto pb-4 scrollbar-hidden">
                    <motion.button
                      onClick={() => setSelectedCategory("all")}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="relative px-6 py-3 rounded-2xl text-xs font-black border transition-all duration-300 cursor-pointer overflow-hidden uppercase tracking-wider"
                      style={{
                        color:
                          selectedCategory === "all"
                            ? theme.primary
                            : theme.dark,
                        borderColor:
                          selectedCategory === "all"
                            ? `${theme.primary}40`
                            : `${theme.primary}10`,
                        backgroundColor:
                          selectedCategory === "all"
                            ? "transparent"
                            : `${theme.primary}05`,
                      }}
                    >
                      {selectedCategory === "all" && (
                        <motion.div
                          layoutId="activeCategoryIndicator"
                          className="absolute inset-0 -z-10"
                          style={{ backgroundColor: theme.dark }}
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                      <span className="relative z-10">الكل</span>
                    </motion.button>
                    {displayCategories.map((cat) => (
                      <motion.button
                        key={cat.id}
                        onClick={() => setSelectedCategory(String(cat.id))}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        className="relative px-6 py-3 rounded-2xl text-xs font-black border transition-all duration-300 cursor-pointer overflow-hidden uppercase tracking-wider"
                        style={{
                          color:
                            selectedCategory === String(cat.id)
                              ? theme.primary
                              : theme.dark,
                          borderColor:
                            selectedCategory === String(cat.id)
                              ? `${theme.primary}40`
                              : `${theme.primary}10`,
                          backgroundColor:
                            selectedCategory === String(cat.id)
                              ? "transparent"
                              : `${theme.primary}05`,
                        }}
                      >
                        {selectedCategory === String(cat.id) && (
                          <motion.div
                            layoutId="activeCategoryIndicator"
                            className="absolute inset-0 -z-10"
                            style={{ backgroundColor: theme.dark }}
                            transition={{
                              type: "spring",
                              stiffness: 380,
                              damping: 30,
                            }}
                          />
                        )}
                        <span className="relative z-10">
                          {cat.name_ar || cat.name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Services Grid */}
                <motion.div
                  layout
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
                >
                  <AnimatePresence mode="popLayout">
                    {(selectedCategory === "all"
                      ? filteredServices.slice(0, 12)
                      : filteredServices
                    ).map((svc) => (
                      <motion.div
                        layout
                        variants={cardMotion}
                        whileHover="hover"
                        initial="initial"
                        animate="animate"
                        exit={{ opacity: 0, scale: 0.96 }}
                        key={svc.id}
                        className="glow-border-hover group rounded-[2.5rem] p-4 shadow-xl hover:shadow-2xl transition-all border flex flex-col justify-between h-full cursor-pointer"
                        style={{
                          backgroundColor: theme.card,
                          borderColor: `${theme.primary}10`,
                        }}
                      >
                        <div>
                          <div className="relative h-56 rounded-[2rem] overflow-hidden mb-6">
                            <motion.img
                              variants={{
                                hover: { scale: 1.06 },
                              }}
                              transition={{
                                duration: 0.5,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              src={
                                resolveAssetUrl(svc.image_url) ||
                                "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800"
                              }
                              className="h-full w-full object-cover"
                              alt={svc.name}
                            />
                            <div
                              className="absolute top-4 right-4 backdrop-blur-md px-4 py-2 rounded-2xl font-black text-sm shadow-lg text-white border border-white/10"
                              style={{ backgroundColor: `${theme.dark}bf` }}
                            >
                              {svc.price} {settings?.currency || "ج.م"}
                            </div>
                          </div>
                          <div className="px-3 space-y-3 pb-4">
                            <div className="flex items-center justify-between">
                              <h4
                                className="text-xl font-black"
                                style={{ color: theme.dark }}
                              >
                                {svc.name_ar || svc.name}
                              </h4>
                              <span className="text-[10px] font-bold opacity-50 uppercase tracking-wider">
                                {svc.duration_minutes || svc.duration} دقيقة
                              </span>
                            </div>
                            <p
                              className="text-xs font-bold leading-relaxed line-clamp-2"
                              style={{ color: theme.muted }}
                            >
                              {svc.description_ar ||
                                "تجربة حلاقة مصممة خصيصاً لتناسب أسلوب حياتك مجهزة بأحدث الأدوات والتقنيات."}
                            </p>
                          </div>
                        </div>
                        <div className="px-3 pb-2">
                          <Button
                            onClick={() => navigate(bookingPath)}
                            variant="ghost"
                            className="w-full mt-2 h-12 rounded-xl border font-black text-[10px] uppercase tracking-widest hover:border-transparent transition-all shadow-sm"
                            style={{
                              borderColor: `${theme.primary}20`,
                              color: theme.dark,
                              backgroundColor: `${theme.primary}08`,
                            }}
                          >
                            احجز هذه الخدمة
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {filteredServices.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-base font-bold opacity-50">
                      لا توجد خدمات متاحة في هذا القسم حالياً.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 4. team tab page */}
          {activePage === "team" && (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="py-16 px-6 min-h-[75vh]"
            >
              <div className="max-w-7xl mx-auto space-y-16 text-center">
                <div className="space-y-4">
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.4em]"
                    style={{ color: theme.primary }}
                  >
                    The Artisan Team
                  </p>
                  <h2
                    className="text-4xl md:text-5xl font-black tracking-tight"
                    style={{ color: theme.dark }}
                  >
                    خلف كل مظهر، فنان متمكن
                  </h2>
                  <div
                    className="h-1.5 w-16 mx-auto rounded-full mt-4"
                    style={{ backgroundColor: theme.primary }}
                  />
                </div>

                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true, amount: 0.15 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto"
                >
                  {activeBarbers.map((barber) => (
                    <motion.div
                      key={barber.id}
                      variants={cardMotion}
                      whileHover="hover"
                      className="group flex flex-col items-center"
                    >
                      <div
                        className="relative w-full aspect-[4/5] rounded-[3rem] overflow-hidden mb-6 shadow-2xl border transition-all duration-500"
                        style={{
                          borderColor: `${theme.primary}15`,
                          boxShadow: `0 15px 35px -5px ${theme.primary}15`,
                        }}
                      >
                        <motion.img
                          variants={{
                            hover: { scale: 1.05 },
                          }}
                          transition={{
                            duration: 0.5,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          src={
                            resolveAssetUrl(barber.profile_image_url) ||
                            "https://images.unsplash.com/photo-1618077360395-f3068be8e001?q=80&w=800"
                          }
                          className="h-full w-full object-cover"
                          alt={barber.display_name}
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black text-amber-400 flex items-center gap-1 shadow-md border border-white/5">
                          <Star size={10} fill="currentColor" />
                          <span>4.9</span>
                        </div>
                        <motion.div
                          variants={{
                            initial: { opacity: 0, y: 15 },
                            hover: { opacity: 1, y: 0 },
                          }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className="absolute bottom-6 inset-x-0 flex justify-center"
                        >
                          <Button
                            onClick={() => navigate(bookingPath)}
                            className="font-black px-6 py-3 rounded-2xl shadow-2xl border-none"
                            style={{
                              backgroundColor: theme.primary,
                              color: theme.dark,
                            }}
                          >
                            احجز معه الآن
                          </Button>
                        </motion.div>
                      </div>
                      <h4
                        className="text-2xl font-black"
                        style={{ color: theme.dark }}
                      >
                        {barber.display_name}
                      </h4>
                      <p
                        className="text-[10px] font-black uppercase tracking-[0.15em] mt-1"
                        style={{ color: theme.primary }}
                      >
                        {barber.job_title || "Senior Artisan"}
                      </p>
                      {(barber.bio_ar || barber.bio_en || barber.bio) && (
                        <p
                          className="mt-3 text-xs font-bold opacity-60 italic max-w-[240px] leading-relaxed line-clamp-2"
                          style={{ color: theme.text }}
                        >
                          "{barber.bio_ar || barber.bio_en || barber.bio}"
                        </p>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* 5. testimonials tab page */}
          {activePage === "testimonials" && (
            <motion.div
              key="testimonials"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="py-16 px-6 min-h-[75vh] flex items-center"
            >
              <div className="max-w-7xl mx-auto space-y-16 w-full">
                <div className="text-center space-y-4">
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.4em]"
                    style={{ color: theme.primary }}
                  >
                    Client Experiences
                  </p>
                  <h2
                    className="text-4xl md:text-5xl font-black tracking-tight"
                    style={{ color: theme.dark }}
                  >
                    ماذا يقول عملاؤنا عنا؟
                  </h2>
                  <div
                    className="h-1.5 w-16 mx-auto rounded-full mt-4"
                    style={{ backgroundColor: theme.primary }}
                  />
                </div>

                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true, amount: 0.15 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-8"
                >
                  {testimonials.map((test, index) => (
                    <motion.div
                      key={index}
                      variants={cardMotion}
                      whileHover="hover"
                      className="p-8 rounded-[2.5rem] border shadow-lg hover:shadow-2xl flex flex-col justify-between space-y-6 transition-all duration-300 relative overflow-hidden"
                      style={{
                        backgroundColor: theme.card,
                        borderColor: `${theme.primary}10`,
                      }}
                    >
                      <div className="space-y-4 relative z-10">
                        <div
                          className="flex gap-1"
                          style={{ color: theme.primary }}
                        >
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={15} fill="currentColor" />
                          ))}
                        </div>
                        <p
                          className="text-sm font-bold leading-relaxed italic"
                          style={{ color: theme.text }}
                        >
                          "{test.quote || test.quote_ar}"
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-4 border-t pt-4 relative z-10"
                        style={{ borderColor: `${theme.primary}10` }}
                      >
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center font-black shadow-md border"
                          style={{
                            backgroundColor: theme.dark,
                            color: theme.primary,
                            borderColor: `${theme.primary}20`,
                          }}
                        >
                          {test.name ? test.name.charAt(0) : "C"}
                        </div>
                        <div>
                          <h4
                            className="text-base font-black"
                            style={{ color: theme.dark }}
                          >
                            {test.name || test.name_ar}
                          </h4>
                          <p
                            className="text-[10px] font-black opacity-60 mt-0.5"
                            style={{ color: theme.primary }}
                          >
                            {test.role || test.role_ar || "عميل مميز"}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* 6. contact tab page */}
          {activePage === "contact" && (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="py-16 px-6 min-h-[80vh]"
            >
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
                <motion.div
                  variants={fadeInUp}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true }}
                  className="lg:col-span-5 space-y-10"
                >
                  <div className="space-y-4">
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.4em]"
                      style={{ color: theme.primary }}
                    >
                      Connect With Us
                    </p>
                    <h2
                      className="text-4xl md:text-5xl font-black tracking-tight"
                      style={{ color: theme.dark }}
                    >
                      تفضل بزيارتنا <br /> في {salonName}
                    </h2>
                    <p
                      className="text-base font-bold opacity-60 leading-relaxed"
                      style={{ color: theme.text }}
                    >
                      {locationDescription}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <motion.div
                      variants={cardMotion}
                      whileHover="hover"
                      className="p-6 rounded-[2.5rem] border shadow-xl space-y-4 hover:shadow-2xl transition-all duration-300"
                      style={{
                        backgroundColor: theme.card,
                        borderColor: `${theme.primary}10`,
                      }}
                    >
                      <div
                        className="h-12 w-12 rounded-2xl flex items-center justify-center"
                        style={{
                          backgroundColor: `${theme.primary}15`,
                          color: theme.primary,
                        }}
                      >
                        <MapPin size={24} />
                      </div>
                      <h4
                        className="text-lg font-black"
                        style={{ color: theme.dark }}
                      >
                        الموقع
                      </h4>
                      <p
                        className="text-xs font-bold"
                        style={{ color: theme.muted }}
                      >
                        {settings?.address || "غير حدد"}
                      </p>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-[10px] font-black uppercase tracking-widest hover:translate-x-[-4px] transition-transform"
                          style={{ color: theme.primary }}
                        >
                          الذهاب للخرائط ←
                        </a>
                      )}
                    </motion.div>
                    <motion.div
                      variants={cardMotion}
                      whileHover="hover"
                      className="p-6 rounded-[2.5rem] border shadow-xl space-y-4 hover:shadow-2xl transition-all duration-300"
                      style={{
                        backgroundColor: theme.card,
                        borderColor: `${theme.primary}10`,
                      }}
                    >
                      <div
                        className="h-12 w-12 rounded-2xl flex items-center justify-center"
                        style={{
                          backgroundColor: `${theme.primary}15`,
                          color: theme.primary,
                        }}
                      >
                        <Phone size={24} />
                      </div>
                      <h4
                        className="text-lg font-black"
                        style={{ color: theme.dark }}
                      >
                        الهاتف
                      </h4>
                      <p
                        className="text-xs font-bold"
                        style={{ color: theme.muted }}
                      >
                        {settings?.shopPhone || "غير متوفر"}
                      </p>
                      <a
                        href={`tel:${settings?.shopPhone}`}
                        className="inline-block text-[10px] font-black uppercase tracking-widest hover:translate-x-[-4px] transition-transform"
                        style={{ color: theme.primary }}
                      >
                        اتصل الآن ←
                      </a>
                    </motion.div>
                  </div>
                </motion.div>

                {/* Live Working Hours Widget */}
                <motion.div
                  variants={fadeInUp}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true }}
                  className="lg:col-span-7 flex flex-col justify-center"
                >
                  <div
                    className="p-8 md:p-12 rounded-[3rem] border shadow-2xl space-y-8 relative overflow-hidden"
                    style={{
                      backgroundColor: theme.card,
                      borderColor: `${theme.primary}15`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock3 style={{ color: theme.primary }} size={28} />
                        <h3
                          className="text-2xl font-black"
                          style={{ color: theme.dark }}
                        >
                          مواعيد العمل
                        </h3>
                      </div>
                      {/* Glowing Status Badge */}
                      <div
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black shadow-md transition-all ${
                          isOpenNow()
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${isOpenNow() ? "bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.7)]" : "bg-rose-500"}`}
                        />
                        {isOpenNow() ? "مفتوح الآن" : "مغلق حالياً"}
                      </div>
                    </div>

                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      whileInView="animate"
                      viewport={{ once: true }}
                      className="space-y-3"
                    >
                      {Object.entries(activeHours).map(([dayKey, val]) => {
                        const daysEnglish = [
                          "sunday",
                          "monday",
                          "tuesday",
                          "wednesday",
                          "thursday",
                          "friday",
                          "saturday",
                        ];
                        const todayIndex = new Date().getDay();
                        const isToday = daysEnglish[todayIndex] === dayKey;

                        return (
                          <motion.div
                            variants={fadeInUp}
                            whileHover={{ scale: 1.02, x: -5 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 20,
                            }}
                            key={dayKey}
                            className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border ${
                              isToday
                                ? "shadow-lg scale-[1.02]"
                                : "border-transparent"
                            }`}
                            style={
                              isToday
                                ? {
                                    backgroundColor: theme.dark,
                                    color: theme.primary,
                                    borderColor: `${theme.primary}30`,
                                  }
                                : { color: theme.text }
                            }
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black">
                                {dayNamesAr[dayKey]}
                              </span>
                              {isToday && (
                                <span
                                  className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                                  style={{
                                    backgroundColor: `${theme.primary}20`,
                                    color: theme.primary,
                                  }}
                                >
                                  اليوم
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-bold">
                              {val.is_open ? (
                                <span>
                                  {val.open_time} - {val.close_time}
                                </span>
                              ) : (
                                <span className="text-rose-500 font-black">
                                  مغلق
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer & Dynamic Sticky CTA */}
      <footer
        className="py-16 px-4 border-t text-white"
        style={{
          backgroundColor: theme.dark,
          borderColor: `${theme.primary}20`,
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-6">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden border border-white/10"
              style={{ backgroundColor: theme.primary, color: theme.dark }}
            >
              {logoImage ? (
                <img
                  src={logoImage}
                  className="h-full w-full object-cover"
                  alt="Logo"
                />
              ) : (
                <Scissors size={24} />
              )}
            </div>
            <div>
              <h4 className="text-xl font-black text-white">{salonName}</h4>
              <p className="text-xs font-bold text-white/45 uppercase tracking-widest">
                Dynamic OS for Modern Barbershops
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {[
              {
                href: settings?.socialFacebook,
                icon: Facebook,
                label: "Facebook",
              },
              {
                href: settings?.socialInstagram,
                icon: Instagram,
                label: "Instagram",
              },
              { href: settings?.socialTiktok, icon: Music2, label: "TikTok" },
              {
                href: settings?.socialYoutube,
                icon: Youtube,
                label: "YouTube",
              },
            ]
              .filter((s) => s.href)
              .map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="h-10 w-10 rounded-full border border-white/10 flex items-center justify-center hover:scale-105 transition-all"
                  style={{
                    color: theme.primary,
                    borderColor: `${theme.primary}30`,
                  }}
                >
                  <link.icon size={16} />
                </a>
              ))}
          </div>
        </div>
      </footer>

      {/* Global Floating Pulse CTA */}
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5, ease: "easeOut" }}
        className="pointer-events-none fixed inset-x-3 bottom-3 z-50 sm:inset-x-4 sm:bottom-5"
      >
        <div
          className="pointer-events-auto mx-auto flex max-w-md flex-col gap-3 rounded-[2.2rem] border p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
          style={{
            backgroundColor: `${theme.dark}ee`,
            color: theme.bg,
            borderColor: `${theme.primary}25`,
          }}
        >
          <div className="mr-1 flex items-center gap-3 sm:mr-3">
            <div
              className={`h-3 w-3 rounded-full ${isOpenNow() ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)]" : "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]"}`}
              style={{
                boxShadow: isOpenNow()
                  ? `0 0 14px ${theme.primary}`
                  : undefined,
              }}
            />
            <p
              className="text-[10px] font-black leading-relaxed tracking-[0.15em] sm:leading-none"
              style={{ color: theme.primary }}
            >
              {isOpenNow()
                ? "مفتوح الآن • احجز موعدك"
                : "مغلق حالياً • احجز للمستقبل"}
            </p>
          </div>
          <Button
            onClick={() => navigate(bookingPath)}
            className="group relative h-12 w-full overflow-hidden rounded-2xl border-none px-6 text-sm font-black shadow-lg hover:scale-[1.04] active:scale-[0.97] sm:w-auto"
            style={{
              backgroundColor: theme.primary,
              color: theme.dark,
              boxShadow: `0 4px 20px -2px ${theme.primary}50`,
            }}
          >
            <span className="relative z-10">احجز موعدك الآن</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
